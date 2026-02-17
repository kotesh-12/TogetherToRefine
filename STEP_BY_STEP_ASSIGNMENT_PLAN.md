# Step-by-Step Bench Assignment System

## Implementation Plan

### Data Structure for Rooms
```javascript
{
  roomNo: 1,
  roomName: "Room 101",
  rows: 5,
  columns: 6,
  totalBenches: 30, // Each bench has 2 seats
  assignments: {
    left: {
      className: "10-A",
      students: [...],
      teacherId: "teacher1",
      teacherName: "Mr. Sharma"
    },
    right: {
      className: "10-B", 
      students: [...],
      teacherId: "teacher2",
      teacherName: "Ms. Patel"
    }
  }
}
```

### Workflow

#### 1. First Assignment
```
User: Assign Class 10-A to Room 101
System: "Room 101 has 30 benches (60 seats). Assign to:"
  [LEFT Side] [RIGHT Side] [BOTH Sides (Full Room)]
User: Selects "LEFT Side"
System: Assigns 30 students to left seats, assigns teacher
```

#### 2. Second Assignment
```
User: Assign Class 10-B to Room 101
System: "Room 101 Status:"
  - LEFT: Occupied by Class 10-A (30 students)
  - RIGHT: Available (30 seats)
  "Assign Class 10-B to RIGHT side?"
  [Yes, Assign to RIGHT] [Cancel]
User: Confirms
System: Assigns 30 students to right seats, assigns second teacher
```

#### 3. Third Assignment (Full)
```
User: Assign Class 10-C to Room 101
System: "❌ Room 101 is fully occupied"
  - LEFT: Class 10-A (30 students, Teacher: Mr. Sharma)
  - RIGHT: Class 10-B (30 students, Teacher: Ms. Patel)
  "Please select a different room or create a new room."
```

### UI Components Needed

1. **Room Assignment Dialog**
```jsx
<div className="room-assignment-modal">
  <h3>Assign {selectedClass} to {roomName}</h3>
  
  <div className="room-status">
    <div className="side-status">
      <span>LEFT Side:</span>
      {leftOccupied ? (
        <span className="occupied">
          {leftClass} ({leftCount} students)
        </span>
      ) : (
        <span className="available">Available</span>
      )}
    </div>
    
    <div className="side-status">
      <span>RIGHT Side:</span>
      {rightOccupied ? (
        <span className="occupied">
          {rightClass} ({rightCount} students)
        </span>
      ) : (
        <span className="available">Available</span>
      )}
    </div>
  </div>
  
  <div className="assignment-options">
    <button disabled={leftOccupied}>Assign to LEFT</button>
    <button disabled={rightOccupied}>Assign to RIGHT</button>
    <button disabled={leftOccupied || rightOccupied}>
      Assign to BOTH (Full Room)
    </button>
  </div>
</div>
```

2. **Teacher Assignment Per Side**
```jsx
<div className="teacher-assignment">
  {leftOccupied && (
    <div>
      <label>Teacher for {leftClass} (LEFT):</label>
      <select>
        {teachers.map(t => <option value={t.id}>{t.name}</option>)}
      </select>
    </div>
  )}
  
  {rightOccupied && (
    <div>
      <label>Teacher for {rightClass} (RIGHT):</label>
      <select>
        {teachers.map(t => <option value={t.id}>{t.name}</option>)}
      </select>
    </div>
  )}
</div>
```

3. **Final Seating Display**
```jsx
<div className="seating-plan">
  <h4>Room 101 - Seating Arrangement</h4>
  <p>Teachers: Mr. Sharma (10-A, LEFT) | Ms. Patel (10-B, RIGHT)</p>
  
  <table>
    <thead>
      <tr>
        <th>Bench</th>
        <th>LEFT Seat</th>
        <th>RIGHT Seat</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>Rahul Kumar (10-A)</td>
        <td>Priya Sharma (10-B)</td>
      </tr>
      <tr>
        <td>2</td>
        <td>Amit Singh (10-A)</td>
        <td>Neha Gupta (10-B)</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Key Functions

```javascript
// Check room availability
function checkRoomAvailability(roomNo) {
  const room = seatingPlan.find(r => r.roomNo === roomNo);
  return {
    leftAvailable: !room.assignments?.left,
    rightAvailable: !room.assignments?.right,
    fullyOccupied: room.assignments?.left && room.assignments?.right
  };
}

// Assign class to side
function assignClassToSide(roomNo, className, students, side, teacherId) {
  const room = seatingPlan.find(r => r.roomNo === roomNo);
  const teacher = teachers.find(t => t.id === teacherId);
  
  room.assignments[side] = {
    className,
    students: students.slice(0, room.totalBenches),
    teacherId,
    teacherName: teacher.name
  };
  
  // Generate bench-wise seating
  generateBenchSeating(room);
}

// Generate final bench layout
function generateBenchSeating(room) {
  const benches = [];
  const leftStudents = room.assignments.left?.students || [];
  const rightStudents = room.assignments.right?.students || [];
  
  for (let i = 0; i < room.totalBenches; i++) {
    benches.push({
      benchNo: i + 1,
      leftSeat: leftStudents[i] || null,
      rightSeat: rightStudents[i] || null
    });
  }
  
  room.benches = benches;
}
```

## Implementation Steps

1. ✅ Understand requirement
2. ⏳ Modify room data structure to support left/right assignments
3. ⏳ Create side selection UI
4. ⏳ Add availability checking logic
5. ⏳ Implement assignment function
6. ⏳ Update display to show bench-wise layout
7. ⏳ Add validation and alerts
