#!/bin/bash

# ============================================================
# Employee Tracker — VPS Fix Script
# Run on your VPS as root: bash fix-vps.sh
# ============================================================

DOMAIN="monitorhub.live"
BACKEND_PORT=5001
PORTAL_PORT=3001
REPO_DIR="/root/employee-tracker"

echo "=== Step 1: Stopping services ==="
pm2 stop all 2>/dev/null || true

echo "=== Step 2: Updating backend .env for production ==="
cat > "$REPO_DIR/backend/.env" << EOF
DATABASE_URL="postgresql://tracker_user:Monitor@2026Secure@localhost:5432/employee_tracker"
JWT_SECRET="15a9bfa13bf5367dd3a0c6e049c4e22f1a64b134e021e3036b6727aaed25d696"
COMPANY_JWT_SECRET="a50b246e6be28960ef161f59abf8491a410e5d49062f8677e6e717023da7b3b5"
ADMIN_JWT_SECRET="8ab45eb15f98668c2e50e98852dab735081609891fcc172f24d91c0818de43ac"
PORT=$BACKEND_PORT
NODE_ENV=production
FRONTEND_URL=https://$DOMAIN
COMPANY_PORTAL_URL=https://app.$DOMAIN
COMPANY_NAME=Employee Monitor
DASHBOARD_URL=https://$DOMAIN
VPS_URL=https://api.$DOMAIN
CLOUDINARY_CLOUD_NAME=dkqo7vqfm
CLOUDINARY_API_KEY=566166998857258
CLOUDINARY_API_SECRET=ntUoI6GY7Dz0XDFK4o2Z10CgLJA
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=arhamawan125@gmail.com
SMTP_PASS="skordkfl xefr blho"
SMTP_FROM="Employee Monitor <arhamawan125@gmail.com>"
EOF

echo "=== Step 3: Updating Master Admin Dashboard .env ==="
cat > "$REPO_DIR/Master Admin Dashboard/.env" << EOF
VITE_API_URL=https://api.$DOMAIN/api
EOF

echo "=== Step 4: Updating company-portal .env ==="
cat > "$REPO_DIR/company-portal/.env.local" << EOF
NEXT_PUBLIC_API_URL=https://api.$DOMAIN
NEXT_PUBLIC_DASHBOARD_URL=https://$DOMAIN
EOF

echo "=== Step 5: Rebuilding frontend apps ==="

# Master Admin Dashboard
cd "$REPO_DIR/Master Admin Dashboard"
npm install
npm run build

# Company Portal
cd "$REPO_DIR/company-portal"
npm install
npm run build

# Main Frontend
cd "$REPO_DIR/Frontend"
npm install
npm run build

echo "=== Step 6: Rebuilding backend ==="
cd "$REPO_DIR/backend"
npm install
npm run build

echo "=== Step 7: Writing fixed nginx config ==="
cat > /etc/nginx/sites-available/employee-tracker << 'NGINXEOF'
# ── Main frontend (monitorhub.live) ──────────────────────────
server {
    listen 80;
    server_name monitorhub.live www.monitorhub.live;

    root /root/employee-tracker/Frontend/dist;
    index index.html;

    # Proxy API calls to backend
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy uploads
    location /uploads/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# ── Backend API (api.monitorhub.live) ────────────────────────
server {
    listen 80;
    server_name api.monitorhub.live;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# ── Company Portal (app.monitorhub.live) ─────────────────────
# Next.js SSR app — must be proxied, not served as static files
server {
    listen 80;
    server_name app.monitorhub.live;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# ── Master Admin Dashboard (admin.monitorhub.live) ───────────
# NOTE: path is quoted to handle the space in the directory name
server {
    listen 80;
    server_name admin.monitorhub.live;

    root "/root/employee-tracker/Master Admin Dashboard/dist";
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINXEOF

echo "=== Step 8: Testing and reloading nginx ==="
nginx -t && systemctl reload nginx

echo "=== Step 9: Creating PM2 ecosystem config ==="
cat > "$REPO_DIR/ecosystem.config.js" << 'PM2EOF'
module.exports = {
  apps: [
    {
      name: "stafftrack-backend",
      cwd: "/root/employee-tracker/backend",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "company-portal",
      cwd: "/root/employee-tracker/company-portal",
      script: "node_modules/.bin/next",
      args: "start -p 3001",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
PM2EOF

echo "=== Step 10: Starting all services with PM2 ==="
pm2 delete all 2>/dev/null || true
pm2 start "$REPO_DIR/ecosystem.config.js"
pm2 save
pm2 startup

echo ""
echo "=== Done! ==="
echo "Check status: pm2 status"
echo "Check logs:   pm2 logs"
echo ""
echo "Next — set up SSL (HTTPS):"
echo "  certbot --nginx -d monitorhub.live -d www.monitorhub.live -d api.monitorhub.live -d app.monitorhub.live -d admin.monitorhub.live"
echo ""
echo "URLs:"
echo "  Main app:       http://monitorhub.live"
echo "  Company portal: http://app.monitorhub.live"
echo "  Admin panel:    http://admin.monitorhub.live"
echo "  API:            http://api.monitorhub.live"
