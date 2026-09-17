# How to Run SSC TechCare on an Online Server (PostgreSQL Edition)

This guide provides step-by-step instructions to deploy the **SSC TechCare Computer Service Center Management Application** online with **PostgreSQL**, so your staff, front desk, hardware technicians, and customers can access it securely from any device or mobile phone.

---

## 🌟 Architecture Summary

The application is structured as a modern full-stack Node.js application:
- **Frontend**: React + Vite + Tailwind CSS single page application (SPA).
- **Backend**: Express REST API (`/api/...`) serving both the backend endpoints and compiled frontend assets from a single port (`PORT` environment variable or `5000`).
- **Database**: **PostgreSQL** database connected through connection pool (`pg`) via `DATABASE_URL`.
- **Pure JavaScript**: No native C++ compilation or `node-gyp` dependencies required!

---

## Method 1: Deploy on Render.com with Managed PostgreSQL (Recommended)

Render offers managed web hosting with free/low-cost PostgreSQL databases.

### 1-Click Blueprint Deployment:
1. Push your repository to GitHub.
2. Log in to [dashboard.render.com](https://dashboard.render.com).
3. Click **New +** ➔ **Blueprint**.
4. Select your `ssctechcare` repository.
5. Render automatically detects [`render.yaml`](./render.yaml), provisions both the **Web Service** and **PostgreSQL Database (`ssc-postgres`)**, and links `DATABASE_URL` automatically!
6. Click **Apply**.
7. In ~2 minutes, your live HTTPS URL will be active!

---

## Method 2: Deploy with Free Cloud PostgreSQL (Supabase / Neon / Aiven)

You can host PostgreSQL for free on specialized cloud providers (Supabase or Neon) and connect from Render, Railway, or Vercel.

1. **Create Free Database**:
   - Go to [neon.tech](https://neon.tech) or [supabase.com](https://supabase.com) and create a free project.
   - Copy your PostgreSQL connection string:
     ```
     postgresql://username:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
     ```
2. **Set Environment Variable on Web Host**:
   - `DATABASE_URL`: your connection string
   - `DATABASE_SSL`: `true`
3. Deploy your web service with `npm install && npm run build` and `npm start`.

---

## Method 3: Deploy using Docker & Docker Compose (Includes PostgreSQL Container)

If deploying to a VPS (DigitalOcean, AWS EC2, Linode) or local server with Docker:

1. Clone the repository onto your server:
   ```bash
   git clone https://github.com/nirmalcs10/ssctechcare.git
   cd ssctechcare
   ```

2. Start the application and PostgreSQL in detached mode:
   ```bash
   docker compose up -d --build
   ```

3. Docker Compose automatically:
   - Starts a `postgres:16-alpine` container with a healthcheck.
   - Persists data in the `ssc_pgdata` Docker volume.
   - Builds the web app and links `DATABASE_URL=postgresql://ssc_user:ssc_password@postgres:5432/ssctechcare`.
   - Exposes the service on port `5000`.

4. Check status:
   ```bash
   docker compose ps
   docker compose logs -f
   ```

---

## Method 4: Deploy on a Linux Cloud VPS with Local PostgreSQL

### 1. Install Node.js 22 & PostgreSQL:
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git postgresql postgresql-contrib nginx
```

### 2. Configure PostgreSQL:
```bash
sudo -u postgres psql -c "CREATE USER ssc_user WITH PASSWORD 'StrongPassword123';"
sudo -u postgres psql -c "CREATE DATABASE ssctechcare OWNER ssc_user;"
```

### 3. Clone and Build:
```bash
cd /var/www
git clone https://github.com/nirmalcs10/ssctechcare.git
cd ssctechcare

npm install
npm run build

# Set DATABASE_URL in .env
echo "DATABASE_URL=postgresql://ssc_user:StrongPassword123@localhost:5432/ssctechcare" > .env
```

### 4. Run with PM2:
```bash
sudo npm install -g pm2
pm2 start server/src/server.js --name "ssc-techcare"
pm2 startup
pm2 save
```

### 5. Configure Nginx Reverse Proxy with Free SSL:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Install Let's Encrypt SSL:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 🔒 Default Logins

| Portal | Username / Email | Password |
| :--- | :--- | :--- |
| **Master Gateway** | `admin@ssctechcare.com` | `admin123` |
| **Admin Staff** | `admin` | `admin123` |
| **Lead Technician** | `tech` | `tech123` |
| **Front Desk** | `staff` | `staff123` |