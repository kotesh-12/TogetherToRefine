# Parent-Student Connection Strategy

To allow Parents to view their children's progress, we need to link the **Parent Account** to the **Student Account**.

## Current Architecture
- **Student**: Has `name`, `institutionId`, `class`, `section`, etc.
- **Parent**: Has `name`, `email`, `phone`, etc.

## Problem
Currently, there is no direct link between a Parent and a Student.

## Solution: Phone Number Matching (Recommended)
The most user-friendly way to connect them is via **Phone Number Matching**.

### Workflow:
1.  **Student Profile Update**: 
    - Add a `parentPhone` field to the Student's profile during registration or profile update.
    - This is the "Key" that links them.

2.  **Parent Registration**:
    - When a Parent signs up, they provide their Phone Number.
    - The system queries the `users` (students) collection for any student where `parentPhone == parent.phoneNumber`.

3.  **Automatic Linking**:
    - Any matching students are automatically displayed on the Parent Dashboard.
    - No manual approval needed (assuming the Student provided the correct number).

### Implementation Steps

#### Step 1: Update Student Profile (Details.jsx)
- Add a field for `Parent/Guardian Phone Number`.
- Save this as `parentPhone` in the `users` collection.

#### Step 2: Update Parent Dashboard (ParentDashboard.jsx)
- Fetch the `parentPhone` of the logged-in Parent (from their profile).
- Query `users` collection: `where("parentPhone", "==", loggedInParentPhone)`.
- Display the list of matching students.

#### Step 3: Handling Multiple Children
- The query will return *all* students with the same `parentPhone`.
- This naturally handles siblings in the same or different schools.

## Security Considerations
- Ensure `parentPhone` is formatted consistently (e.g., remove spaces, dashes).
- Verify the phone number via OTP if possible (future enhancement). For now, trust the user entry.
