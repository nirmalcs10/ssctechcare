# How to Run SSC TechCare on an Online Server

This guide provides step-by-step instructions to deploy the **Computer Service Center Management Application** online so that your staff, front desk, hardware technicians, and customers can access it securely from any device or mobile phone.

---

## 🌟 Architecture Summary

The application is structured so that the Express server serves both the **REST API (`/api/...`)** and the **compiled React Frontend single-page app** from a single port (`PORT` environment variable or `5000`).

- **Database**: Embedded SQLite file stored at `server/data/service_center.db`.
- **Single Process**: You only need to run `npm start` to serve the complete application!

---

## Method 1: Deploy on Render.com (Recommended / Zero Server Setup)

Render offers free/low-cost managed web hosting with automated deployments directly from GitHub.

### Steps:
1. **Push your code to GitHub**:
   - Create a repository (e.g. `ssc-service-center`) on [github.com](https://github.com).
   - Push your code to the repository.

2. **Create a Web Service on Render**:
   - Go to [render.com](https://render.com) and log in.
   - Click **New +** ➔ **Web Service**.
   - Connect your GitHub repository.

3. **Configure the Web Service**:
   - **Name**: `ssc-service-center`
   - **Environment**: `Node`
   - **Build Command**:
     ```bash
     npm install && npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
   - **Plan**: Free or Starter.

4. **Add Persistent Disk (Crucial for SQLite Database)**:
   - In the service settings, scroll to **Disks**.
   - Click **Add Disk**:
     - **Name**: `sqlite-data`
     - **Mount Path**: `/opt/render/project/src/server/data`
     - **Size**: `1 GB` (or more)
   *(This ensures your repair tickets, invoices, and customer database persist across server restarts and redeployments).*

5. **Deploy**:
   - Click **Create Web Service**.
   - Render will build the app and give you a free live URL: `https://ssc-service-center.onrender.com`.

---

## Method 2: Deploy on Railway.app

Railway provides ultra-fast 1-click deployments with built-in persistent storage.

### Steps:
1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** ➔ **Deploy from GitHub repo**.
3. Select your repository.
4. Add a Persistent Volume:
   - Go to your service's **Settings** ➔ **Volumes** ➔ **Add Volume**.
   - Set the mount path to: `/app/server/data`.
5. Railway will automatically detect Node.js, run `npm install`, build the client, and start the server.
6. Under **Networking**, click **Generate Domain** to get a public URL (e.g. `ssc-production.up.railway.app`).

---

## Method 3: Deploy on a Linux Cloud VPS (Ubuntu / Debian on DigitalOcean, AWS EC2, Linode)

If you have your own VPS ($4-$6/month), you have full control over performance and backups.

### 1. Connect to your VPS:
```bash
ssh root@your-server-ip
```

### 2. Install Node.js & Git:
```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential nginx
```

### 3. Clone and Build the Application:
```bash
cd /var/www
git clone https://github.com/your-username/ssc-service-center.git
cd ssc-service-center

# Install dependencies and build client bundle
npm install
npm run build

# Seed initial database (optional if starting fresh)
npm run seed
```

### 4. Install PM2 Process Manager (Keeps app running 24/7):
```bash
sudo npm install -g pm2

# Start the application
pm2 start server/src/server.js --name "ssc-techcare"

# Configure PM2 to auto-start on server reboot
pm2 startup
pm2 save
```

### 5. Configure Nginx Reverse Proxy with Domain & Free SSL:
Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/servicecenter.conf
```

Paste the following (replace `yourdomain.com` with your actual domain):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/servicecenter.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Install Free Let's Encrypt SSL (HTTPS):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Your application is now securely live at `https://yourdomain.com`!

---

## Method 4: Deploy using Docker & Docker Compose

If your server has Docker installed:

1. Clone the repository onto your server:
   ```bash
   git clone <repo_url>
   cd ssc-service-center
   ```

2. Start the container in detached mode:
   ```bash
   docker compose up -d --build
   ```

3. View status and logs:
   ```bash
   docker compose ps
   docker compose logs -f
   ```

The container automatically persists your database in the `ssc_data` volume and exposes the application on port `5000`.

---

## Method 5: Run on the Workshop's Main PC & Access Online (Cloudflare Tunnel - 100% Free)

If you do **NOT** want to pay for cloud hosting and prefer running the database locally on the service center shop's main computer, you can use **Cloudflare Tunnel** to access it anywhere for free.

1. Start the server on your shop PC:
   ```powershell
   npm run build
   npm start
   ```

2. Download and run Cloudflare's free CLI tool ([cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)):
   ```powershell
   cloudflared tunnel --url http://localhost:5000
   ```

3. Cloudflare will generate a secure public HTTPS URL (e.g. `https://random-words.trycloudflare.com`).
4. Share this URL with your technicians or customers to track their device repairs live!

---

## 🔒 Production Security Checklist

- [ ] **Data Backup**: Regularly back up `server/data/service_center.db` (e.g. daily cron job syncing to Google Drive, AWS S3, or an external USB drive).
- [ ] **HTTPS / SSL**: Ensure SSL is enabled so passwords and customer contact information are encrypted over the web.
- [ ] **Firewall**: Only expose ports 80 and 443; keep port 5000 internal behind the reverse proxy.
