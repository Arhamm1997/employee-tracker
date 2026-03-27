# Employee Tracker - Complete Feature Overview

## Project Architecture

**4 Main Components:**
1. **Backend** (Node.js + Express + TypeScript) - Port 5001
2. **Frontend** (React 18 + TypeScript + Vite) - Port 5173
3. **Master Admin Dashboard** (React + Vite) - Port 5174
4. **Monitoring Agent** (Python Windows Application) - Runs on employee machines

---

## 📊 Backend Features

### 1. Authentication & Authorization
- Company registration & signup flow
- Admin user management with 2FA
- Role-based access control (super_admin, admin, viewer)
- JWT token-based authentication
- Email verification & password reset
- Multi-tenant architecture

**Endpoints:**
- `POST /api/auth/register` - Company signup
- `POST /api/auth/login` - Admin login
- `POST /api/auth/verify-2fa` - 2FA verification
- `POST /api/auth/refresh-token` - Token refresh

### 2. Employee Management
- Create/update/delete employees
- Unique employee codes
- Agent token generation
- Activity tracking

**Endpoints:**
- `GET /api/employees` - List employees
- `POST /api/employees` - Create
- `PUT /api/employees/:id` - Update
- `DELETE /api/employees/:id` - Delete
- `GET /api/employees/:id/activity` - Activity logs

### 3. Dashboard & Analytics
- Real-time company statistics
- Activity overview
- Employee metrics

**Endpoints:**
- `GET /api/dashboard/stats` - Stats
- `GET /api/dashboard/activity` - Activity logs

### 4. Monitoring Features (Plan-Based)

#### Screenshots
- Periodic desktop capture
- Cloudinary storage
- Quality levels: low/medium/high
- Configurable interval

**Endpoints:**
- `POST /api/agent/screenshot` - Upload
- `GET /api/screenshots/:employeeId` - Retrieve

#### Browser History
- Auto-discovers all profiles (Chrome, Edge, Firefox)
- Tracks browsing with timestamps
- Multi-profile support

**Endpoints:**
- `POST /api/agent/browser-history` - Send
- `GET /api/employees/:id/browser-history` - Retrieve

#### Keylogger
- Keystroke recording by application
- Shows what app user typed in
- Disableable per company

**Endpoints:**
- `POST /api/agent/keylog` - Send
- `GET /api/employees/:id/keylogs` - Retrieve

#### File Monitor
- Tracks changes in Desktop, Documents, Downloads, Pictures
- Detects create/modify/delete
- Disableable per company

**Endpoints:**
- `POST /api/agent/file-activity` - Send
- `GET /api/employees/:id/file-activity` - Retrieve

#### Print Monitor
- Detects print jobs
- Tracks print queue activity

**Endpoints:**
- `POST /api/agent/print-log` - Send
- `GET /api/employees/:id/print-logs` - Retrieve

#### USB Monitoring
- Detects USB connections/disconnections
- Tracks device info

#### Live Screen Sharing
- WebRTC peer-to-peer video streaming
- Real-time admin viewing of employee screen
- Trickleless ICE signaling

#### Remote Commands
- Lock employee device
- Shutdown device
- Polling every 30 seconds

**Endpoints:**
- `GET /api/agent/command` - Poll for commands
- `POST /api/employees/:id/lock` - Lock command
- `POST /api/employees/:id/shutdown` - Shutdown command

### 5. Alerts & Notifications
- Blocked site alerts
- After-hours work alerts
- Real-time WebSocket notifications

**Endpoints:**
- `GET /api/alerts` - List alerts
- `POST /api/alerts` - Create alert
- `DELETE /api/alerts/:id` - Clear alert

### 6. Settings Management
- Screenshot interval & quality
- Idle detection threshold
- Work hours configuration
- Blocked sites list
- Per-feature enablement

**Endpoints:**
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings
- `POST /api/settings/test-email` - Test email

### 7. Reports & Analytics
- Activity report generation
- Performance tracking
- Time-based analysis

**Endpoints:**
- `GET /api/reports` - List reports
- `POST /api/reports/generate` - Generate
- `GET /api/reports/:id` - Get details

### 8. Plans & Subscription

**Feature Gating Per Plan:**
- Screenshots ✓/✗
- Browser history ✓/✗
- USB monitoring ✓/✗
- Alerts ✓/✗
- Keylogger ✓/✗
- File monitor ✓/✗
- Print logs ✓/✗
- Advanced reports ✓/✗
- Live screen ✓/✗
- Device shutdown ✓/✗
- Device lock ✓/✗
- Max seats per plan
- Max admins per plan

**Subscription Models:**
- Monthly & yearly billing
- Active, cancelled, expired statuses
- Period-based tracking

**Endpoints:**
- `GET /api/plans` - List plans
- `GET /api/subscription/info` - Get subscription details
- `POST /api/company/subscription` - Create subscription
- `PUT /api/company/subscription` - Update subscription

### 9. Master Admin Panel
- View all companies
- Manage plans
- System health monitoring
- Cross-company analytics
- Error logs
- Agent version management

**Endpoints:**
- `GET /api/admin/customers` - Companies
- `GET /api/admin/dashboard/stats` - System stats
- `GET /api/admin/system/health` - Health check
- `GET /api/admin/logs/errors` - Error logs
- `GET /api/admin/invoices` - Billing
- `GET /api/admin/analytics` - Analytics

### 10. System Utilities
- Connection status monitoring
- Agent version management
- Background jobs (offline detection, cleanup)

