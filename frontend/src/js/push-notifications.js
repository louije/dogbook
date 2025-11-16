/**
 * Web Push Notifications for iOS/Safari (Declarative Web Push)
 * Handles subscription and permission requests for admin users only
 */

(function() {
  'use strict';

  const API_URL = window.API_URL || 'http://localhost:3000';
  const VAPID_PUBLIC_KEY = 'BD8ZCavx5V8BB5zWCUY06fjWZugVtNbESyaL1CvMYgAy-CSCbREIxe8JZOZpYhMO3zuvUjp5EmNp_Tl0uIf3BDo';

  /**
   * Initialize push notifications
   * Only for admins
   */
  function init() {
    // Feature detection - only Safari/WebKit supports declarative web push
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
      console.log('Push notifications not supported in this browser');
      return;
    }

    // Check if user wants to enable notifications (for admins)
    const notificationsEnabled = localStorage.getItem('pushNotifications');

    if (notificationsEnabled === 'enabled') {
      setupPushNotifications();
    } else if (notificationsEnabled !== 'disabled') {
      console.log('Push notifications available. Call window.enablePushNotifications() to enable.');
    }
  }

  /**
   * Request notification permission and subscribe
   */
  async function setupPushNotifications() {
    try {
      // Register minimal service worker (required even for declarative push)
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered');

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // Request notification permission
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        console.log('Notification permission denied');
        localStorage.setItem('pushNotifications', 'disabled');
        return;
      }

      // Subscribe to push notifications
      await subscribeToPush(registration);

    } catch (error) {
      console.error('Error setting up push notifications:', error);
    }
  }

  /**
   * Subscribe to push notifications using declarative API
   */
  async function subscribeToPush(registration) {
    try {
      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Subscribe with VAPID public key
        // userVisibleOnly: false enables declarative mode on Safari
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: false, // Declarative mode for Safari
          applicationServerKey: convertedVapidKey
        });

        // Send subscription to backend with admin flag
        await sendSubscriptionToBackend(subscription);

        console.log('Subscribed to push notifications (declarative mode)');
        localStorage.setItem('pushNotifications', 'enabled');
      } else {
        console.log('Already subscribed to push notifications');
      }
    } catch (error) {
      console.error('Error subscribing to push:', error);
    }
  }

  /**
   * Send subscription to backend with receivesAdminNotifications flag
   */
  async function sendSubscriptionToBackend(subscription) {
    const response = await fetch(`${API_URL}/api/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apollo-require-preflight': 'true',
      },
      body: JSON.stringify({
        query: `
          mutation CreatePushSubscription($endpoint: String!, $keys: String!, $receivesAdminNotifications: Boolean!) {
            createPushSubscription(data: {
              endpoint: $endpoint
              keys: $keys
              receivesAdminNotifications: $receivesAdminNotifications
            }) {
              id
            }
          }
        `,
        variables: {
          endpoint: subscription.endpoint,
          keys: JSON.stringify(subscription.toJSON().keys),
          receivesAdminNotifications: true // Always true for admin subscriptions
        }
      })
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error(result.errors[0].message);
    }

    return result.data.createPushSubscription;
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Public method to enable notifications (can be called from a button or console)
   * Admins only - check window.currentUser.isAdmin before calling if needed
   */
  window.enablePushNotifications = function() {
    setupPushNotifications();
  };

  /**
   * Public method to disable notifications
   */
  window.disablePushNotifications = async function() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        localStorage.setItem('pushNotifications', 'disabled');
        console.log('Unsubscribed from push notifications');
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
    }
  };

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
