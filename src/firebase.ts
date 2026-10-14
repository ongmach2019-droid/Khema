import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
// Get these credentials from Firebase Console -> Project Settings -> General -> Your apps
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyReplaceWithYourOwn",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "khema-dental.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "khema-dental",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "khema-dental.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export default app;
