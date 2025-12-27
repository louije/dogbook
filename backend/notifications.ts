import webpush from 'web-push';
import { createNotificationMessage } from './change-logging';

let vapidInitialized = false;

// Initialize web-push with VAPID keys
// Called lazily on first use to ensure .env is loaded
function initializeVapid() {
  if (vapidInitialized) return;

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@dogbook.com';

  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );
    vapidInitialized = true;
  } else {
    console.error('[Notifications] VAPID keys not configured! Push notifications will not work.');
  }
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
}

/**
 * Send push notification to specific subscriptions
 */
async function sendPushNotificationToSubscriptions(
  context: any,
  subscriptions: any[],
  payload: NotificationPayload
): Promise<void> {
  // Initialize VAPID keys (happens once on first send)
  initializeVapid();

  if (subscriptions.length === 0) {
    return;
  }

  // Send notification to each subscription
  const promises = subscriptions.map(async (sub: any) => {
    try {
      const subscription = {
        endpoint: sub.endpoint,
        keys: JSON.parse(sub.keys),
      };

      await webpush.sendNotification(
        subscription,
        JSON.stringify(payload)
      );
    } catch (error: any) {
      console.error(`Failed to send push to ${sub.endpoint}:`, error);

      // If subscription is invalid (410 Gone), delete it
      if (error.statusCode === 410) {
        await context.query.PushSubscription.deleteOne({
          where: { id: sub.id },
        });
      }
    }
  });

  await Promise.all(promises);
}

/**
 * Send notification when a new photo is uploaded
 * Only sends to admin subscriptions
 */
export async function sendUploadNotification(
  item: any,
  context: any
): Promise<void> {
  try {
    // Get admin subscriptions only
    const adminSubscriptions = await context.query.PushSubscription.findMany({
      where: { receivesAdminNotifications: { equals: true } },
      query: 'id endpoint keys',
    });

    if (adminSubscriptions.length === 0) {
      return;
    }

    // Get the settings to check moderation mode
    const settings = await context.query.Settings.findOne({
      query: 'moderationMode',
    });

    const moderationMode = settings?.moderationMode || 'a_posteriori';

    // Get dog info for the notification
    const dog = item.dogId
      ? await context.query.Dog.findOne({
          where: { id: item.dogId },
          query: 'id name',
        })
      : null;

    const dogName = dog?.name || 'un chien';

    // Determine notification content based on moderation mode
    let title: string;
    let body: string;

    if (moderationMode === 'a_priori') {
      title = '🐕 Nouvelle photo à approuver';
      body = `Une photo de ${dogName} attend votre approbation.`;
    } else {
      title = '🐕 Nouvelle photo ajoutée';
      body = `Une nouvelle photo de ${dogName} a été ajoutée.`;
    }

    // Send push notification to admin subscriptions only
    await sendPushNotificationToSubscriptions(context, adminSubscriptions, {
      title,
      body,
      icon: '/images/hello-big-dog.png',
      badge: '/images/hello-dog.png',
      data: {
        url: moderationMode === 'a_priori' ? '/media' : `/media/${item.id}`,
        dogId: dog?.id,
        mediaId: item.id,
        action: moderationMode === 'a_priori' ? 'approve' : 'view',
      },
    });
  } catch (error) {
    console.error('Error in sendUploadNotification:', error);
  }
}

/**
 * Send notification when a dog is updated by a non-admin user
 * Only sends to admin subscriptions
 */
export async function sendDogUpdateNotification(
  item: any,
  context: any
): Promise<void> {
  try {
    // Only notify if updated by non-admin
    if (context.session?.data?.isAdmin) {
      return;
    }

    // Get admin subscriptions only
    const adminSubscriptions = await context.query.PushSubscription.findMany({
      where: { receivesAdminNotifications: { equals: true } },
      query: 'id endpoint keys',
    });

    if (adminSubscriptions.length === 0) {
      return;
    }

    await sendPushNotificationToSubscriptions(context, adminSubscriptions, {
      title: '🐕 Modification d\'un chien',
      body: `${item.name} a été modifié par un utilisateur`,
      icon: '/images/hello-big-dog.png',
      badge: '/images/hello-dog.png',
      data: {
        url: `/dogs/${item.id}`,
        dogId: item.id,
      },
    });
  } catch (error) {
    console.error('Error in sendDogUpdateNotification:', error);
  }
}

/**
 * Send notification when a new dog is added by a non-admin user
 * Only sends to admin subscriptions
 * Currently noop as only admins can create dogs
 */
export async function sendNewDogNotification(
  item: any,
  context: any
): Promise<void> {
  try {
    // Only notify if created by non-admin (currently only admins can create)
    if (context.session?.data?.isAdmin) {
      return;
    }

    // Get admin subscriptions only
    const adminSubscriptions = await context.query.PushSubscription.findMany({
      where: { receivesAdminNotifications: { equals: true } },
      query: 'id endpoint keys',
    });

    if (adminSubscriptions.length === 0) {
      return;
    }

    await sendPushNotificationToSubscriptions(context, adminSubscriptions, {
      title: '🐕 Nouveau chien ajouté',
      body: `${item.name} a été ajouté`,
      icon: '/images/hello-big-dog.png',
      badge: '/images/hello-dog.png',
      data: {
        url: `/dogs/${item.id}`,
        dogId: item.id,
      },
    });
  } catch (error) {
    console.error('Error in sendNewDogNotification:', error);
  }
}

/**
 * Send notification for entity changes with detailed change information
 * Only sends to admin subscriptions
 */
export async function sendChangeNotification(
  context: any,
  changeData: {
    entityType: 'Dog' | 'Owner' | 'Media';
    entityName: string;
    operation: 'create' | 'update' | 'delete';
    changes: Array<{
      field: string;
      fieldLabel: string;
      oldValue: any;
      newValue: any;
      displayOld: string;
      displayNew: string;
    }>;
  }
): Promise<void> {
  try {
    // Only notify for non-admin changes
    if (context.session) {
      return;
    }

    // Get admin subscriptions only
    const adminSubscriptions = await context.query.PushSubscription.findMany({
      where: { receivesAdminNotifications: { equals: true } },
      query: 'id endpoint keys',
    });

    if (adminSubscriptions.length === 0) {
      return;
    }

    // Create notification message with change details
    const { title, body } = createNotificationMessage(
      changeData.entityType,
      changeData.entityName,
      changeData.operation,
      changeData.changes
    );

    await sendPushNotificationToSubscriptions(context, adminSubscriptions, {
      title,
      body,
      icon: '/images/hello-big-dog.png',
      badge: '/images/hello-dog.png',
      data: {
        url: '/change-log',
        entityType: changeData.entityType,
        entityName: changeData.entityName,
        operation: changeData.operation,
      },
    });
  } catch (error) {
    console.error('Error in sendChangeNotification:', error);
  }
}
