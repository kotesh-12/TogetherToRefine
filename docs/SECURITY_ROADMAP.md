# Security Enhancement Roadmap: User Identity & Session Control

## Objective
To differentiate between a **Trusted User** ("Him") and an **Untrusted Actor** ("Friend" or Public Device) and apply appropriate security measures to prevent unauthorized long-term access.

## Identification Strategies (How to tell "Him" vs "Friend")

### 1. Device Fingerprinting ("The Unknown Device Trigger")
*   **Mechanism:** Compare current login metadata against a history of "Known Devices".
*   **Data Points:** Browser Name/Version, OS, Screen Resolution, User Agent.
*   **Logic:**
    *   **Trusted:** Matches a device in the `users/{uid}/sessions` history with >10 prior logins.
    *   **Untrusted:** No matching fingerprint found in history.

### 2. Geofencing & IP Analysis
*   **Mechanism:** Analyze the request IP address.
*   **Logic:**
    *   **Trusted:** Matches the user's "Home" IP or frequent location.
    *   **Untrusted:** New City, Country, or ISP.

### 3. Explicit User Input
*   **Mechanism:** Add a "Public/Shared Computer" checkbox on login.
*   **Logic:** If checked, treat immediately as "Untrusted" (Short session, no "Remember Me").

---

## Action Protocols (Orders for Implementation)

### Option A: The "Alert" Protocol (Standard)
*   **Trigger:** New Device Detected.
*   **Action:** Send email: *"New login detected. Was this you?"*
*   **User Option:** Click "No, Sign me out" in email to kill the session remotely.

### Option B: The "Paranoid" Protocol (Short Leash)
*   **Trigger:** Untrusted/New Device.
*   **Action:** Force auto-logout after fixed duration (e.g., 20 mins) UNLESS user actively verifies the device.
*   **Use Case:** Library computers, borrowing a friend's phone.

### Option C: The "Lockdown" Protocol (2-Step Verification) - **RECOMMENDED**
*   **Trigger:** New Device Detected.
*   **Action:** Block access immediately after password entry.
*   **Requirement:** User must enter a 6-digit code sent to their registered email to proceed.
*   **Benefit:** Prevents access even if the "Friend" knows the password.

## Implementation Notes
*   **Current Status:** Session Management (Remote Logout) is implemented.
*   **Next Steps:**
    1.  Add `knownDevices` collection to User profile.
    2.  Implement "Device Fingerprint" comparison logic on Login.
    3.  Build Email Trigger system (Firebase Functions or similar).