**Endpoints:**
- `GET /api/connection-status` - Connection status
- `GET /api/agent/latest-version` - Latest agent
- `GET /api/agent/download/:employeeId` - Agent config

---

## 🎨 Frontend (Company Dashboard)

**Pages & Features:**
- **Login & 2FA** - Secure authentication
- **Dashboard** - Overview with statistics
- **Employees** - Manage monitored users
- **Activity Feed** - Real-time updates
- **Screenshots** - Gallery view with timestamps
- **Live Screen** - WebRTC video stream
- **Keylogger** - Typed content logs
- **File Activity** - File change tracking
- **Print Logs** - Printed documents
- **Browser History** - Browsing activity
- **Reports** - Generate & view reports
- **Settings** - Configure monitoring
- **Alerts** - Manage alert rules
- **Connection Status** - System health indicator

**Technology:**
- React 18 with TypeScript
- Vite bundler
- WebSocket integration
- WebRTC video streaming
- Responsive design

---

## 🛡️ Master Admin Dashboard

**Features:**
- System-wide statistics
- Customer management
- Plan configuration
- Billing & invoicing
- Subscription tracking
- Agent version uploads & releases
- Cross-customer analytics
- Error monitoring

**Tech:**
- React + Vite
- 2FA login protection
- Data export capabilities

---

## 🤖 Monitoring Agent (Python)

### Architecture
- **Main:** `agent.py` (core monitoring)
- **Watchdog:** `EMWatchdog.exe` (auto-restart)
- **Tray:** `tray.py` (system tray UI)

### Monitoring Modules

| Module | Purpose |
|--------|---------|
| `screenshot.py` | Desktop screenshots every X seconds |
| `browser.py` | Browser history (all profiles) |
| `keylogger.py` | Global keystroke logging |
| `file_monitor.py` | Desktop/Documents/Downloads changes |
| `print_monitor.py` | Print job detection |
| `usb_monitor.py` | USB device detection |
| `clipboard.py` | Clipboard monitoring |
| `software.py` | Installed software tracking |
| `live_screen.py` | WebRTC video streaming |

### Configuration
- **File:** `C:\ProgramData\EmployeeMonitor\config.json`
- Server URL & credentials
- Screenshot interval & quality
- Idle threshold
- Feature toggles
- Blocked sites list

### Offline Support
- **Queue DB:** `C:\ProgramData\EmployeeMonitor\queue.db` (SQLite)
- Queues events when offline
- Auto-syncs when reconnected

### Security
- Process protection
- Registry monitoring
- Startup persistence
- File integrity checks

### Remote Commands
- Lock device
- Shutdown device
- Polls `/api/agent/command` every 30s

### Build
- PyInstaller builds to `.exe`
- Produces: `EmployeeMonitor.exe`, `EMWatchdog.exe`

### Dependencies
- pywinauto, PIL, websockets, watchdog, aiortc, av, numpy, psutil, pyperclip

---

## 🔌 WebSocket Real-Time Updates

### Connection
- **Agent:** `ws://server/api/ws?agentToken=TOKEN`
- **Admin:** `ws://server/api/ws?token=JWT`
- Persistent connection
- Auto-reconnect on disconnect

### Message Types
```
Activity: { type: "activity", data: {...} }
Alerts: { type: "alert_count", data: { count: N } }
WebRTC: { type: "webrtc:request|start|offer|answer", data: {...} }
```

---

## 📱 Multi-Tenancy

- **Company** = Tenant root
- **Admin** = Company users with roles
- **Employee** = Monitored staff
- All data filtered by `companyId`
- Plan-based feature access

---

## 🔒 Security

✓ Helmet.js security headers
✓ CORS validation
✓ Rate limiting
✓ JWT + refresh tokens
✓ 2FA support
✓ Email verification
✓ bcrypt password hashing
✓ Cloudinary secure storage
✓ Role-based access control

---

## 📊 Database Models

**Core Models:**
- Company, Admin, Employee
- Activity, Screenshot, Alert
- Settings, Subscription, Plan
- Report, Invoice, AgentVersion
- Keylog, FileActivity, PrintLog, BrowserHistory

**Relationships:**
- Company → many Employees, Admins
- Company → one Subscription
- Subscription → one Plan
- Employee → many Screenshots/Activities

---

## 🚀 Setup Commands

```bash
# Backend
cd backend
npm install
cp .env.example .env
npm run db:generate
npm run db:push
npm run db:seed
npm run dev

# Frontend
cd Frontend
npm install
npm run dev

# Admin Dashboard
cd Master\ Admin\ Dashboard
npm install
npm run dev

# Agent
cd agent
build.bat  # Produces .exe files
```

---

## 🌐 Service URLs

| Service | Port | URL |
|---------|------|-----|
| Frontend | 5173 | http://localhost:5173 |
| Admin | 5174 | http://localhost:5174 |
| Backend | 5001 | http://localhost:5001 |
| Portal | 3001 | http://localhost:3001 |

---

## ✨ Key Capabilities

✅ Real-time employee monitoring (screenshots, keylogger, file tracker)
✅ Browser history collection (multi-profile)
✅ Live screen WebRTC streaming
✅ Print & USB device tracking
✅ Remote device control (lock/shutdown)
✅ Plan-based feature gating
✅ Alert system with rules
✅ Advanced reporting
✅ Multi-company SaaS
✅ 2FA security
✅ Offline-first agent
✅ WebSocket real-time
✅ Cloudinary integration
✅ Email notifications
✅ Master admin analytics

---

**Total Implementation:** 40+ backend files, 3 web frontends, 21 Python agent modules, comprehensive database schema with 15+ models
