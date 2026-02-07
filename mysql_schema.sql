-- Database Initialization
CREATE DATABASE IF NOT EXISTS together_to_refine_db;
USE together_to_refine_db;

-- Users Table (Base for all roles)
CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(255) PRIMARY KEY, -- We will generate UUIDs or keep Firebase UIDs if migrating
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Bcrypt hash
    role ENUM('student', 'teacher', 'institution', 'admin') NOT NULL,
    name VARCHAR(255),
    gender VARCHAR(50),
    profile_image_url TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students Table
CREATE TABLE IF NOT EXISTS students (
    user_id VARCHAR(255),
    class_level VARCHAR(50),
    section VARCHAR(10),
    roll_number VARCHAR(50),
    institution_id VARCHAR(255), -- Link to their school
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
);

-- Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
    user_id VARCHAR(255),
    subject VARCHAR(100),
    assigned_class VARCHAR(50), -- Main class responsibility
    assigned_section VARCHAR(10),
    institution_id VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
);

-- Institutions Table
CREATE TABLE IF NOT EXISTS institutions (
    user_id VARCHAR(255),
    school_name VARCHAR(255),
    address TEXT,
    contact_number VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
);

-- Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    text TEXT NOT NULL,
    type ENUM('global', 'institution', 'class') DEFAULT 'global',
    author_id VARCHAR(255),
    author_name VARCHAR(255),
    target_class VARCHAR(50) DEFAULT 'All',
    target_section VARCHAR(50) DEFAULT 'All',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(uid)
);

-- Sessions Table (For persistent login management if not using JWT only)
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
);
