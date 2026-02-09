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

let app, auth, db;
const missingKeys = Object.keys(firebaseConfig).filter(k => !firebaseConfig[k]);

if (missingKeys.length > 0) {
  console.error("Firebase Config Missing Keys:", missingKeys);
  // CRITICAL: Prevent Crash. Setup Mock Objects.
  window.FIREBASE_CONFIG_ERROR = { missing: missingKeys };

  // Mock App
  app = {};

  // Mock Auth
  auth = {
    currentUser: null,
    signOut: async () => console.warn("Mock signOut called (Config Error)"),
    onAuthStateChanged: (cb) => { cb(null); return () => { }; }, // Immediately return null user
    signInWithPopup: async () => { throw new Error("Firebase Config Missing: " + missingKeys.join(", ")); }
  };

  // Mock DB
  db = {
    type: 'mock',
    app: app
  };

  // Attempting to use Firestore methods like getDoc/doc/collection on this mock will crash elsewhere?
  // UserContext uses doc(db, ...). If db is mock, 'doc' function from firebase/firestore might fail if it strictly checks instance.
  // However, since we import 'db' and pass it to functions, if those functions are from the SDK, they might error out.
  // But importantly, the FILE IMPORT won't crash.

} else {
  // Correct Initialization
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase Init Error:", e);
    window.FIREBASE_CONFIG_ERROR = { error: e.message };
    auth = { onAuthStateChanged: (cb) => cb(null) };
    db = {};
  }
}

export { auth, db };
