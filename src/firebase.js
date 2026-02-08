import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// CRITICAL DEBUG CHECK
if (!firebaseConfig.apiKey) {
  console.error("Firebase Config Missing!");
  // Wait for DOM to be ready just in case
  setTimeout(() => {
    document.body.innerHTML = '<div style="color:red; padding:20px; text-align:center;"><h1>Configuration Error</h1><p>Missing Firebase API Key. Please check your .env file.</p><p>VITE_FIREBASE_API_KEY is undefined.</p></div>';
  }, 100);
  throw new Error("Firebase API Key Missing");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
