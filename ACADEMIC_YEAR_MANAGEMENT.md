# 🎓 Academic Year Management System

## 📋 Overview

This document outlines the comprehensive strategy for managing academic year transitions in the TogetherToRefine platform.

## 🎯 Core Concept: Academic Year Scoping

### **Database Structure Enhancement**

All academic data should be scoped by `academicYear` field:

```javascript
// Example: Student Record
{
  uid: "student_123",
  name: "Rahul Kumar",
  institutionId: "inst_456",
  
  // Current academic info
  academicYear: "2025-2026",
  class: "10",
  section: "A",
  rollNumber: "25",
  
  // Historical data preserved
  academicHistory: [
    {
      year: "2024-2025",
      class: "9",
      section: "B",
      rollNumber: "18",
      finalGrade: "A+",
      attendance: "95%"
    },
    {
      year: "2023-2024",
      class: "8",
      section: "A",
      rollNumber: "12",
      finalGrade: "A",
      attendance: "92%"
    }
  ]
}
```

## 🔄 Academic Year Transition Process

### **Phase 1: Pre-Transition (March-April)**

#### **1. Archive Current Year Data**
```javascript
// Collections to archive:
- timetables_2025_2026
- attendance_2025_2026
- exams_2025_2026
- assignments_2025_2026
- fee_records_2025_2026
- performance_reports_2025_2026
```

#### **2. Generate Final Reports**
- Student progress reports
- Teacher performance analytics
- Class-wise statistics
- Financial summaries
- Attendance summaries

#### **3. Mark Students for Promotion**
```javascript
{
  studentId: "student_123",
  currentClass: "9",
  currentSection: "A",
  promotionStatus: "promoted", // or "detained", "graduated"
  nextClass: "10",
  nextSection: "A", // Can be changed by admin
  academicYear: "2025-2026"
}
```

### **Phase 2: Transition (April-May)**

#### **1. Bulk Student Promotion**

**Admin Dashboard Feature:**
```
📊 Academic Year Transition
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Year: 2025-2026
New Year: 2026-2027

┌─────────────────────────────────────┐
│ Class-wise Promotion                │
├─────────────────────────────────────┤
│ Class 9A (45 students)              │
│ → Promote to: Class 10A ✓           │
│ → Detained: 2 students (manual)     │
│                                     │
│ Class 9B (42 students)              │
│ → Promote to: Class 10B ✓           │
│                                     │
│ Class 10A (40 students)             │
│ → Mark as Graduated ✓               │
│ → Move to Alumni                    │
└─────────────────────────────────────┘

[Preview Changes] [Execute Promotion]
```

**Backend Logic:**
```javascript
async function promoteStudents(institutionId, transitions) {
  const batch = writeBatch(db);
  
  for (const transition of transitions) {
    const { studentId, fromClass, toClass, status } = transition;
    
    // Update student record
    const studentRef = doc(db, 'users', studentId);
    
    if (status === 'promoted') {
      batch.update(studentRef, {
        // Archive current year
        [`academicHistory.${currentYear}`]: {
          class: fromClass,
          section: currentSection,
          // ... other data
        },
        
        // Update to new year
        academicYear: newYear,
        class: toClass,
        section: newSection,
        rollNumber: newRollNumber
      });
    } else if (status === 'graduated') {
      batch.update(studentRef, {
        role: 'alumni',
        graduationYear: currentYear,
        lastClass: fromClass
      });
    } else if (status === 'detained') {
      // Stay in same class
      batch.update(studentRef, {
        academicYear: newYear,
        // class remains same
      });
    }
  }
  
  await batch.commit();
}
```

#### **2. Archive Groups**
```javascript
// Option A: Archive old groups
async function archiveYearGroups(year) {
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where('academicYear', '==', year));
  const snapshot = await getDocs(q);
  
  snapshot.forEach(async (doc) => {
    await setDoc(doc.ref, {
      archived: true,
      archivedAt: new Date().toISOString()
    }, { merge: true });
  });
}

// Option B: Create new groups for new year
// Old groups remain accessible for history
```

#### **3. Reset Timetables**
```javascript
// Timetables are year-specific
// Old: timetables (academicYear: "2025-2026")
// New: timetables (academicYear: "2026-2027")
// Institutions regenerate timetables for new year
```

#### **4. Reset Attendance**
```javascript
// Attendance records are year-scoped
// Historical data preserved in:
attendance_2025_2026 (archived)
attendance_2026_2027 (new, empty)
```

### **Phase 3: New Year Setup (June)**

#### **1. New Admissions**
- Fresh students join Class 1, 6, 9, etc.
- Assigned to sections
- Added to groups

#### **2. Teacher Reassignments**
- Teachers may change subjects/classes
- Update teacher_allotments for new year
- Groups updated automatically

#### **3. New Timetable Generation**
- Use AI generator for each class
- New groups created automatically

## 🏗️ Implementation Plan

### **Database Schema Updates**

#### **1. Add Academic Year Field**
```javascript
// Update all collections:
users: {
  academicYear: "2026-2027",
  academicHistory: { ... }
}

timetables: {
  academicYear: "2026-2027",
  // ... rest of fields
}

attendance: {
  academicYear: "2026-2027",
  // ... rest of fields
}

groups: {
  academicYear: "2026-2027",
  archived: false
}

exams: {
  academicYear: "2026-2027",
  // ... rest of fields
}
```

