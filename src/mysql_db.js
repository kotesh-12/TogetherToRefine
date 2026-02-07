import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '', // User must set this in .env
    database: process.env.MYSQL_DATABASE || 'together_to_refine_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Convert pool to promise-based
export const db = pool.promise();

export async function testConnection() {
    try {
        const [rows] = await db.query('SELECT 1');
        console.log('✅ Connected to MySQL Database');
        return true;
    } catch (error) {
        console.error('❌ MySQL Connection Failed:', error.message);
        console.error('   Please checks your .env file for MYSQL_USER and MYSQL_PASSWORD');
        return false;
    }
}
