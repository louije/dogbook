import webpush from 'web-push';

// Initialize web-push with VAPID keys
// Generate keys with: npx web-push generate-vapid-keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@dogbook.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
}

/**
 * Send push notification to all subscribed admins
 */
export async function sendPushNotification(
  context: any,
  payload: NotificationPayload
): Promise<void> {
  try {
    // Fetch all push subscriptions
    const subscriptions = await context.query.PushSubscription.findMany({
      query: 'id endpoint keys',
    });

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
  } catch (error) {
    console.error('Error sending push notifications:', error);
  }
}

/**
 * Send notification when a new photo is uploaded
 */
export async function sendUploadNotification(
  item: any,
  context: any
): Promise<void> {
  try {
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

    // Send push notification
    await sendPushNotification(context, {
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
