import { sendUploadNotification, sendDogUpdateNotification, sendNewDogNotification, sendChangeNotification } from './notifications';
import {
  detectChanges,
  createChangesSummary,
  getEntityName,
  logChange,
} from './change-logging';
import crypto from 'crypto';

/**
 * Trigger frontend build webhook
 * Call this after any data change that should update the frontend
 */
export async function triggerFrontendBuild() {
  const webhookUrl = process.env.FRONTEND_BUILD_HOOK_URL;

  if (!webhookUrl) {
    return;
  }

  try {
    const response = await fetch(webhookUrl, { method: 'POST' });

    if (!response.ok) {
      console.error('Failed to trigger frontend build:', response.status);
    }
  } catch (error) {
    console.error('Error triggering frontend build:', error);
  }
}

/**
 * Hook that can be added to lists to trigger builds on changes
 */
export const buildTriggerHooks = {
  afterOperation: async ({ operation }: any) => {
    // Trigger build on create, update, or delete
    if (['create', 'update', 'delete'].includes(operation)) {
      await triggerFrontendBuild();
    }
  },
};

/**
 * Owner-specific hooks for change logging
 */
export const ownerHooks = {
  beforeOperation: async ({ operation, item, context }: any) => {
    // Store old item data for comparison
    if ((operation === 'update' || operation === 'delete') && item) {
      const fullItem = await context.query.Owner.findOne({
        where: { id: item.id },
        query: 'id name email phone',
      });
      context._oldOwnerItem = fullItem;
    }
  },

  afterOperation: async ({ operation, item, context, inputData }: any) => {

    // Handle create
    if (operation === 'create') {
      const entityName = getEntityName('Owner', item);

      await logChange(context, {
        entityType: 'Owner',
        entityId: item.id,
        entityName,
        operation: 'create',
        changes: [],
        changesSummary: `Nouveau humain créé: ${entityName}`,
      });

      await sendChangeNotification(context, {
        entityType: 'Owner',
        entityName,
        operation: 'create',
        changes: [],
      });
    }

    // Handle update
    if (operation === 'update') {
      const oldItem = context._oldOwnerItem;
      const changes = detectChanges('Owner', oldItem, inputData);

      if (changes.length > 0) {
        const entityName = getEntityName('Owner', item);
        const changesSummary = createChangesSummary('Owner', entityName, changes);

        await logChange(context, {
          entityType: 'Owner',
          entityId: item.id,
          entityName,
          operation: 'update',
          changes,
          changesSummary,
        });

        await sendChangeNotification(context, {
          entityType: 'Owner',
          entityName,
          operation: 'update',
          changes,
        });
      }
    }

    // Handle delete
    if (operation === 'delete') {
      const oldItem = context._oldOwnerItem;
      const entityName = getEntityName('Owner', oldItem);

      await logChange(context, {
        entityType: 'Owner',
        entityId: item.id,
        entityName,
        operation: 'delete',
        changes: [],
        changesSummary: `Humain supprimé: ${entityName}`,
      });

      await sendChangeNotification(context, {
        entityType: 'Owner',
        entityName,
        operation: 'delete',
        changes: [],
      });
    }

    // Trigger frontend builds
    if (['create', 'update', 'delete'].includes(operation)) {
      await triggerFrontendBuild();
    }
  },
};

/**
 * Media-specific hooks for handling upload notifications, auto-approval, and change logging
 */
// File validation constants
const MAX_FILE_SIZE = 24 * 1024 * 1024; // 24MB
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'jxl', 'heic', 'heif'];

