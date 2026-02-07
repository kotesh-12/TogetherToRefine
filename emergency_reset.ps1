if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "Requesting Admin Privileges..."
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   MySQL EMERGENCY RESET TOOL            " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Stop Services
Write-Host "`n1. Stopping MySQL Services..." -ForegroundColor Yellow
Stop-Service MySQL80 -Force -ErrorAction SilentlyContinue
Stop-Service MySQL -Force -ErrorAction SilentlyContinue
Stop-Process -Name mysqld -Force -ErrorAction SilentlyContinue

# 2. Prepare Reset File
$resetFile = "c:\Users\hp\.vscode\TogetherToRefine\reset_commands.sql"
if (!(Test-Path $resetFile)) {
    Write-Error "ERROR: Could not find reset_commands.sql at $resetFile"
    Read-Host "Press Enter to exit"
    exit
}

# 3. Locate Binaries and Config
$mysqld = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe"
$defaults = "C:\ProgramData\MySQL\MySQL Server 8.0\my.ini" 

if (!(Test-Path $mysqld)) {
    Write-Error "ERROR: Could not find mysqld.exe at $mysqld"
    Read-Host "Press Enter to exit"
    exit
}

if (!(Test-Path $defaults)) {
    Write-Warning "WARNING: Could not find my.ini at $defaults. Trying without defaults..."
    $args = "--init-file=`"$resetFile`""
}
else {
    $args = "--defaults-file=`"$defaults`"", "--init-file=`"$resetFile`""
}


# 4. Start MySQL with Init File
Write-Host "2. Starting MySQL with Reset File..." -ForegroundColor Yellow
Write-Host "   (This runs silently in the background...)"
$proc = Start-Process -FilePath $mysqld -ArgumentList $args -PassThru -WindowStyle Hidden

Write-Host "   Waiting 15 seconds for reset to apply..."
Start-Sleep -Seconds 15

# 5. Stop the Temporary Instance
Write-Host "3. Stopping Temporary MySQL Instance..." -ForegroundColor Yellow
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Name mysqld -Force -ErrorAction SilentlyContinue

# 6. Restart Normal Service
Write-Host "4. Restarting Normal Service..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Start-Service MySQL80 -ErrorAction SilentlyContinue
Start-Service MySQL -ErrorAction SilentlyContinue

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host "   DONE! Password reset attempted.       " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Read-Host "Press Enter to close this window"
