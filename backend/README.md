# Employee Monitor — Backend API

Production-ready REST API for the Employee Monitoring System.

## Tech Stack
- **Node.js + Express.js + TypeScript**
- **PostgreSQL + Prisma ORM**
- **JWT** authentication (24h expiry)
- **Raw WebSocket** (`ws` package) — compatible with the React frontend
- **Multer + Cloudinary** for screenshot uploads
- **Nodemailer** for email alerts (SMTP/Gmail)
- **node-cron** for scheduled jobs
- **Winston** for structured logging
- **helmet + cors + express-rate-limit** for security

## Quick Start

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your actual values
```

### 3. Set up the database
```bash
# Create the PostgreSQL database first, then:
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database (dev)
# OR for production:
npm run db:migrate     # Create migration files
```

### 4. Seed the database
```bash
npm run db:seed
```
This creates:
- 2 admin accounts (super_admin + viewer)
- 50 employees across 5 departments
- 7 days of realistic activity data
- Agent tokens saved to `agent-tokens.txt`

### 5. Run the server
```bash
npm run dev       # Development (with hot-reload via nodemon)
npm run build     # Compile TypeScript
npm start         # Production
```

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) | `your-strong-secret-key` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | `mycloud` |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `123456789` |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | `abc...` |
| `SMTP_HOST` | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username/email | `you@gmail.com` |
| `SMTP_PASS` | SMTP password/app password | `xxxx xxxx xxxx xxxx` |
| `PORT` | Server port | `5000` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:3000` |

## API Endpoints

### Auth
- `POST /api/auth/login` — `{ email, password }` → `{ token, user }`
- `GET  /api/auth/me` — Returns current admin (JWT required)
- `POST /api/auth/change-password` — Change password (JWT required)

### Dashboard
- `GET /api/dashboard` — Full dashboard data (stats + charts)
- `GET /api/dashboard/stats` — Stats only

### Employees
- `GET  /api/employees` — List with filters (`?search&department&status`)
- `GET  /api/employees/:id` — Single employee
- `GET  /api/employees/:id/detail` — Full detail (all tabs)
- `GET  /api/employees/:id/activities`
- `GET  /api/employees/:id/screenshots`
- `GET  /api/employees/:id/browser-history`
- `GET  /api/employees/:id/alerts`
- `GET  /api/employees/:id/usb-events`
- `GET  /api/employees/:id/timeline`
- `PUT  /api/employees/:id/disable`
- `PUT  /api/employees/:id/enable`

### Screenshots & Alerts
- `GET /api/screenshots` — `?employeeId&department&date`
- `GET /api/alerts` — `?severity&type&isRead&employeeId`
- `PUT /api/alerts/:id/read`
- `PUT /api/alerts/read-all`
- `DELETE /api/alerts/:id`

### Reports & Settings
- `GET /api/reports` — `?dateRange=today|week|month&employeeId`
- `GET /api/settings`
- `PUT /api/settings`

### Admin Management (super_admin only for mutations)
- `GET  /api/admins`
- `POST /api/admins`
- `PUT  /api/admins/:id`
- `PUT  /api/admins/:id/toggle`
- `DELETE /api/admins/:id`

### Agent Routes (x-agent-token header)
- `GET  /api/agent/verify`
- `POST /api/agent/heartbeat`
- `POST /api/agent/screenshot` (multipart)
- `POST /api/agent/browser-history`
- `POST /api/agent/usb-event`
- `POST /api/agent/new-software`
- `POST /api/agent/clipboard`
- `GET  /api/agent/check-update`

### Agent Updates (super_admin only)
- `GET  /api/agent-updates`
- `POST /api/agent-updates`

## WebSocket

Server exposes a WebSocket at both `/ws` and `/api/ws`.

The React frontend connects to `ws://localhost:5000/ws` (or `ws://localhost:5000/api/ws` when `VITE_API_URL` is set).

Message format:
```json
{ "type": "activity", "data": { ... Activity object ... } }
{ "type": "alert_count", "data": 5 }
{ "type": "new-alert", "data": { ... Alert object ... } }
{ "type": "employee-online", "data": { "employeeId": "..." } }
{ "type": "employee-offline", "data": { "employeeId": "..." } }
{ "type": "screenshot-taken", "data": { "employeeId": "...", "imageUrl": "...", "timestamp": "..." } }
```

## Scheduled Jobs

| Job | Schedule | Description |
|---|---|---|
| Offline Detection | Every 2 minutes | Emits `employee-offline` WS event |
| Daily Summary Email | 7:00 PM daily | Sends HTML summary to admin emails |
| Data Cleanup | 2:00 AM daily | Deletes data older than retention settings |

## Default Credentials (after seed)

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@company.com` | `Admin@123` |
| Viewer | `viewer@company.com` | `Viewer@123` |

## Security

- **Rate limiting**: 200 req/min (dashboard), 60 req/min (agent)
- **Helmet**: Security headers on all responses
- **CORS**: Only allows `FRONTEND_URL`
- **JWT**: 24h expiry
- **Agent tokens**: UUID v4, stored in DB
- **Passwords**: bcrypt with 12 salt rounds
- **SQL injection**: Protected by Prisma parameterized queries
- **File uploads**: Images only, max 5MB
