importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// These config values will be injected during the service worker registration
// or you can hardcode them here if you don't mind exposing them.
// A common approach is to hardcode them in the SW or pass them via query params.
// We'll leave placeholders for the user to fill in if they want standalone SW logic.
const firebaseConfig = {
  // TODO: Add firebase config for the SW
};

// Only initialize if config is provided
if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: payload.notification.body,
      icon: '/logo.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}
