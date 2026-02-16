# Group Access Control System

## Overview
The group system now implements role-based access with subject-specific filtering for teachers.

## Access Rules

### 1. Students
- **Can see**: Only groups for their assigned class and section
- **Example**: A student in Class 10-A sees only Class 10-A groups
- **Filtering**: By `class` and `section` from student profile

### 2. Teachers
- **Can see**: Only groups for subjects they teach in a specific class
- **Example**: A Hindi teacher sees only "Hindi" groups for classes they're assigned to
- **Filtering**: By `class`, `section`, AND `subject` from `teacher_allotments`
- **Dynamic**: When teacher allotment changes, their group access updates automatically

### 3. Institution
- **Can see**: ALL groups in their institution
- **Filtering**: By `institutionId` only
- **Purpose**: Full oversight of all class communications

## How It Works

### For Teachers:
1. System fetches teacher's subjects from `teacher_allotments` collection
2. Filters groups to show only those matching:
   - The selected class
   - The selected section
   - One of the teacher's assigned subjects
3. If teacher is removed from a subject in allotments, they lose access to that subject's group

### Group Data Structure
Each group document should have:
```javascript
{
  groupName: "Class 10-A Hindi",
  className: "10",
  section: "A",
  subject: "Hindi",  // IMPORTANT: Must match subject in teacher_allotments
  institutionId: "inst_uid_123",
  createdBy: "inst_uid_123",
  members: ["student1", "student2", ...],
  teacherId: "teacher_uid" // Optional, for legacy support
}
```

### Teacher Allotment Structure
```javascript
{
  userId: "teacher_uid",
  subject: "Hindi",  // IMPORTANT: Must match group.subject
  className: "10",
  section: "A",
  institutionId: "inst_uid_123"
}
```

## Setup Instructions

### Step 1: Ensure Groups Have Subject Field
All groups must have a `subject` field that matches the subject name in `teacher_allotments`.

### Step 2: Verify Teacher Allotments
Ensure all teachers have proper allotments with:
- `userId` (teacher's UID)
- `subject` (exact subject name)
- `className` and `section`
- `institutionId`

### Step 3: Naming Convention
Use consistent subject names across:
- Group creation (group.subject)
- Teacher allotments (allotment.subject)
- Timetable entries

**Example:**
- ✅ Good: "Hindi", "Mathematics", "Science"
- ❌ Bad: "hindi", "Maths", "Sci" (inconsistent)

## Auto-Sync Behavior

When an institution:
1. **Changes teacher allotment**: Teacher automatically loses/gains access to groups
2. **Updates timetable**: No manual group update needed
3. **Removes teacher**: Teacher can no longer see those subject groups

## Benefits

1. **Security**: Teachers can't access groups for subjects they don't teach
2. **Privacy**: Subject-specific discussions remain private
3. **Automatic**: No manual group membership management
4. **Scalable**: Works for any number of subjects/classes
5. **Audit Trail**: Access is always based on current allotments

## Troubleshooting

### Teacher can't see any groups:
- Check if teacher has allotments in `teacher_allotments`
- Verify `subject` field matches between group and allotment
- Ensure `userId` in allotment matches teacher's UID

### Teacher sees all groups:
- Check if `subject` field exists in groups
- Verify subject matching logic (case-insensitive, normalized)

### Institution can't see groups:
- Verify `institutionId` field in groups matches institution UID
- Check Firestore security rules allow institution read access
