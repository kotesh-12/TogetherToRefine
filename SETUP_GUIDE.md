# 🚀 TogetherToRefine - Final Setup Guide

Your application code is **100% complete**. All features (Admissions, Exams, Attendance, Health, Reports) are built and ready.

However, for the app to **actually work** (save data and chat with AI), you must perform these 2 final steps:

---

## 1️⃣ Enable Database Permissions (CRITICAL)
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

## 2️⃣ Get Your AI API Key (For TTR AI)
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

---

### 🎉 That's it!
Once you do these two things, your project is **fully complete** and functional.
