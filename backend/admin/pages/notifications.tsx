/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, Heading, Stack } from '@keystone-ui/core';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { gql, useMutation, useQuery } from '@keystone-6/core/admin-ui/apollo';
import { useState, useEffect } from 'react';

const VAPID_PUBLIC_KEY = 'BD8ZCavx5V8BB5zWCUY06fjWZugVtNbESyaL1CvMYgAy-CSCbREIxe8JZOZpYhMO3zuvUjp5EmNp_Tl0uIf3BDo';

// GraphQL mutation to create push subscription
const CREATE_SUBSCRIPTION = gql`
  mutation CreatePushSubscription($endpoint: String!, $keys: String!, $receivesAdminNotifications: Boolean!) {
    createPushSubscription(data: {
      endpoint: $endpoint
      keys: $keys
      receivesAdminNotifications: $receivesAdminNotifications
    }) {
      id
    }
  }
`;

// GraphQL query to check existing subscriptions
const GET_SUBSCRIPTIONS = gql`
  query GetPushSubscriptions {
    pushSubscriptions {
      id
      endpoint
      receivesAdminNotifications
    }
  }
`;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationsPage() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [status, setStatus] = useState('Vérification...');

  const [createSubscription] = useMutation(CREATE_SUBSCRIPTION);
  const { data } = useQuery(GET_SUBSCRIPTIONS);

  useEffect(() => {
    // Check if push notifications are supported
    if ('PushManager' in window && 'serviceWorker' in navigator) {
      setSupported(true);
      setPermission(Notification.permission);
      checkSubscription();
    } else {
      setSupported(false);
      setStatus('Les notifications push ne sont pas supportées par ce navigateur (utilisez Safari/WebKit)');
    }
  }, []);

  async function checkSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setSubscribed(!!subscription);
      if (subscription) {
        setStatus('✅ Abonné aux notifications');
      } else {
        setStatus('❌ Non abonné');
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setStatus('Erreur lors de la vérification');
    }
  }

  async function enableNotifications() {
    try {
      setStatus('Demande de permission...');

      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setStatus('❌ Permission refusée');
        return;
      }

      setStatus('Enregistrement du service worker...');

      // Register service worker
      const registration = await navigator.serviceWorker.register('/admin-sw.js');
      await navigator.serviceWorker.ready;

      setStatus('Création de la souscription...');

      // Subscribe with VAPID key
      const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // Required by Safari/browsers
        applicationServerKey: convertedKey
      });

      setStatus('Envoi au serveur...');

      // Send to backend
      await createSubscription({
        variables: {
          endpoint: subscription.endpoint,
          keys: JSON.stringify(subscription.toJSON().keys),
          receivesAdminNotifications: true
        }
      });

      setSubscribed(true);
      setStatus('✅ Abonné aux notifications');
    } catch (error: any) {
      console.error('Error enabling notifications:', error);
      setStatus(`❌ Erreur: ${error.message}`);
    }
  }

  async function disableNotifications() {
    try {
      setStatus('Désabonnement...');

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      setSubscribed(false);
      setStatus('❌ Désabonné');
    } catch (error: any) {
      console.error('Error disabling notifications:', error);
      setStatus(`❌ Erreur: ${error.message}`);
    }
  }

  return (
    <PageContainer header={<Heading type="h3">Notifications Push</Heading>}>
      <Stack gap="large">
        <div>
          <p>Gérez vos notifications push pour être informé des événements importants.</p>
        </div>

        <div>
          <strong>Statut:</strong> {status}
        </div>

        {supported && (
          <Stack gap="medium">
            {!subscribed ? (
              <button
                onClick={enableNotifications}
                css={{
                  padding: '12px 24px',
                  backgroundColor: '#2c5f2d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  '&:hover': {
                    backgroundColor: '#1e4320'
                  }
                }}
              >
                Activer les notifications
              </button>
            ) : (
              <button
                onClick={disableNotifications}
                css={{
                  padding: '12px 24px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  '&:hover': {
                    backgroundColor: '#888'
                  }
                }}
              >
                Désactiver les notifications
              </button>
            )}
          </Stack>
        )}

        <div css={{ marginTop: '32px' }}>
          <h4>Événements notifiés:</h4>
          <ul>
            <li>📸 Nouvelle photo uploadée</li>
            <li>🐕 Chien modifié par un utilisateur</li>
            <li>➕ Nouveau chien ajouté</li>
          </ul>
        </div>

        {data?.pushSubscriptions && data.pushSubscriptions.length > 0 && (
          <div css={{ marginTop: '32px' }}>
            <h4>Souscriptions actives ({data.pushSubscriptions.length}):</h4>
            <ul>
              {data.pushSubscriptions.map((sub: any) => (
                <li key={sub.id} css={{ fontSize: '12px', fontFamily: 'monospace' }}>
                  {sub.endpoint.substring(0, 50)}...
                  {sub.receivesAdminNotifications && ' ✅ Admin'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Stack>
    </PageContainer>
  );
}
