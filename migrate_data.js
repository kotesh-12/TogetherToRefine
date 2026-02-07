import { db as firestore } from './src/firebase.js';
import { collection, getDocs } from 'firebase/firestore';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

async function migrate() {
    console.log("🚀 Starting Migration: Firestore -> MySQL");

    // 1. MySQL Connection
    const mysqlConfig = {
        host: process.env.MYSQL_HOST || '127.0.0.1',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE || 'together_to_refine_db'
    };

    let connection;
    try {
        connection = await mysql.createConnection(mysqlConfig);
        console.log("✅ MySQL Connected");
    } catch (e) {
        console.error("❌ MySQL Connection Failed:", e.message);
        console.error("   Check .env for MYSQL_PASSWORD");
        return;
    }

    // 2. Migrate Users
    console.log("📦 Migrating Users...");
    const userSnapshot = await getDocs(collection(firestore, "users"));
    console.log(`   Found ${userSnapshot.size} users in Firestore.`);

    for (const doc of userSnapshot.docs) {
        const data = doc.data();
        const uid = doc.id;
        const email = data.email || `no-email-${uid}@temp.com`;

        // Default password for migrated users (user must reset)
        const dummyHash = await bcrypt.hash("ChangeMe123!", 10);

        try {
            // Check if exists
            const [exists] = await connection.query("SELECT uid FROM users WHERE uid = ?", [uid]);
            if (exists.length === 0) {
                await connection.query(
                    "INSERT INTO users (uid, email, password_hash, role, name, gender, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [uid, email, dummyHash, data.role || 'student', data.name || 'Unknown', data.gender || 'Other', data.approved !== false]
                );
                console.log(`   + Migrated User: ${data.name} (${data.role})`);
            } else {
                console.log(`   . Skipping ${data.name} (Already exists)`);
            }

            // Role Specific Data
            if (data.role === 'student') {
                const [sExists] = await connection.query("SELECT user_id FROM students WHERE user_id = ?", [uid]);
                if (sExists.length === 0) {
                    await connection.query(
                        "INSERT INTO students (user_id, class_level, section, institution_id) VALUES (?, ?, ?, ?)",
                        [uid, data.class || null, data.section || null, data.institutionId || null]
                    );
                }
            } else if (data.role === 'teacher') {
                const [tExists] = await connection.query("SELECT user_id FROM teachers WHERE user_id = ?", [uid]);
                if (tExists.length === 0) {
                    await connection.query(
                        "INSERT INTO teachers (user_id, subject, assigned_class, assigned_section, institution_id) VALUES (?, ?, ?, ?, ?)",
                        [uid, data.subject || null, data.assignedClass || null, data.assignedSection || null, data.institutionId || null]
                    );
                }
            } else if (data.role === 'institution') {
                const [iExists] = await connection.query("SELECT user_id FROM institutions WHERE user_id = ?", [uid]);
                if (iExists.length === 0) {
                    await connection.query(
                        "INSERT INTO institutions (user_id, school_name, address) VALUES (?, ?, ?)",
                        [uid, data.schoolName || data.name, data.address || null]
                    );
                }
            }

        } catch (err) {
            console.error(`   ❌ Error migrating ${data.name}:`, err.message);
        }
    }

    // 3. Migrate Announcements
    console.log("📦 Migrating Announcements...");
    const annSnapshot = await getDocs(collection(firestore, "announcements"));
    console.log(`   Found ${annSnapshot.size} announcements.`);

    for (const doc of annSnapshot.docs) {
        const data = doc.data();
        try {
            // Basic deduplication check by text + author (imperfect but functional)
            const [exists] = await connection.query("SELECT id FROM announcements WHERE text = ? AND author_id = ? LIMIT 1", [data.text, data.authorId]);

            if (exists.length === 0) {
                await connection.query(
                    "INSERT INTO announcements (text, type, author_id, author_name, target_class, target_section) VALUES (?, ?, ?, ?, ?, ?)",
                    [data.text, data.type || 'global', data.authorId, data.authorName, data.targetClass || 'All', data.targetSection || 'All']
                );
                console.log(`   + Migrated Announcement: "${data.text.substring(0, 20)}..."`);
            }
        } catch (err) {
            console.error(`   ❌ Announcement Error:`, err.message);
        }
    }

    console.log("✅ Migration Complete!");
    await connection.end();
    process.exit(0);
}

migrate();