#### **2. Institution Settings**
```javascript
institutions: {
  currentAcademicYear: "2026-2027",
  academicYearHistory: [
    "2025-2026",
    "2024-2025",
    "2023-2024"
  ],
  yearStartMonth: 6, // June
  yearEndMonth: 3    // March
}
```

### **UI Features to Add**

#### **1. Academic Year Selector**
```jsx
// In Institution Dashboard
<select value={currentYear} onChange={handleYearChange}>
  <option value="2026-2027">2026-2027 (Current)</option>
  <option value="2025-2026">2025-2026 (Archive)</option>
  <option value="2024-2025">2024-2025 (Archive)</option>
</select>
```

#### **2. Year Transition Wizard**
```
Step 1: Review Current Year
  ✓ 450 students
  ✓ 25 teachers
  ✓ 12 classes

Step 2: Configure Promotions
  → Class 9A → Class 10A (auto)
  → Class 10A → Alumni (graduated)
  → Manual adjustments

Step 3: Archive Data
  ✓ Timetables archived
  ✓ Attendance archived
  ✓ Reports generated

Step 4: Setup New Year
  → New academic year: 2026-2027
  → Reset attendance
  → Clear timetables
  → Preserve groups (optional)

Step 5: Execute Transition
  [Start Transition] (irreversible)
```

#### **3. Alumni Portal**
```javascript
// Graduated students become alumni
{
  role: "alumni",
  graduationYear: "2026",
  lastClass: "10",
  lastSection: "A",
  
  // Limited access:
  canView: ["certificates", "transcripts", "alumni_groups"],
  cannotView: ["current_timetables", "current_attendance"]
}
```

## 📊 Data Retention Strategy

### **What to Keep Forever:**
- ✅ Student academic history
- ✅ Final grades/reports
- ✅ Certificates
- ✅ Fee payment records
- ✅ Attendance summaries

### **What to Archive (Read-only):**
- 📦 Old timetables
- 📦 Daily attendance records
- 📦 Old assignments
- 📦 Old announcements
- 📦 Old groups (optional)

### **What to Reset:**
- 🔄 Current timetables
- 🔄 Active attendance
- 🔄 Ongoing assignments
- 🔄 Current groups (or create new)

## 🎯 Recommended Workflow

### **Annual Cycle:**

**March-April (End of Year)**
1. Generate final reports
2. Mark students for promotion/detention
3. Archive year data

**April-May (Transition)**
1. Execute bulk promotion
2. Graduate Class 10 students
3. Archive old groups
4. Reset timetables

**June (New Year Start)**
1. New admissions
2. Generate new timetables
3. Create new groups
4. Start fresh attendance

**July-March (Academic Year)**
1. Regular operations
2. Track attendance
3. Conduct exams
4. Generate progress reports

## 💡 Best Practices

### **1. Gradual Rollout**
- Don't delete old data
- Keep archives accessible
- Test promotion logic thoroughly

### **2. Backup Before Transition**
```bash
# Full database backup before year transition
firebase backup --project together-to-refine
```

### **3. Rollback Plan**
```javascript
// Keep promotion log for rollback
{
  transitionId: "trans_2026",
  executedAt: "2026-04-15",
  executedBy: "admin_123",
  changes: [
    { studentId: "s1", from: "9A", to: "10A" },
    { studentId: "s2", from: "9A", to: "10A" }
  ],
  status: "completed",
  rollbackAvailable: true
}
```

### **4. Communication**
- Notify parents about promotion
- Email students about new class
- Inform teachers about changes

## 🚀 Implementation Priority

### **Phase 1 (Immediate - 2 weeks)**
1. Add `academicYear` field to all collections
2. Add year selector in dashboard
3. Filter all queries by current year

### **Phase 2 (Short-term - 1 month)**
1. Build promotion wizard UI
2. Implement bulk promotion logic
3. Add archive functionality

### **Phase 3 (Medium-term - 2 months)**
1. Alumni portal
2. Historical data viewer
3. Multi-year reports

### **Phase 4 (Long-term - 3 months)**
1. Automated year transition
2. Advanced analytics across years
3. Predictive insights

## 📝 Example: Complete Transition

### **Before (March 2026):**
```
Student: Rahul Kumar
Class: 9A
Academic Year: 2025-2026
Groups: [Maths (9-A), Physics (9-A), ...]
```

### **After (June 2026):**
```
Student: Rahul Kumar
Class: 10A (promoted)
Academic Year: 2026-2027
Groups: [Maths (10-A), Physics (10-A), ...] (new)

Academic History:
  2025-2026: Class 9A, Grade: A+, Attendance: 95%
  2024-2025: Class 8B, Grade: A, Attendance: 92%
```

### **Archived Data:**
```
timetables_2025_2026/
  class_9_section_A: { ... }

attendance_2025_2026/
  student_rahul: { total: 95% }

groups_archived/
  Maths (9-A): { archived: true, members: [...] }
```

## 🎉 Benefits

1. **Clean Slate**: New year starts fresh
2. **Historical Data**: All past data preserved
3. **Easy Reporting**: Compare year-over-year
4. **Alumni Tracking**: Graduated students tracked
5. **Scalability**: System grows with institution
6. **Compliance**: Meet data retention requirements

## 🔐 Security Considerations

- Only admins can execute year transition
- Require confirmation before promotion
- Log all changes for audit
- Backup before major operations
- Test on staging environment first

---

**This system ensures smooth academic year transitions while preserving all historical data!** 🎓
