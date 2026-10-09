import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { toast } from "sonner";

// Initialize Firebase using Vite env variables
const env: any = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

let app: any = null;
let messaging: any = null;

// Only initialize messaging on the client
if (typeof window !== "undefined") {
  app = initializeApp(firebaseConfig);
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
    }
  });
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !messaging) {
    toast.error("Push notifications are not supported.");
    return null;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: env.VITE_FIREBASE_VAPID_KEY,
      });
      console.log("Firebase push token:", token);
      
      toast.success("Push notifications enabled!");
      return token;
    } else {
      toast.error("Permission denied for notifications.");
      return null;
    }
  } catch (error) {
    console.error("Error setting up notifications:", error);
    toast.error("Failed to setup notifications.");
    return null;
  }
}

export function setupMessageListener() {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    console.log("Message received. ", payload);
    toast.info(payload.notification?.title || "New notification", {
      description: payload.notification?.body,
    });
  });
}
