# ─── Employee Monitor Auto Deploy Script ─────────────────────────────────────
# Run this on admin machine to build and push to all employee laptops
# Uses ZeroTier network - works regardless of WiFi IP changes

$AgentDir = "C:\Projects\Employee Tracker\agent"
$DistExe  = "$AgentDir\dist\EmployeeMonitor.exe"
$Port     = 8080
$AdminIP  = "10.15.155.40"   # Admin machine ZeroTier IP

# ─── List of employee laptop ZeroTier IPs ─────────────────────────────────────
# To add more employees: add their ZeroTier IP below (from my.zerotier.com)
$EmployeeLaptops = @(
    "10.15.155.170"   # Employee laptop 1
    # "10.15.155.xxx" # Employee laptop 2 - add ZeroTier IP here
    # "10.15.155.xxx" # Employee laptop 3 - add ZeroTier IP here
)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Employee Monitor Deploy Script" -ForegroundColor Cyan
Write-Host "  Admin ZeroTier IP: $AdminIP" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Step 1 - Kill running agent on admin machine
Write-Host "`n[1/4] Stopping agent on admin machine..." -ForegroundColor Yellow
Get-Process EmployeeMonitor -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Step 2 - Delete old exe and rebuild
Write-Host "[2/4] Rebuilding exe..." -ForegroundColor Yellow
Remove-Item $DistExe -Force -ErrorAction SilentlyContinue
Set-Location $AgentDir
pyinstaller --onefile --noconsole --name EmployeeMonitor agent.py | Out-Null

if (-not (Test-Path $DistExe)) {
    Write-Host "ERROR: Build failed! Exe not found." -ForegroundColor Red
    exit 1
}

$ts = (Get-Item $DistExe).LastWriteTime
Write-Host "Build successful: $ts" -ForegroundColor Green

# Step 3 - Start HTTP server in background
Write-Host "[3/4] Starting HTTP server on port $Port..." -ForegroundColor Yellow
$ServerJob = Start-Job -ScriptBlock {
    param($dir, $port)
    Set-Location $dir
    python -m http.server $port
} -ArgumentList "$AgentDir\dist", $Port
Start-Sleep -Seconds 2

# Step 4 - Push to all employee laptops
Write-Host "[4/4] Pushing to employee laptops..." -ForegroundColor Yellow

foreach ($ip in $EmployeeLaptops) {
    Write-Host "  -> Pushing to $ip..." -ForegroundColor White
    try {
        # Try SMB push first
        $dest = "\\$ip\F$\EmployeeMonitor.exe"
        if (Test-Path "\\$ip\F$") {
            Copy-Item $DistExe $dest -Force
            Write-Host "    SUCCESS: Pushed via SMB to $ip" -ForegroundColor Green
        } else {
            Write-Host "    WARNING: SMB not available - employee must pull manually" -ForegroundColor Yellow
            Write-Host "    Run on employee laptop:" -ForegroundColor Gray
            Write-Host "    Invoke-WebRequest 'http://$AdminIP`:$Port/EmployeeMonitor.exe' -OutFile 'F:\EmployeeMonitor.exe'" -ForegroundColor Gray
        }
    } catch {
        Write-Host "    FAILED: Could not push to $ip" -ForegroundColor Red
        Write-Host "    Run on employee laptop:" -ForegroundColor Gray
        Write-Host "    Invoke-WebRequest 'http://$AdminIP`:$Port/EmployeeMonitor.exe' -OutFile 'F:\EmployeeMonitor.exe'" -ForegroundColor Gray
    }
}

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "  HTTP server running on port $Port" -ForegroundColor Cyan
Write-Host "  Employee pull command:" -ForegroundColor Cyan
Write-Host "  Invoke-WebRequest 'http://$AdminIP`:$Port/EmployeeMonitor.exe' -OutFile 'F:\EmployeeMonitor.exe'" -ForegroundColor White
Write-Host "  Press ENTER to stop server and restart admin agent" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Read-Host

# Stop HTTP server
Stop-Job $ServerJob
Remove-Job $ServerJob

# Restart admin agent
Write-Host "Restarting admin agent..." -ForegroundColor Yellow
Start-Process $DistExe
Write-Host "Done!" -ForegroundColor Green
