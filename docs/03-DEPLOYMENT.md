# Deployment Guide — Hostinger KVM VPS

> Node.js + Express + TypeScript API with SQL Server on Linux (Ubuntu)

---

## Prerequisites

- Hostinger KVM VPS with Ubuntu 22.04
- A domain pointed to your VPS IP (e.g. `api.kvsilverzone.com`)
- SSH access to the VPS
- Local SQL Server running with all migrations applied

---

## Part 1 — Install SQL Server on VPS

### 1.1 SSH into your VPS

```bash
ssh root@YOUR_VPS_IP
```

### 1.2 Install SQL Server 2022

```bash
# Import Microsoft repo key
curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | sudo gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg

# Add SQL Server 2022 repo
curl -fsSL https://packages.microsoft.com/config/ubuntu/22.04/mssql-server-2022.list \
  | sudo tee /etc/apt/sources.list.d/mssql-server-2022.list

sudo apt-get update
sudo apt-get install -y mssql-server

# Run setup wizard
sudo /opt/mssql/bin/mssql-conf setup
# → Select edition: 2 (Developer — free, full-featured)
# → Set SA password (e.g. KvAdmin@2026!)
```

### 1.3 Install sqlcmd (SQL command-line tool)

```bash
curl -fsSL https://packages.microsoft.com/config/ubuntu/22.04/prod.list \
  | sudo tee /etc/apt/sources.list.d/msprod.list

sudo apt-get update
sudo apt-get install -y mssql-tools18 unixodbc-dev

echo 'export PATH="$PATH:/opt/mssql-tools18/bin"' >> ~/.bashrc
source ~/.bashrc
```

### 1.4 Verify SQL Server is running

```bash
sudo systemctl status mssql-server

# Test connection
sqlcmd -S localhost -U SA -P 'KvAdmin@2026!' -C -Q "SELECT @@VERSION"
```

---

## Part 2 — Migrate the Database

### 2.1 Export schema + data from local SQL Server (Windows)

Open **SSMS** → right-click your database → **Tasks → Generate Scripts**:

- Select all tables, views, and stored procedures in the `kv` schema
- In **Advanced** options set:
  - **Types of data to script**: `Schema and Data`
  - **Script for Server Version**: `SQL Server 2022`
- Save output as `full_export.sql`

> **Note:** Exclude `kv.ProductImage` from the data export — its `ImageBase64` column is very large. The image seeder script will re-populate it on the server.

### 2.2 Copy migration scripts and export to VPS

Run these from your Windows machine (PowerShell or Git Bash):

```bash
scp database/sqlserver/001_create_schema.sql              root@YOUR_VPS_IP:/root/
scp database/sqlserver/002_seed_products.sql              root@YOUR_VPS_IP:/root/
scp database/sqlserver/003_create_domain_schema.sql       root@YOUR_VPS_IP:/root/
scp database/sqlserver/004_seed_domain_data.sql           root@YOUR_VPS_IP:/root/
scp database/sqlserver/005_migrate_productimage_base64.sql root@YOUR_VPS_IP:/root/
scp database/sqlserver/006_create_missing_features.sql    root@YOUR_VPS_IP:/root/
scp full_export.sql                                       root@YOUR_VPS_IP:/root/
```

### 2.3 Create the database on VPS

```bash
sqlcmd -S localhost -U SA -P 'KvAdmin@2026!' -C -Q "CREATE DATABASE KVSilverZone;"
```

### 2.4 Run migrations in order

```bash
sqlcmd -S localhost -U SA -P 'KvAdmin@2026!' -C -d KVSilverZone -i /root/001_create_schema.sql
sqlcmd -S localhost -U SA -P 'KvAdmin@2026!' -C -d KVSilverZone -i /root/002_seed_products.sql
sqlcmd -S localhost -U SA -P 'KvAdmin@2026!' -C -d KVSilverZone -i /root/003_create_domain_schema.sql
sqlcmd -S localhost -U SA -P 'KvAdmin@2026!' -C -d KVSilverZone -i /root/004_seed_domain_data.sql
sqlcmd -S localhost -U SA -P 'KvAdmin@2026!' -C -d KVSilverZone -i /root/005_migrate_productimage_base64.sql
sqlcmd -S localhost -U SA -P 'KvAdmin@2026!' -C -d KVSilverZone -i /root/006_create_missing_features.sql
sqlcmd -S localhost -U SA -P 'KvAdmin@2026!' -C -d KVSilverZone -i /root/full_export.sql
```

