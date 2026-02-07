import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkConnection() {
    console.log("🔍 Diagnosing MySQL Connection...");

    const passwordsToTry = [
        process.env.MYSQL_PASSWORD, // Try what's in .env first
        '',                         // Try empty (XAMPP default)
        'root',                     // Common
        'password',                 // Common
        'admin',                    // Common
        '123456'                    // Common
    ];

    // Remove duplicates and undefined
    const uniquePasswords = [...new Set(passwordsToTry)].filter(p => p !== undefined);

    for (const pass of uniquePasswords) {
        console.log(`\n🔑 Trying password: '${pass}' ...`);
        try {
            const conn = await mysql.createConnection({
                host: 'localhost',
                user: 'root',
                password: pass
            });
            console.log("✅ SUCCESS! Connected with password:", `'${pass}'`);
            console.log("📝 Please update your .env file with this password if it's different.");
            await conn.end();
            return;
        } catch (e) {
            console.log("❌ Failed:", e.message);
        }
    }

    console.log("\n⚠️ Could not connect with any common passwords.");
    console.log("👉 Please verify your MySQL credentials.");
}

checkConnection();
