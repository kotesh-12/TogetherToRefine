-- EXTENDED SCHEMA FOR FULL MIGRATION

-- 1. ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    student_id VARCHAR(255),
    student_name VARCHAR(255),
    class_level VARCHAR(50),
    section VARCHAR(10),
    status ENUM('Present', 'Absent', 'Late') DEFAULT 'Present',
    marked_by VARCHAR(255), -- Teacher ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(uid)
);

-- 2. TIMETABLES
CREATE TABLE IF NOT EXISTS timetables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_level VARCHAR(50),
    section VARCHAR(10),
    day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
    period_number INT,
    subject VARCHAR(100),
    teacher_id VARCHAR(255),
    start_time TIME,
    end_time TIME,
    institution_id VARCHAR(255),
    FOREIGN KEY (teacher_id) REFERENCES users(uid)
);

-- 3. TEACHER ALLOTMENTS
CREATE TABLE IF NOT EXISTS allotments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id VARCHAR(255),
    class_assigned VARCHAR(50),
    section VARCHAR(10),
    subject VARCHAR(100),
    institution_id VARCHAR(255),
    FOREIGN KEY (teacher_id) REFERENCES users(uid)
);

-- 4. EXAMS/RESULTS (Future Proofing)
CREATE TABLE IF NOT EXISTS exams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_name VARCHAR(255),
    class_level VARCHAR(50),
    subject VARCHAR(100),
    date DATE,
    institution_id VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT,
    student_id VARCHAR(255),
    marks_obtained DECIMAL(5,2),
    total_marks DECIMAL(5,2),
    FOREIGN KEY (exam_id) REFERENCES exams(id),
    FOREIGN KEY (student_id) REFERENCES users(uid)
);
