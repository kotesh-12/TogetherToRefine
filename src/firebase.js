import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDWHnST2fHu2xgtL3tu7WQ0bJZ6AMzfPbY",
  authDomain: "together-to-refine.firebaseapp.com", 
  projectId: "together-to-refine",
  storageBucket: "together-to-refine.appspot.com",   
  messagingSenderId: "360106072129",
  appId: "1:360106072129:web:eb706cf7d7a299ebabcec0",
  measurementId: "G-2HKGEJSKHR"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
