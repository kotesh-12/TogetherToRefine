# 🚀 TogetherToRefine - Setup & Handover Guide (Updated Feb 8, 2026)

## 🚨 Current Status: "Production Fix"

We are currently debugging a "White Screen / Infinite Loading" issue in Production (Vercel).
The root cause was identified as **Missing Environment Variables** on Vercel.

**Local Development is working fine.**

---

## 🛠️ CRITICAL NEXT STEPS (For Tomorrow)

1.  **Verify Deployment:** Check if the latest deployment (triggered on Feb 8 night) is successful.
2.  **Verify Environment Variables on Vercel:**
    *   Go to Vercel Dashboard -> Settings -> Environment Variables.
    *   Ensure ALL variables from your local `.env` are added.
    *   **CRITICAL:** Variable names must start with `VITE_` (e.g., `VITE_FIREBASE_API_KEY`).
3.  **Check for "Configuration Error":**
    *   Open the live site.
    *   If you see a red screen saying "Configuration Error: Missing Firebase API Key", check step 2 again.
4.  **Check for "App Unresponsive":**
    *   If you see "App Unresponsive" with an error message, copy the error message and debug the specific crash.
5.  **Test Login:** Once the app loads, try logging in to verify the infinite loading loop is gone.

---

## ✅ Recent Fixes (Already Applied)

*   **Login Loop Fix:** Updated `Login.jsx` to prevent infinite spinner for logged-in users.
*   **Failsafe:** Added `index.html` script to force a "Factory Reset" button if the app hangs for >10s.
*   **Debug Mode:** `firebase.js` now throws a visible error if API keys are missing.
*   **Safety Net:** `ErrorBoundary` wraps the entire app to catch React crashes.
*   **Reset Buttons:** Added manual "Reset" buttons to all loading states (Global, Login, Protected Routes).

---

## 📝 Environment Variables Checklist

Ensure these are present in Vercel:

- `VITE_GEMINI_API_KEY`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

---

## 📚 Original Setup Guide

### 1️⃣ Enable Database Permissions (CRITICAL)
Currently, your app cannot save any data (students, marks, etc.) because the "door is locked".

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click on **Firestore Database** on the left menu.
3. Click the **Rules** tab.
4. Delete the existing code and paste this:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
5. Click **Publish**.

✅ **Result:** You can now Log in, Add Students, Allot Classes, Mark Attendance, and Save Exam Results.

---

### 2️⃣ Get Your AI API Key (For TTR AI)
The "TTR AI" chat needs a key to talk to Google's brain.

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click **Create API Key**.
3. Select your project (or create a new one).
4. Copy the key that starts with `AIza...`.
5. Open your project in VS Code.
6. Open the file named `.env`.
7. Paste your key like this:
   ```env
   VITE_GEMINI_API_KEY=AIzaSyYOUR_COPIED_KEY_HERE
   ```
8. Save the file.

✅ **Result:** The AI Assistant will start working instantly.
