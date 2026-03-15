# ============================================================
# deploy-vps.ps1 - Push changes to GitHub + Deploy to VPS
#
# Usage from PowerShell:
#   .\deploy-vps.ps1              -> push GitHub + deploy ALL
#   .\deploy-vps.ps1 -github      -> push to GitHub only
#   .\deploy-vps.ps1 -backend     -> push GitHub + restart backend
#   .\deploy-vps.ps1 -portal      -> push GitHub + rebuild company portal
#   .\deploy-vps.ps1 -dashboard   -> push GitHub + rebuild frontend dashboard
#   .\deploy-vps.ps1 -admin       -> push GitHub + rebuild admin dashboard
#   .\deploy-vps.ps1 -status      -> check all live URLs
# ============================================================

param(
    [switch]$github,
    [switch]$backend,
    [switch]$portal,
    [switch]$dashboard,
    [switch]$admin,
    [switch]$status
)

$VPS_IP   = "194.163.143.160"
$VPS_USER = "root"
$PROJECT  = "C:\Projects\Employee Tracker"

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "    [FAIL] $msg" -ForegroundColor Red }

# ── PUSH TO GITHUB ─────────────────────────────────────────
function Push-Github {
    Write-Step "Pushing to GitHub..."
    Set-Location $PROJECT
    git add .
    $msg = Read-Host "    Commit message (Enter = 'Update')"
    if (-not $msg) { $msg = "Update" }
    git commit -m $msg 2>&1 | Out-Null
    git push origin main
    if ($LASTEXITCODE -eq 0) { Write-OK "Pushed to GitHub successfully" }
    else { Write-Fail "Git push failed - check credentials" }
}

# ── RUN COMMAND ON VPS VIA SSH ─────────────────────────────
function SSH($cmd) {
    ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${VPS_USER}@${VPS_IP}" $cmd
}

# ── PULL LATEST CODE ON VPS ────────────────────────────────
function Pull-VPS {
    Write-Step "Pulling latest code on VPS..."
    SSH "cd /var/www/employee-tracker && git pull origin main"
    Write-OK "VPS code updated"
}

# ── DEPLOY BACKEND ─────────────────────────────────────────
function Deploy-Backend {
    Write-Step "Deploying Backend (api.monitorhub.live)..."
    SSH "cd /var/www/employee-tracker/backend && npm install --silent"
    SSH "pm2 restart backend"
    Write-OK "Backend restarted"
}

# ── DEPLOY COMPANY PORTAL ──────────────────────────────────
function Deploy-Portal {
    Write-Step "Deploying Company Portal (monitorhub.live)..."
    SSH "cd /var/www/employee-tracker/company-portal && npm install --silent && npm run build"
    SSH "pm2 restart company-portal"
    Write-OK "Company Portal deployed"
}

# ── DEPLOY FRONTEND DASHBOARD ──────────────────────────────
function Deploy-Dashboard {
    Write-Step "Deploying Frontend Dashboard (app.monitorhub.live)..."
    SSH "cd /var/www/employee-tracker/Frontend && npm install --silent && npm run build"
    SSH "pm2 restart frontend-dashboard"
    Write-OK "Frontend Dashboard deployed"
}

# ── DEPLOY ADMIN DASHBOARD ─────────────────────────────────
function Deploy-Admin {
    Write-Step "Deploying Admin Dashboard (admin.monitorhub.live)..."
    SSH "cd '/var/www/employee-tracker/Master Admin Dashboard' && npm install --silent && npm run build"
    SSH "pm2 restart admin-dashboard"
    Write-OK "Admin Dashboard deployed"
}

# ── CHECK LIVE STATUS ──────────────────────────────────────
function Check-Status {
    Write-Step "Checking live URLs..."
    $urls = @(
        @{ url = "https://monitorhub.live";         name = "Company Portal    " },
        @{ url = "https://app.monitorhub.live";     name = "Frontend Dashboard" },
        @{ url = "https://api.monitorhub.live/api"; name = "Backend API       " },
        @{ url = "https://admin.monitorhub.live";   name = "Admin Dashboard   " }
    )
    foreach ($u in $urls) {
        try {
            $r = Invoke-WebRequest -Uri $u.url -Method HEAD -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
            Write-OK "$($u.name) -> HTTP $($r.StatusCode)"
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
            if ($code -in @(200,301,302,307,308)) { Write-OK "$($u.name) -> HTTP $code" }
            else { Write-Fail "$($u.name) -> FAILED" }
        }
    }
}

# ── MAIN ───────────────────────────────────────────────────

if ($github) {
    Push-Github
}
elseif ($backend) {
    Push-Github
    Pull-VPS
    Deploy-Backend
    Check-Status
}
elseif ($portal) {
    Push-Github
    Pull-VPS
    Deploy-Portal
    Check-Status
}
elseif ($dashboard) {
    Push-Github
    Pull-VPS
    Deploy-Dashboard
    Check-Status
}
elseif ($admin) {
    Push-Github
    Pull-VPS
    Deploy-Admin
    Check-Status
}
elseif ($status) {
    Check-Status
}
else {
    # Default: push GitHub + deploy everything
    Push-Github
    Pull-VPS
    Deploy-Backend
    Deploy-Portal
    Deploy-Dashboard
    Deploy-Admin
    Check-Status

    Write-Host "`n============================================" -ForegroundColor Green
    Write-Host "  Deployment Complete!" -ForegroundColor Green
    Write-Host "  https://monitorhub.live" -ForegroundColor Yellow
    Write-Host "  https://app.monitorhub.live" -ForegroundColor Yellow
    Write-Host "  https://api.monitorhub.live" -ForegroundColor Yellow
    Write-Host "  https://admin.monitorhub.live" -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Green
}
