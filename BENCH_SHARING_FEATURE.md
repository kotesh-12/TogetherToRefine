# Bench-Sharing Feature for Exam Seating

## Concept
Allow 2 students from DIFFERENT classes to sit together on the same bench during exams to prevent cheating.

## How It Works

### Example Scenario:
**Room 101** has 20 benches (40 seats total)
- 20 students from Class 10-A
- 20 students from Class 10-B

**Seating Arrangement:**
```
Bench 1: [Class 10-A Student] [Class 10-B Student]
Bench 2: [Class 10-A Student] [Class 10-B Student]
Bench 3: [Class 10-A Student] [Class 10-B Student]
...
Bench 20: [Class 10-A Student] [Class 10-B Student]
```

## Implementation Plan

### Step 1: Modify Student Loading
Instead of loading all students together, load them by class:
```javascript
const class10A_students = fetchStudentsFromClass("10-A");
const class10B_students = fetchStudentsFromClass("10-B");
```

### Step 2: Alternate Assignment
```javascript
for (let bench = 0; bench < numBenches; bench++) {
    // Left seat: Class A student
    assignSeat(bench * 2, class10A_students[bench]);
    
    // Right seat: Class B student  
    assignSeat(bench * 2 + 1, class10B_students[bench]);
}
```

### Step 3: Multiple Teachers
Each class group needs its own invigilator:
- Teacher A supervises Class 10-A students
- Teacher B supervises Class 10-B students
- Both teachers are assigned to the same room

## UI Changes Needed

### 1. Class Selection (Per Room)
```
Room 101 Configuration:
☑ Enable Bench Sharing
Select Classes:
  ☑ Class 10-A (20 students)
  ☑ Class 10-B (20 students)
```

### 2. Teacher Assignment (Per Class)
```
Invigilators for Room 101:
  Class 10-A: [Select Teacher ▼] → Mr. Sharma
  Class 10-B: [Select Teacher ▼] → Ms. Patel
```

### 3. Generated Plan Display
```
Room 101 (40 seats, 20 benches)
Invigilators: Mr. Sharma (10-A), Ms. Patel (10-B)

Bench 1:  [Rahul Kumar - 10-A]  [Priya Sharma - 10-B]
Bench 2:  [Amit Singh - 10-A]   [Neha Gupta - 10-B]
Bench 3:  [Vikram Joshi - 10-A] [Anjali Verma - 10-B]
...
```

## Benefits

1. **Anti-Cheating**: Students sitting together have different exam papers
2. **Space Efficient**: Use same room for multiple classes
3. **Flexible**: Can mix any number of classes (2, 3, or more)
4. **Fair Distribution**: Automatic alternating ensures even distribution

## Next Steps

1. Add "Enable Bench Sharing" toggle to room configuration
2. Add class selection dropdown for each room
3. Update generation logic to alternate students by class
4. Support multiple teacher assignments per room
5. Update PDF export to show class information

## Current Status
- ✅ Basic room configuration exists
- ✅ Student loading by class works
- ⏳ Need to add bench-sharing toggle
- ⏳ Need to add class selection UI
- ⏳ Need to update generation algorithm
