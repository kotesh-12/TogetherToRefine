import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');

const passwordsToTry = [
    process.env.MYSQL_PASSWORD, // The current one in .env
    '20050701',                 // The one we tried to set
    '',                         // Empty (Default XAMPP/WAMP)
    'root',                     // Common default
    'password',                 // Common default
    'admin',                    // Common default
    '123456',                   // Common default
    '1234',                     // Common default
    'mysql'                     // Common default
];

async function findCorrectPassword() {
    console.log("🔍 Scanning for the correct MySQL password...");

    // Deduplicate
    const unique = [...new Set(passwordsToTry.filter(p => p !== undefined))];

    for (const pass of unique) {
        process.stdout.write(`   Testing '${pass}'... `);
        try {
            const conn = await mysql.createConnection({
                host: '127.0.0.1',
                user: 'root',
                password: pass
            });
            console.log("✅ SUCCESS!");
            await conn.end();

            // Detected! Update .env
            console.log(`\n🎉 FOUND IT! Your actual password is: '${pass}'`);

            if (pass !== process.env.MYSQL_PASSWORD) {
                console.log("📝 Updating .env file automatically...");
                let envContent = fs.readFileSync(envPath, 'utf8');

                // Regex to replace MYSQL_PASSWORD=...
                if (envContent.includes('MYSQL_PASSWORD=')) {
                    envContent = envContent.replace(/MYSQL_PASSWORD=.*/g, `MYSQL_PASSWORD=${pass}`);
                } else {
                    envContent += `\nMYSQL_PASSWORD=${pass}`;
                }

                fs.writeFileSync(envPath, envContent);
                console.log("✅ .env updated successfully.");
            } else {
                console.log("✅ .env is already correct.");
            }

            console.log("\n🚀 Now running database initialization...");
            // Run init_db.js
            try {
                // Determine path to init_db.js (assuming same directory)
                const initScript = path.join(__dirname, 'init_db.js');
                if (fs.existsSync(initScript)) {
                    const { execSync } = await import('child_process');
                    execSync(`node "${initScript}"`, { stdio: 'inherit' });
                }
            } catch (e) {
                console.error("Init script failed:", e.message);
            }

            return; // Exit after success
        } catch (e) {
            console.log("❌ Failed");
        }
    }

    console.log("\n⚠️ CRITICAL: None of the common passwords worked.");
    console.log("👉 You must reset your MySQL password manually.");
    console.log("   Open 'reset_mysql_password.bat' as Administrator one more time.");
}

findCorrectPassword();
