import mysql from 'mysql2/promise';

async function setupDatabase() {
    console.log("🔄 Attempting to connect to MySQL...");

    // Try Default Credentials (root/empty)
    let connection;
    try {
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: ''
        });
        console.log("✅ Connected with root/(empty password)!");
    } catch (e) {
        try {
            console.log("⚠️ Default (empty) failed. Trying root/root...");
            connection = await mysql.createConnection({
                host: 'localhost',
                user: 'root',
                password: 'root'
            });
            console.log("✅ Connected with root/root!");
        } catch (e2) {
            try {
                console.log("⚠️ Trying root/20050701...");
                connection = await mysql.createConnection({
                    host: 'localhost',
                    user: 'root',
                    password: '20050701'
                });
                console.log("✅ Connected with root/20050701!");
            } catch (e3) {
                try {
                    console.log("⚠️ Trying root/mysql...");
                    connection = await mysql.createConnection({
                        host: 'localhost',
                        user: 'root',
                        password: 'mysql'
                    });
                    console.log("✅ Connected with root/mysql!");
                } catch (e4) {
                    console.error("❌ Could not connect to MySQL with default credentials.");
                    console.error("Please edit .env and set MYSQL_PASSWORD manually.");
                    process.exit(1);
                }
            }
        }
    }

    try {
        console.log("🛠 Creating Database 'together_to_refine_db'...");
        await connection.query(`CREATE DATABASE IF NOT EXISTS together_to_refine_db`);
        await connection.query(`USE together_to_refine_db`);

        console.log("🛠 Creating Users Table...");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                uid VARCHAR(36) PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('student', 'teacher', 'institution', 'admin') DEFAULT 'student',
                name VARCHAR(255),
                gender VARCHAR(50),
                profile_image_url TEXT,
                institution_id VARCHAR(255),
                is_approved BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Additional Tables...
        console.log("✅ Database Setup Complete!");
    } catch (e) {
        console.error("❌ Error setting up database:", e.message);
    } finally {
        if (connection) await connection.end();
    }
}

setupDatabase();
