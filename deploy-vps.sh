#!/bin/bash

# Employee Tracker Deployment Script for VPS
# Run this script on your VPS as root

echo "Starting Employee Tracker deployment..."

# Update system
apt update && apt upgrade -y

# Install dependencies (if not already installed)
apt install -y nodejs postgresql postgresql-contrib nginx git certbot python3-certbot-nginx

# Install PM2 globally
npm install -g pm2

# Start services
systemctl start postgresql
systemctl enable postgresql
systemctl enable nginx

# Set up database
sudo -u postgres psql << 'EOF'
CREATE DATABASE employee_tracker;
CREATE USER tracker_user WITH PASSWORD 'Monitor@2026Secure';
ALTER ROLE tracker_user SET client_encoding TO 'utf8';
ALTER ROLE tracker_user SET default_transaction_isolation TO 'read committed';
GRANT ALL PRIVILEGES ON DATABASE employee_tracker TO tracker_user;
\q
EOF

# Configuration (update these to match your domain)
DOMAIN="monitorhub.live"          # your domain

# Clone repository
git clone https://github.com/Arhamm1997/employee-tracker.git
cd employee-tracker

# Backend setup
cd backend
cat > .env << EOF
DATABASE_URL="postgresql://tracker_user:Monitor@2026Secure@localhost:5432/employee_tracker"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
PORT=3001
NODE_ENV=production
EOF

npm install
npx prisma migrate deploy
npx prisma db seed
npm run build
pm2 start ecosystem.config.js --env production

# Frontend setup
cd ../Frontend
npm install
npm run build

# Company Portal setup
cd ../company-portal
npm install
npm run build

# Master Admin Dashboard setup
cd "../Master Admin Dashboard"
npm install
npm run build

# Nginx configuration
cat > /etc/nginx/sites-available/employee-tracker <<EOF
# Main frontend (app)
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root /root/employee-tracker/Frontend/dist;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# API (backend)
server {
    listen 80;
    server_name api.$DOMAIN;

    location / {
        proxy_pass http://localhost:3001;
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

# Company portal
server {
    listen 80;
    server_name app.$DOMAIN;

    root /root/employee-tracker/company-portal/out;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Master admin dashboard
server {
    listen 80;
    server_name admin.$DOMAIN;

    root /root/employee-tracker/Master Admin Dashboard/dist;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/employee-tracker /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# PM2 startup script
pm2 startup
pm2 save

echo "Deployment completed!"
echo "Access your application at:"
echo "- Frontend: http://$DOMAIN/"
echo "- Company Portal: http://app.$DOMAIN/"
echo "- Admin Dashboard: http://admin.$DOMAIN/"
echo "- Backend API: http://api.$DOMAIN/"
echo ""
echo "Don't forget to:"
echo "1. Change the JWT_SECRET in backend/.env"
echo "2. Replace DOMAIN at the top of this script with your real domain"
echo "3. Set up SSL with certbot (e.g. certbot --nginx -d $DOMAIN -d www.$DOMAIN -d api.$DOMAIN -d app.$DOMAIN -d admin.$DOMAIN)"
echo "4. Configure firewall (ufw) for security"