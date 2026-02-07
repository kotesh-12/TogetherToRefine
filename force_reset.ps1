if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "Requesting Admin Privileges..."
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   MySQL FORCE PASSWORD RESET TOOL       " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Stop Services
Write-Host "`n1. Stopping MySQL Services..." -ForegroundColor Yellow
Stop-Service MySQL80 -Force -ErrorAction SilentlyContinue
Stop-Service MySQL -Force -ErrorAction SilentlyContinue
Stop-Process -Name mysqld -Force -ErrorAction SilentlyContinue

# 2. Start Safe Mode
Write-Host "2. Starting MySQL in Safe Mode..." -ForegroundColor Yellow
$localPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin"
$mysqld = "$localPath\mysqld.exe"
$mysql  = "$localPath\mysql.exe"

if (!(Test-Path $mysqld)) {
    Write-Error "ERROR: Could not find mysqld.exe at $mysqld"
    Read-Host "Press Enter to exit"
    exit
}

Start-Process -FilePath $mysqld -ArgumentList "--skip-grant-tables", "--shared-memory" -WindowStyle Hidden
Write-Host "   Waiting for Safe Mode to initialize..."
Start-Sleep -Seconds 8

# 3. Reset Password
Write-Host "3. Resetting Password to '20050701'..." -ForegroundColor Yellow

# Try Method A (Recent MySQL 8+)
& $mysql -u root -e "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY '20050701'; FLUSH PRIVILEGES;" 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "   Method A failed, trying Method B (Legacy)..."
    & $mysql -u root -e "FLUSH PRIVILEGES; UPDATE mysql.user SET authentication_string=null WHERE User='root'; FLUSH PRIVILEGES;"
    & $mysql -u root -e "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY '20050701'; FLUSH PRIVILEGES;"
}

# 4. Restart Normal Service
Write-Host "4. Restarting Normal Service..." -ForegroundColor Yellow
Stop-Process -Name mysqld -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Service MySQL80 -ErrorAction SilentlyContinue
Start-Service MySQL -ErrorAction SilentlyContinue

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host "   SUCCESS! Password is set to: 20050701 " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Read-Host "Press Enter to close this window"
