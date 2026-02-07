# MySQL Setup Guide (Updated)

## ❌ Issue: Incorrect Password
It seems your MySQL password is not `20050701` (or any common default).
Since you cannot login, you must reset the "root" password.

## ✅ Solution: Reset Password Script
We have created a script to fix this automatically.

### Step 1: Run the Reset Script
1.  Open File Explorer to this folder: `c:\Users\hp\.vscode\TogetherToRefine`
2.  Right-click on **`reset_mysql_password.bat`**.
3.  Select **"Run as Administrator"**.
4.  Wait for it to finish. It will set your password to: **`20050701`**.

### Step 2: Verify Connection
1.  Open a new terminal.
2.  Run: `node init_db.js`
3.  If successful, you will see "Database is ready!"

### Step 3: Migrate Data (Optional)
1.  Run: `node migrate_data.js`
2.  This copies your old Firebase users to MySQL.

### Step 4: Start Server
1.  Run: `npm run server`
2.  Go to `http://localhost:5173` and login!
