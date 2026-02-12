# 🌐 TogetherToRefine (TTR) - Platform Documentation

## 📖 1. Project Overview & Philosophy
**TogetherToRefine** is a revolutionary educational management and learning platform designed to empower students, support teachers, and simplify school administration.

### **Core Philosophy:**
- **Growth Over Competition**: The platform focuses on individual progress and "Knowledge Gain" rather than class rankings and peer stress.
- **TTR Universe**: An AI-driven pedagogical approach where abstract concepts (Physics, Math, etc.) are personified as consistent characters (e.g., *Pranav* for Protons, *Gajraj* for Gravity) to make learning memorable.
- **Maturity Bridge**: A strategy to pivot student interests in "low-value" topics (memes, movies) towards high-level maturity in Psychology, Economics, and Career Readiness.

---

## 🛠️ 2. Tech Stack
- **Frontend**: React (Vite-based), Vanilla CSS with "Rich Aesthetics" (Glassmorphism, Vibrant Colors).
- **Backend**: Node.js / Express (deployed as Serverless Functions on Vercel).
- **Database**: 
  - **Firebase Firestore**: Primary real-time database for messages, user profiles, and attendance.
  - **MySQL**: Used for complex relational data (Timetables, Admissions, Fees).
- **Authentication**: Firebase Authentication (Role-based: Admin, Institution, Teacher, Student, Parent).
- **PWA**: Fully installable Progressive Web App with offline manifest.

---

## 🚀 3. Core Feature Modules

### **A. Academic Management**
| Feature | Description |
|---------|-------------|
| **Smart Timetable** | AI-powered generator that assigns subjects, teachers, and rooms with conflict detection. |
| **Exam Seating** | Randomized seating planner with PDF export and student seat highlighting. |
| **Homework System** | Assignment creation, submission tracking, and deadline management. |
| **Library Management** | Book cataloging and issue/return tracking with history. |

### **B. AI & Learning (TTR-X1 Algorithm)**
- **TTRAI Chat**: Premium AI assistant for all users, featuring a ChatGPT-like floating interface.
- **Four-Way Learning**: Specialized learning modes (Conceptual, Fictional/TTR Universe, Storytelling, Teaching) to explain topics from different angles.
- **Risk Detector (Early Warning System)**: AI that analyzes attendance data to identify students at risk of dropout (Threshold: < 50% attendance).

### **C. Administration & Compliance**
- **Inspection Readiness**: A 50+ document checklist and compliance scoring system to help schools prepare for government inspections in minutes.
- **Fee Management**: Tracking of payments, pending dues, and receipt generation.
- **Admission System**: Multi-step student registration and approval workflow.

---

## 🎨 4. Recent UI/UX Updates (FEB 2026)
1. **Global Scrolling**: Enabled `overflow-y: auto` across all main content areas to fix navigation blocks.
2. **ChatGPT UI Refactor**: Redesigned all AI chat inputs to be floating, centered, and glass-morphic.
3. **Sticky Header**: Fixed the header visibility and added functional 3-lines (Left) and 3-dots (Right) menus.
4. **Mobile Responsiveness**: Implemented `100dvh` for full-screen reliability on mobile browsers.

---

## 🧪 5. Data Schema (Key Collections/Tables)

### **Firestore Collections:**
- `users`: `{ uid, email, role, name, pid, institutionId, class, section, approved }`
- `attendance`: `{ userId, date, status, subject, teacherId }`
- `ai_chats / sessions`: Persistent chat history for TTR AI.
- `groups / messages`: Real-time messaging for classes/teams.
- `student_allotments`: Linking teachers to students/classes.

### **MySQL Tables:**
- `users`: Mirrored auth data.
- `announcements`: Global and school-specific notices.
- `sessions`: Login session tracking.

---

## ⚠️ 6. Current Issues & Challenges (For Claude's Help)

### **1. Attendance Matching Reliability**
- **Issue**: The `Early Warning System` calculates risk based on attendance records, but sometimes the `userId` in `attendance` doesn't match the `id` from `student_allotments` (UID vs PID mismatch).
- **Goal**: Ensure a unified ID system for all student metrics.

### **2. PWA Installation UX**
- **Issue**: Some users report "Add to Home Screen" appears but the app doesn't show up in the app drawer.
- **Goal**: Debug `manifest.json` and service worker registration for edge cases on Android/iOS.

### **3. Search Navigation Bugs**
- **Issue**: Clicking a student from the global search results sometimes leads to a blank profile page.
- **Goal**: Standardize the `ProfileView.jsx` params and data fetching logic.

### **4. Large Database Migrations**
- **Issue**: Transitioning from Firebase-only to a Hybrid MySQL/Firebase model is causing intermittent data sync issues.
- **Goal**: Refine the "Context Bridge" scripts to ensure data parity.

### **5. API Key & Backend Stability**
- **Issue**: Intermittent "API Key Expired" errors in production (Vercel) despite working in preview. 
- **Goal**: Implement a robust server-side rotation or proxying strategy for the Gemini API.

### **6. Deployment Desync**
- **Issue**: Vercel production deployments sometimes behave differently than localhost regarding Firebase Authentication persistence.
- **Goal**: Standardize `UserContext.jsx` to handle serverless cold starts.

---

## 🎭 7. The TTR Character Universe
*Claude should reference these characters when generating educational content:*
- **Pranav (Proton)**: The positive leader, always at the center.
- **Esha (Electron)**: Fast, energetic, always on the move.
- **Neel (Neutron)**: The calm, neutral mediator.
- **Gajraj (Gravity)**: The heavy, wise giant who keeps everyone grounded.
- **Anu (Atom)**: The building block of everything.
- **Kabir (Carbon)**: The social "connector" of life.

---
*Documentation generated on 2026-02-12 for AI Collaboration.*
