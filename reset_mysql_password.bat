
@echo off
set "MYSQL_BIN_DIR=C:\Program Files\MySQL\MySQL Server 8.0\bin"
set PATH=%MYSQL_BIN_DIR%;%PATH%

echo.
echo ===================================================
echo   MySQL PASSWORD RESET TOOL (By Together To Refine)
echo ===================================================
echo.
echo 1. Stopping MySQL Service...
net stop MySQL80 >nul 2>&1
net stop MySQL >nul 2>&1
taskkill /F /IM mysqld.exe >nul 2>&1

echo.
echo 2. Starting MySQL in Safe Mode...
start /b "" "%MYSQL_BIN_DIR%\mysqld.exe" --skip-grant-tables --shared-memory
timeout /t 5 >nul

echo.
echo 3. Resetting 'root' password to '20050701'...
"%MYSQL_BIN_DIR%\mysql.exe" -u root -e "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY '20050701'; FLUSH PRIVILEGES;"

if %errorlevel% neq 0 (
    echo.
    echo ❌ Direct ALTER failed. Trying legacy method...
    "%MYSQL_BIN_DIR%\mysql.exe" -u root -e "FLUSH PRIVILEGES; UPDATE mysql.user SET authentication_string=null WHERE User='root'; FLUSH PRIVILEGES;"
    "%MYSQL_BIN_DIR%\mysql.exe" -u root -e "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY '20050701'; FLUSH PRIVILEGES;"
)

echo.
echo 4. Stopping Safe Mode...
taskkill /F /IM mysqld.exe >nul 2>&1

echo.
echo 5. Starting MySQL Service normally...
net start MySQL80 >nul 2>&1
net start MySQL >nul 2>&1

echo.
echo ===================================================
echo ✅ DONE! Your MySQL password is set to: 20050701
echo ===================================================
echo.
echo 👉 Now try: 'node init_db.js' to setup your database.
echo.
pause