export const mediaHooks = {
  beforeOperation: async ({ operation, item, context }: any) => {
    // Store old item data for comparison
    if ((operation === 'update' || operation === 'delete') && item) {
      const fullItem = await context.query.Media.findOne({
        where: { id: item.id },
        query: 'id name status isFeatured dog { id name }',
      });
      context._oldMediaItem = fullItem;
    }
  },

  validateInput: async ({ resolvedData, operation, addValidationError }: any) => {
    // Only validate on create or when file is being updated
    if (operation !== 'create' && !resolvedData.file) {
      return;
    }

    const file = resolvedData.file;
    if (!file) {
      return;
    }

    // Validate file size
    if (file.filesize && file.filesize > MAX_FILE_SIZE) {
      addValidationError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Validate file extension
    if (file.extension && !ALLOWED_EXTENSIONS.includes(file.extension.toLowerCase())) {
      addValidationError(`Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`);
    }
  },

  resolveInput: async ({ resolvedData, context, operation, item }: any) => {
    // Set timestamp on create
    if (operation === 'create' && !resolvedData.uploadedAt) {
      resolvedData.uploadedAt = new Date().toISOString();
    }

    // When a new media is created, check moderation mode and set status accordingly
    if (operation === 'create') {
      const settings = await context.query.Settings.findOne({
        query: 'moderationMode',
      });

      const moderationMode = settings?.moderationMode || 'a_posteriori';

      // Auto-approve in a_posteriori mode
      if (moderationMode === 'a_posteriori') {
        resolvedData.status = 'approved';
      } else {
        resolvedData.status = 'pending';
      }
    }

    // If setting isFeatured to true, unfeature all other photos for this dog
    if (operation === 'update' && resolvedData.isFeatured === true) {
      // Get the current media item's dog
      const currentMedia = await context.query.Media.findOne({
        where: { id: item.id },
        query: 'dog { id }',
      });

      if (currentMedia?.dog?.id) {
        // Find all other featured photos for this dog
        const otherFeaturedPhotos = await context.query.Media.findMany({
          where: {
            dog: { id: { equals: currentMedia.dog.id } },
            id: { not: { equals: item.id } },
            isFeatured: { equals: true },
          },
          query: 'id',
        });

        // Unfeature them
        await Promise.all(
          otherFeaturedPhotos.map((photo: any) =>
            context.query.Media.updateOne({
              where: { id: photo.id },
              data: { isFeatured: false },
            })
          )
        );
      }
    }

    return resolvedData;
  },

  afterOperation: async ({ operation, item, context, inputData }: any) => {

    // Fetch dog information for all operations (for linking)
    let dogId: string | undefined;
    let fullItem = item;

    if (operation === 'create' || operation === 'update') {
      // For create and update, fetch the dog info
      fullItem = await context.query.Media.findOne({
        where: { id: item.id },
        query: 'id name dog { id name }',
      });
      dogId = fullItem?.dog?.id;
    } else if (operation === 'delete') {
      // For delete, use the stored old item
      const oldItem = context._oldMediaItem;
      dogId = oldItem?.dog?.id;
      fullItem = oldItem;
    }

    // Handle create (new photo upload)
    if (operation === 'create') {
      const entityName = getEntityName('Media', fullItem);

      await logChange(context, {
        entityType: 'Media',
        entityId: item.id,
        entityName,
        operation: 'create',
        changes: [],
        changesSummary: `Nouvelle photo uploadée: ${entityName}`,
        dogId,
      });

      // Send existing upload notification
      await sendUploadNotification(item, context);
    }

    // Handle update (status changes, featured photo changes)
    if (operation === 'update') {
      const oldItem = context._oldMediaItem;
      const changes = detectChanges('Media', oldItem, inputData);

      if (changes.length > 0) {
        const entityName = getEntityName('Media', fullItem);
        const changesSummary = createChangesSummary('Media', entityName, changes);

        await logChange(context, {
          entityType: 'Media',
          entityId: item.id,
          entityName,
          operation: 'update',
          changes,
          changesSummary,
          dogId,
        });

        // Send notification if non-admin made the change
        if (!context.session) {
          await sendChangeNotification(context, {
            entityType: 'Media',
            entityName,
            operation: 'update',
            changes,
          });
        }
      }
    }

    // Handle delete
    if (operation === 'delete') {
      const oldItem = context._oldMediaItem;
      const entityName = getEntityName('Media', oldItem);

      await logChange(context, {
        entityType: 'Media',
        entityId: item.id,
        entityName,
        operation: 'delete',
        changes: [],
        changesSummary: `Photo supprimée: ${entityName}`,
        dogId,
      });

      if (!context.session) {
        await sendChangeNotification(context, {
          entityType: 'Media',
          entityName,
          operation: 'delete',
          changes: [],
        });
      }
    }

    // Trigger frontend build when media is approved or deleted
    if (operation === 'delete' || (operation === 'update' && item.status === 'approved')) {
      await triggerFrontendBuild();
    }

    // Also trigger build on create if auto-approved
    if (operation === 'create' && item.status === 'approved') {
      await triggerFrontendBuild();
    }

    // Trigger build when featured photo changes
    if (operation === 'update' && item.isFeatured === true) {
      await triggerFrontendBuild();
    }
  },
};

/**
 * EditToken-specific hooks for token generation
 */
export const editTokenHooks = {
  resolveInput: async ({ operation, resolvedData }: any) => {
    // Generate secure token on create if not provided
    if (operation === 'create' && !resolvedData.token) {
      // Generate friendly token: lowercase letters and numbers only (no dashes/underscores)
      const bytes = crypto.randomBytes(18);
      resolvedData.token = bytes.toString('hex'); // Uses only 0-9 and a-f
    }
    return resolvedData;
  },
};

/**
 * Dog-specific hooks for handling attribute change notifications and change logging
 */
export const dogHooks = {
  resolveInput: async ({ operation, resolvedData, context }: any) => {
    // Set status on create based on moderation mode
    if (operation === 'create') {
      const settings = await context.query.Settings.findOne({
        query: 'moderationMode',
      });

      const moderationMode = settings?.moderationMode || 'a_posteriori';
      resolvedData.status = moderationMode === 'a_posteriori' ? 'approved' : 'pending';
    }

    return resolvedData;
  },

  beforeOperation: async ({ operation, item, context, inputData }: any) => {
    // Store old item data for comparison (for updates and deletes)
    if ((operation === 'update' || operation === 'delete') && item) {
      // Fetch full item with relationships
      const fullItem = await context.query.Dog.findOne({
        where: { id: item.id },
        query: 'id name sex birthday breed coat owner { id name }',
      });

      // Store in context for afterOperation
      context._oldDogItem = fullItem;
    }
  },

  afterOperation: async ({ operation, item, context, inputData, originalItem }: any) => {

    // Handle create
    if (operation === 'create') {
      const entityName = getEntityName('Dog', item);

      await logChange(context, {
        entityType: 'Dog',
        entityId: item.id,
        entityName,
        operation: 'create',
        changes: [],
        changesSummary: `Nouveau chien créé: ${entityName}`,
      });

      // Send notification
      await sendNewDogNotification(item, context);
    }

    // Handle update
    if (operation === 'update') {
      const oldItem = context._oldDogItem;
      const changes = detectChanges('Dog', oldItem, inputData);

      if (changes.length > 0) {
        const entityName = getEntityName('Dog', item);
        const changesSummary = createChangesSummary('Dog', entityName, changes);

        await logChange(context, {
          entityType: 'Dog',
          entityId: item.id,
          entityName,
          operation: 'update',
          changes,
          changesSummary,
        });

        // Send notification with change details
        await sendChangeNotification(context, {
          entityType: 'Dog',
          entityName,
          operation: 'update',
          changes,
        });
      }
    }

    // Handle delete
    if (operation === 'delete') {
      const oldItem = context._oldDogItem;
      const entityName = getEntityName('Dog', oldItem);

      await logChange(context, {
        entityType: 'Dog',
        entityId: item.id,
        entityName,
        operation: 'delete',
        changes: [],
        changesSummary: `Chien supprimé: ${entityName}`,
      });

      await sendChangeNotification(context, {
        entityType: 'Dog',
        entityName,
        operation: 'delete',
        changes: [],
      });
    }

    // Still trigger frontend builds
    if (['create', 'update', 'delete'].includes(operation)) {
      await triggerFrontendBuild();
    }
  },
};