---

## Part 3 — Deploy the API

### 3.1 Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should print v22.x
```

### 3.2 Install PM2 (process manager)

```bash
sudo npm install -g pm2
```

### 3.3 Upload the project

**Option A — Git (recommended)**

```bash
git clone https://github.com/YOUR_ORG/kv-api.git /var/www/kv-api
cd /var/www/kv-api
```

**Option B — SCP from Windows**

```bash
scp -r src package.json tsconfig.json root@YOUR_VPS_IP:/var/www/kv-api/
```

### 3.4 Build the project

```bash
cd /var/www/kv-api
npm install
npm run build
# Compiled output goes to /var/www/kv-api/dist/
```

### 3.5 Create the `.env` file on VPS

```bash
nano /var/www/kv-api/.env
```

Paste the following and fill in your values:

```env
NODE_ENV=production
PORT=5000

# SQL Server — must use SQL auth (Windows auth not supported on Linux)
SQL_SERVER_AUTH_TYPE=sql
SQL_SERVER_HOST=localhost
SQL_SERVER_INSTANCE=
SQL_SERVER_PORT=1433
SQL_SERVER_DATABASE=KVSilverZone
SQL_SERVER_USER=SA
SQL_SERVER_PASSWORD=KvAdmin@2026!
SQL_SERVER_ENCRYPT=false
SQL_SERVER_TRUST_SERVER_CERTIFICATE=true

JWT_SECRET=your_strong_jwt_secret_here
JWT_EXPIRES_IN=7d

RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

> **Important:** `SQL_SERVER_AUTH_TYPE` must be `sql` on Linux. Windows authentication is not available outside of Windows.

### 3.6 Seed the admin user

```bash
cd /var/www/kv-api
npm run seed
```

### 3.7 Upload and seed product images

Upload the images from your Windows machine:

```bash
scp -r "assets/product" root@YOUR_VPS_IP:/var/www/kv-api/assets/product/
```

Then run the image seeder on VPS:

```bash
cd /var/www/kv-api
npm run seed:images
```

### 3.8 Start the API with PM2

```bash
cd /var/www/kv-api
pm2 start dist/server.js --name kv-api
pm2 save
pm2 startup
# Copy and run the command printed by pm2 startup to enable auto-start on reboot
```

Useful PM2 commands:

```bash
pm2 status          # check running processes
pm2 logs kv-api     # tail logs
pm2 restart kv-api  # restart after config change
pm2 stop kv-api     # stop the API
```

---

## Part 4 — Nginx Reverse Proxy

### 4.1 Install Nginx

```bash
sudo apt-get install -y nginx
```

### 4.2 Create site config

```bash
sudo nano /etc/nginx/sites-available/kv-api
```

Paste:

```nginx
server {
    listen 80;
    server_name api.kvsilverzone.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4.3 Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/kv-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Part 5 — SSL Certificate (HTTPS)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.kvsilverzone.com
```

Certbot will automatically configure Nginx for HTTPS and set up auto-renewal.

Verify auto-renewal works:

```bash
sudo certbot renew --dry-run
```

---

## Part 6 — Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

> Do **not** expose port `1433` (SQL Server) publicly. It should only be accessible locally within the VPS.

---

## Deployment Checklist

| # | Step | Verify with |
|---|------|-------------|
| 1 | SQL Server installed & running | `sudo systemctl status mssql-server` |
| 2 | Database created | `sqlcmd ... -Q "SELECT name FROM sys.databases"` |
| 3 | All 6 migrations applied | `sqlcmd ... -Q "SELECT * FROM kv.ProductGroup"` |
| 4 | Node.js installed | `node --version` |
| 5 | Project built | `ls dist/server.js` |
| 6 | `.env` configured (SQL auth) | `cat .env` |
| 7 | Admin user seeded | `npm run seed` |
| 8 | Images uploaded & seeded | `npm run seed:images` |
| 9 | PM2 running | `pm2 status` |
| 10 | Nginx configured | `sudo nginx -t` |
| 11 | SSL active | `sudo certbot certificates` |
| 12 | Firewall enabled | `sudo ufw status` |

---

## Default Admin Credentials

| Field | Value |
|-------|-------|
| Email | `admin@kvsilverzone.com` |
| Password | `Admin@123` |

> Change this password immediately after first login in production.

---

## API Base URL (after deployment)

```
https://api.kvsilverzone.com/api/v1
```

Swagger docs (if enabled):

```
https://api.kvsilverzone.com/api-docs
```
