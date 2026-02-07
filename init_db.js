import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDB() {
    console.log("🚀 Initializing MySQL Database...");

    // 1. Connect to MySQL Server (No DB selected yet)
    const connectionConfig = {
        host: process.env.MYSQL_HOST || '127.0.0.1', // Enforce IPv4
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD,
        multipleStatements: true
    };

    let connection;
    try {
        console.log(`🔌 Connecting to ${connectionConfig.host}...`);
        connection = await mysql.createConnection(connectionConfig);
        console.log("✅ Keep-Alive! Connected to MySQL Server!");

        // 2. Read SQL Files
        const schemaPath = path.join(__dirname, 'mysql_schema.sql');
        const extendedSchemaPath = path.join(__dirname, 'mysql_schema_extended.sql');

        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        const extendedSql = fs.readFileSync(extendedSchemaPath, 'utf8');

        // 3. Execute Schema
        console.log("🛠 Executing Core Schema...");
        await connection.query(schemaSql);
        console.log("✅ Core Schema Applied.");

        console.log("🛠 Executing Extended Schema...");
        await connection.query(extendedSql);
        console.log("✅ Extended Schema Applied.");

        console.log("\n🎉 Database 'together_to_refine_db' is ready!");
        console.log("👉 Next: Restart server with 'npm run server'");

    } catch (e) {
        console.error("❌ Database Initialization Failed:", e.message);
        if (e.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error("   ⚠️ PASSWORD ERROR: The password in .env is incorrect.");
            console.error("   Check 'reset_mysql_password.bat' to reset it.");
        } else if (e.code === 'ECONNREFUSED') {
            console.error("   ⚠️ CONNECTION ERROR: MySQL is not running on port 3306.");
            console.error("   Open Task Manager -> Services -> Start 'MySQL80'");
        }
    } finally {
        if (connection) await connection.end();
    }
}

initDB();
