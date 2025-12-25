/**
 * Change Logging Utilities
 * Detects, formats, and logs changes to entities
 */

import { getChangedBySource, getChangedByLabel } from './auth';

interface FieldChange {
  field: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  displayOld: string;
  displayNew: string;
}

interface ChangeLogData {
  entityType: 'Dog' | 'Owner' | 'Media';
  entityId: string;
  entityName: string;
  operation: 'create' | 'update' | 'delete';
  changes: FieldChange[];
  changesSummary: string;
  changedBy: 'public' | 'admin' | 'system';
  status: 'pending' | 'accepted';
  frontendUrl?: string;
  backendUrl?: string;
}

/**
 * Field labels for display
 */
const FIELD_LABELS: Record<string, Record<string, string>> = {
  Dog: {
    name: 'Nom',
    sex: 'Sexe',
    birthday: 'Anniversaire',
    breed: 'Race',
    coat: 'Robe',
    owner: 'Humain',
  },
  Owner: {
    name: 'Nom',
    email: 'Email',
    phone: 'Téléphone',
  },
  Media: {
    name: 'Nom',
    type: 'Type',
    status: 'Statut',
    isFeatured: 'Photo principale',
    dog: 'Chien',
  },
};

/**
 * Fields to track for each entity type
 */
const TRACKED_FIELDS: Record<string, string[]> = {
  Dog: ['name', 'sex', 'birthday', 'breed', 'coat', 'owner'],
  Owner: ['name', 'email', 'phone'],
  Media: ['status', 'isFeatured', 'dog'],
};

/**
 * Format a value for display
 */
function formatValue(field: string, value: any, entityType: string): string {
  if (value === null || value === undefined) {
    return '(vide)';
  }

  // Handle relationships (objects with id)
  if (typeof value === 'object' && value.id) {
    return value.name || value.id;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(v => v.name || v.id).join(', ') : '(aucun)';
  }

  // Handle sex field
  if (field === 'sex') {
    return value === 'male' ? 'Mâle' : value === 'female' ? 'Femelle' : value;
  }

  // Handle status field
  if (field === 'status') {
    const statusMap: Record<string, string> = {
      pending: 'En attente',
      approved: 'Approuvée',
      rejected: 'Rejetée',
    };
    return statusMap[value] || value;
  }

  // Handle boolean
  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }

  // Handle dates
  if (field === 'birthday' && value) {
    return formatDate(value);
  }

  return String(value);
}

/**
 * Format date as DD/MM/YYYY
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Detect changes between old and new data
 */
export function detectChanges(
  entityType: 'Dog' | 'Owner' | 'Media',
  oldItem: any,
  newData: any
): FieldChange[] {
  const changes: FieldChange[] = [];
  const fieldsToTrack = TRACKED_FIELDS[entityType] || [];

  for (const field of fieldsToTrack) {
    // Skip if field not in newData (not being updated)
    if (!(field in newData)) {
      continue;
    }

    const oldValue = oldItem?.[field];
    const newValue = newData[field];

    // Handle relationship disconnects (explicit null)
    if (newData[field] === null && oldValue !== null) {
      changes.push({
        field,
        fieldLabel: FIELD_LABELS[entityType]?.[field] || field,
        oldValue,
        newValue: null,
        displayOld: formatValue(field, oldValue, entityType),
        displayNew: '(supprimé)',
      });
      continue;
    }

    // Handle relationship connects/updates
    if (typeof newValue === 'object' && newValue !== null) {
      // Check if it's a connect/disconnect operation
      if ('connect' in newValue || 'disconnect' in newValue) {
        const connectId = newValue.connect?.id;
        const oldId = oldValue?.id;

        if (connectId !== oldId) {
          changes.push({
            field,
            fieldLabel: FIELD_LABELS[entityType]?.[field] || field,
            oldValue,
            newValue: newValue.connect,
            displayOld: formatValue(field, oldValue, entityType),
            displayNew: formatValue(field, newValue.connect, entityType),
          });
        }
        continue;
      }
    }

    // Compare primitive values
    const oldValueStr = JSON.stringify(oldValue);
    const newValueStr = JSON.stringify(newValue);

    if (oldValueStr !== newValueStr) {
      changes.push({
        field,
        fieldLabel: FIELD_LABELS[entityType]?.[field] || field,
        oldValue,
        newValue,
        displayOld: formatValue(field, oldValue, entityType),
        displayNew: formatValue(field, newValue, entityType),
      });
    }
  }

  return changes;
}

/**
 * Create a human-readable summary of changes
 */
