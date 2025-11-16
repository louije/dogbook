import webpush from 'web-push';

// Initialize web-push with VAPID keys
// Generate keys with: npx web-push generate-vapid-keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@dogbook.com';

if (vapidPublicKey && vapidPrivateKey) {
  console.log('[Notifications] Initializing web-push with VAPID keys');
  console.log('[Notifications] Public key:', vapidPublicKey.substring(0, 20) + '...');
  console.log('[Notifications] Subject:', vapidSubject);
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );
} else {
  console.error('[Notifications] VAPID keys not configured! Push notifications will not work.');
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
  if (subscriptions.length === 0) {
    console.log('No push subscriptions found, skipping notification');
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

      console.log(`Push notification sent to ${sub.endpoint}`);
    } catch (error: any) {
      console.error(`Failed to send push to ${sub.endpoint}:`, error);

      // If subscription is invalid (410 Gone), delete it
      if (error.statusCode === 410) {
        await context.query.PushSubscription.deleteOne({
          where: { id: sub.id },
        });
        console.log(`Deleted invalid subscription: ${sub.id}`);
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
      query: 'id endpoint keys receivesAdminNotifications',
    });

    console.log('[Upload Notification] Found subscriptions:', adminSubscriptions.length, adminSubscriptions.map((s: any) => ({ id: s.id, receivesAdminNotifications: s.receivesAdminNotifications })));

    if (adminSubscriptions.length === 0) {
      console.log('No admin subscriptions, skipping notification');
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
        url: `/media/${item.id}`,
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
      console.log('Dog updated by admin, skipping notification');
      return;
    }

    // Get admin subscriptions only
    const adminSubscriptions = await context.query.PushSubscription.findMany({
      where: { receivesAdminNotifications: { equals: true } },
      query: 'id endpoint keys',
    });

    if (adminSubscriptions.length === 0) {
      console.log('No admin subscriptions, skipping notification');
      return;
    }

    await sendPushNotificationToSubscriptions(context, adminSubscriptions, {
      title: '🐕 Modification d\'un chien',
      body: `${item.name} a été modifié par un utilisateur`,
      icon: '/images/hello-big-dog.png',
      badge: '/images/hello-dog.png',
      data: {
        url: `/admin/dogs/${item.id}`,
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
      console.log('Dog created by admin, skipping notification');
      return;
    }

    // Get admin subscriptions only
    const adminSubscriptions = await context.query.PushSubscription.findMany({
      where: { receivesAdminNotifications: { equals: true } },
      query: 'id endpoint keys',
    });

    if (adminSubscriptions.length === 0) {
      console.log('No admin subscriptions, skipping notification');
      return;
    }

    await sendPushNotificationToSubscriptions(context, adminSubscriptions, {
      title: '🐕 Nouveau chien ajouté',
      body: `${item.name} a été ajouté`,
      icon: '/images/hello-big-dog.png',
      badge: '/images/hello-dog.png',
      data: {
        url: `/admin/dogs/${item.id}`,
        dogId: item.id,
      },
    });
  } catch (error) {
    console.error('Error in sendNewDogNotification:', error);
  }
}
