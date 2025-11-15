import { sendUploadNotification } from './notifications';

/**
 * Trigger frontend build webhook
 * Call this after any data change that should update the frontend
 */
export async function triggerFrontendBuild() {
  const webhookUrl = process.env.FRONTEND_BUILD_HOOK_URL;

  if (!webhookUrl) {
    console.log('No FRONTEND_BUILD_HOOK_URL configured, skipping frontend build trigger');
    return;
  }

  try {
    console.log('Triggering frontend build...');
    const response = await fetch(webhookUrl, { method: 'POST' });

    if (response.ok) {
      console.log('Frontend build triggered successfully');
    } else {
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
 * Media-specific hooks for handling upload notifications and auto-approval
 */
export const mediaHooks = {
  resolveInput: async ({ resolvedData, context, operation, item }: any) => {
    // Set timestamp on create
    if (operation === 'create' && !resolvedData.uploadedAt) {
      resolvedData.uploadedAt = new Date().toISOString();
    }

    // When a new media is created, check moderation mode and set status accordingly
    if (operation === 'create') {
      const settings = await context.query.Settings.findOne({
        where: { id: 1 },
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

        if (otherFeaturedPhotos.length > 0) {
          console.log(`Unfeatured ${otherFeaturedPhotos.length} other photo(s) for dog ${currentMedia.dog.id}`);
        }
      }
    }

    return resolvedData;
  },

  afterOperation: async ({ operation, item, context }: any) => {
    // Send notification on new upload
    if (operation === 'create') {
      await sendUploadNotification(item, context);
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