export function createChangesSummary(
  entityType: 'Dog' | 'Owner' | 'Media',
  entityName: string,
  changes: FieldChange[]
): string {
  if (changes.length === 0) {
    return `${entityType}: ${entityName}`;
  }

  const changeParts = changes.map(change => {
    return `${change.fieldLabel}: ${change.displayOld} → ${change.displayNew}`;
  });

  return `${entityName}: ${changeParts.join(', ')}`;
}

/**
 * Create a notification message for changes
 */
export function createNotificationMessage(
  entityType: 'Dog' | 'Owner' | 'Media',
  entityName: string,
  operation: 'create' | 'update' | 'delete',
  changes: FieldChange[]
): { title: string; body: string } {
  const icons: Record<string, string> = {
    Dog: '🐕',
    Owner: '👤',
    Media: '📸',
  };

  const icon = icons[entityType] || '📝';

  if (operation === 'create') {
    const typeLabel = entityType === 'Dog' ? 'Chien' : entityType === 'Owner' ? 'Humain' : 'Média';
    return {
      title: `${icon} Nouveau ${typeLabel.toLowerCase()}`,
      body: `"${entityName}" a été créé`,
    };
  }

  if (operation === 'delete') {
    const typeLabel = entityType === 'Dog' ? 'Chien' : entityType === 'Owner' ? 'Humain' : 'Média';
    return {
      title: `${icon} ${typeLabel} supprimé`,
      body: `"${entityName}" a été supprimé`,
    };
  }

  // Update operation
  if (changes.length === 0) {
    return {
      title: `${icon} ${entityName}`,
      body: 'Modifié',
    };
  }

  const changeParts = changes.map(change => {
    return `${change.fieldLabel}: ${change.displayOld} → ${change.displayNew}`;
  });

  return {
    title: `${icon} ${entityName} modifié`,
    body: changeParts.join(', '),
  };
}

/**
 * Get the entity name from item data
 */
export function getEntityName(entityType: 'Dog' | 'Owner' | 'Media', item: any): string {
  if (entityType === 'Media') {
    return item.dog?.name ? `Photo de ${item.dog.name}` : item.name || 'Photo sans nom';
  }
  return item.name || 'Sans nom';
}

/**
 * Generate frontend and backend URLs for an entity
 */
export function generateEntityUrls(
  entityType: 'Dog' | 'Owner' | 'Media',
  entityId: string,
  dogId?: string
): { frontendUrl: string; backendUrl: string } {
  const backendBaseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';

  let frontendUrl = '';
  let backendUrl = '';

  switch (entityType) {
    case 'Dog':
      frontendUrl = `${frontendBaseUrl}/chiens/${entityId}/`;
      backendUrl = `${backendBaseUrl}/dogs/${entityId}`;
      break;
    case 'Owner':
      frontendUrl = `${frontendBaseUrl}/humains/${entityId}/`;
      backendUrl = `${backendBaseUrl}/owners/${entityId}`;
      break;
    case 'Media':
      // For media, link to the dog's page on frontend
      if (dogId) {
        frontendUrl = `${frontendBaseUrl}/chiens/${dogId}/`;
      }
      backendUrl = `${backendBaseUrl}/media/${entityId}`;
      break;
  }

  return { frontendUrl, backendUrl };
}

/**
 * Determine change status based on moderation mode
 */
export async function getChangeStatus(context: any): Promise<'pending' | 'accepted'> {
  try {
    const settings = await context.query.Settings.findOne({
      query: 'moderationMode',
    });

    // A posteriori: auto-accept changes
    // A priori: require approval
    return settings?.moderationMode === 'a_posteriori' ? 'accepted' : 'pending';
  } catch (error) {
    console.error('Error getting moderation mode:', error);
    return 'accepted'; // Default to accepted if error
  }
}

/**
 * Log a change to the database
 */
export async function logChange(
  context: any,
  data: Omit<ChangeLogData, 'status' | 'changedBy'> & { status?: 'pending' | 'accepted'; dogId?: string }
): Promise<void> {
  try {
    const status = data.status || await getChangeStatus(context);
    const urls = generateEntityUrls(data.entityType, data.entityId, data.dogId);
    const changedBy = getChangedBySource(context);
    const changedByLabel = getChangedByLabel(context);

    // Enhance summary with attribution if from magic link
    let changesSummary = data.changesSummary;
    if (changedBy === 'magic' && changedByLabel) {
      changesSummary = `[${changedByLabel}] ${changesSummary}`;
    }

    await context.query.ChangeLog.createOne({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        entityName: data.entityName,
        operation: data.operation,
        changes: data.changes,
        changesSummary,
        changedBy,
        changedByLabel,
        status,
        frontendUrl: urls.frontendUrl,
        backendUrl: urls.backendUrl,
      },
    });
  } catch (error) {
    console.error('Error logging change:', error);
    // Don't throw - logging failures shouldn't break the main operation
  }
}
