# Deploying food-twin to a Production VPS

Complete, step-by-step guide for deploying food-twin (Next.js 15 · tRPC · Prisma · SQLite · Bun) on a Linux VPS from a completely fresh server.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Operating System Requirements](#operating-system-requirements)
3. [Hardware Requirements](#hardware-requirements)
4. [Required Software & Packages](#required-software--packages)
5. [Network & DNS Requirements](#network--dns-requirements)
6. [Step 1 — First Login & System Update](#step-1--first-login--system-update)
7. [Step 2 — Create Deploy User & Harden SSH](#step-2--create-deploy-user--harden-ssh)
8. [Step 3 — Configure the Firewall (UFW)](#step-3--configure-the-firewall-ufw)
9. [Step 4 — Install Required System Packages](#step-4--install-required-system-packages)
10. [Step 5 — Install Bun](#step-5--install-bun)
11. [Step 6 — Install Node.js](#step-6--install-nodejs)
12. [Step 7 — Install Nginx](#step-7--install-nginx)
13. [Step 8 — Install Git & Clone the Repository](#step-8--install-git--clone-the-repository)
14. [Step 9 — Configure Environment Variables](#step-9--configure-environment-variables)
15. [Step 10 — Install Dependencies & Generate Prisma Client](#step-10--install-dependencies--generate-prisma-client)
16. [Step 11 — Set Up the Database](#step-11--set-up-the-database)
17. [Step 12 — Build the Application](#step-12--build-the-application)
18. [Step 13 — Run with PM2 (Process Manager)](#step-13--run-with-pm2-process-manager)
19. [Step 14 — Configure Nginx Reverse Proxy](#step-14--configure-nginx-reverse-proxy)
20. [Step 15 — Issue TLS Certificate (HTTPS)](#step-15--issue-tls-certificate-https)
21. [Step 16 — Tune Nginx for Production](#step-16--tune-nginx-for-production)
22. [Step 17 — Database Backups](#step-17--database-backups)
23. [Step 18 — Log Rotation](#step-18--log-rotation)
24. [Deploying Updates](#deploying-updates)
25. [Health Checks & Monitoring](#health-checks--monitoring)
26. [Troubleshooting Reference](#troubleshooting-reference)
27. [Security Checklist](#security-checklist)

---

## Architecture Overview

```
Internet
   │
   ▼
[Nginx :443] ──── terminates TLS, serves static /_next/static from proxy cache
   │
   ▼
[Next.js :3000] ── managed by PM2, runs with Bun
   │
   ▼
[SQLite] ──────── single file at /srv/apps/food-twin/db.sqlite (~1–3 GB seeded)
```

**Stack summary:**

| Layer | Technology |
|-------|-----------|
| Runtime | Bun (fast JS/TS runtime, replaces Node for the app process) |
| Framework | Next.js 15 (App Router, server components) |
| API | tRPC v11 (type-safe RPC, no REST layer) |
| ORM | Prisma 5 with SQLite |
| Reverse proxy | Nginx |
| Process manager | PM2 |
| TLS | Let's Encrypt via Certbot |

---

## Operating System Requirements

### Supported distributions

| Distribution | Version | Status |
|-------------|---------|--------|
| **Ubuntu Server** | **22.04 LTS (Jammy)** | ✅ Recommended |
| Ubuntu Server | 24.04 LTS (Noble) | ✅ Supported |
| Debian | 12 (Bookworm) | ✅ Supported |
| Debian | 11 (Bullseye) | ⚠️ Works but Node 20 needs manual repo |
| CentOS / RHEL | 8/9 | ⚠️ Works but package names differ |
| Alpine Linux | any | ❌ Not recommended (glibc required by Prisma) |

> All commands in this guide use **Ubuntu 22.04 LTS** syntax (`apt`, `ufw`, `systemd`). Adapt accordingly for other distros.

### Architecture

- **x86_64 (amd64)** — fully supported, recommended
- **arm64 (aarch64)** — supported (Bun and Prisma both ship arm64 binaries)
- **32-bit** — not supported (Bun does not ship 32-bit binaries)

### Kernel version

- Minimum: Linux kernel **5.4** or later
- Check: `uname -r`
- Ubuntu 22.04 ships with kernel 5.15 — no action needed

### Timezone

Set the server timezone to avoid confusing log timestamps:

```bash
sudo timedatectl set-timezone UTC
timedatectl status   # verify
```

---

## Hardware Requirements

### Minimum (personal use / development preview)

| Resource | Minimum | Notes |
|----------|---------|-------|
| CPU | 1 vCPU | Build is single-threaded; 1 core is fine |
| RAM | **1 GB** | Build peak ~600 MB; runtime ~200–300 MB |
| Disk | **20 GB SSD** | OS ~5 GB + app ~500 MB + seeded DB ~1–2 GB |
| Bandwidth | 100 Mbps | Outbound for API calls to USDA / Anthropic |

> **Warning:** With only 1 GB RAM, the `bun run build` step can OOM. Add a 1 GB swap file (see below) to avoid this.

### Recommended (small public deployment)

| Resource | Recommended | Notes |
|----------|------------|-------|
| CPU | 2 vCPU | Parallel Next.js compilation |
| RAM | **2 GB** | Comfortable headroom for PM2 + Nginx + OS |
| Disk | **40 GB SSD** | Room for logs, backups, future DB growth |
| Bandwidth | 1 Gbps | For responsive food search |

### Swap file (if RAM < 2 GB)

Run this immediately after first login — the build will OOM without it on 1 GB machines:

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent across reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Tune swappiness (prefer RAM, use swap only when needed)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Verify
free -h
```

### Disk space breakdown

| Path | Approximate size |
|------|-----------------|
| Ubuntu 22.04 base OS | ~3–4 GB |
| Nginx, Certbot, system packages | ~200 MB |
| Node.js + npm | ~200 MB |
| Bun | ~100 MB |
| PM2 | ~100 MB |
| `/srv/apps/food-twin/node_modules` | ~400–500 MB |
| `.next/` build output | ~200–300 MB |
| `db.sqlite` (fully seeded with USDA data) | ~1–2 GB |
| PM2 logs | ~50 MB/month (rotated) |
| Backup copies of db.sqlite | ~1–2 GB × retention days |

---

## Required Software & Packages

### System packages (installed via apt)

| Package | Purpose | Required? |
|---------|---------|-----------|
| `curl` | Download Bun installer, NodeSource script | Yes |
| `wget` | Alternative downloader | Optional |
| `git` | Clone the repository | Yes |
| `unzip` | Required by Bun installer | Yes |
| `build-essential` | Native addons (gcc, make, g++) | Yes (Prisma) |
| `python3` | node-gyp native builds | Yes (Prisma) |
| `nginx` | Reverse proxy / TLS termination | Yes |
| `certbot` | Let's Encrypt certificate manager | Yes |
| `python3-certbot-nginx` | Certbot Nginx plugin | Yes |
| `ufw` | Firewall management | Yes |
| `htop` | Interactive process monitor | Recommended |
| `nano` / `vim` | Text editor | Yes (one of them) |
| `rsync` | Sync SSH keys to new user | Recommended |
| `logrotate` | Log file rotation | Yes (pre-installed) |
| `cron` | Scheduled backup jobs | Yes (pre-installed) |
| `sqlite3` | CLI to inspect the database | Recommended |
| `fail2ban` | Ban repeated SSH login failures | Recommended |

### Runtimes

| Software | Version | Purpose |
|----------|---------|---------|
| **Bun** | Latest stable (≥ 1.1) | App runtime, package manager, script runner |
| **Node.js** | 20 LTS (≥ 20.0) | Required only by Prisma CLI and PM2 internals |
| **npm** | Ships with Node.js | Used to install PM2 globally |

> **Why both Bun and Node?** Bun runs the Next.js production server and executes scripts. Prisma's migration CLI (`prisma migrate deploy`) internally shells out to Node. PM2 is a Node package. In practice Bun handles 99% of the work.

### Application-level tools

| Tool | Version | Purpose |
|------|---------|---------|
| PM2 | Latest | Process management, auto-restart, startup scripts |
| Prisma CLI | 5.21 (pinned in package.json) | Database migrations |

---

## Network & DNS Requirements

### Ports that must be open

| Port | Protocol | Direction | Purpose |
|------|----------|-----------|---------|
| 22 | TCP | Inbound | SSH |
| 80 | TCP | Inbound | HTTP (redirects to HTTPS) |
| 443 | TCP | Inbound | HTTPS |
| 3000 | TCP | Localhost only | Next.js app (blocked from internet) |

### DNS

Before running Certbot you **must** have:

1. An `A` record: `yourdomain.com` → `<VPS IP>`
2. An `A` record: `www.yourdomain.com` → `<VPS IP>` (optional but recommended)

DNS propagation can take up to 24 hours but is usually under 5 minutes with major registrars. Verify:

```bash
# From your local machine
dig +short yourdomain.com
nslookup yourdomain.com
```

### Outbound connections the app makes

| Destination | Purpose |
|-------------|---------|
| `api.nal.usda.gov` | USDA FoodData Central API (food search, seed data) |
| `api.anthropic.com` | Claude AI food search (optional, requires ANTHROPIC_API_KEY) |
| `api.bun.sh` | Bun package registry |
| `registry.npmjs.org` | npm (PM2 install) |
| `deb.nodesource.com` | NodeSource apt repo |
| `acme-v02.api.letsencrypt.org` | Let's Encrypt certificate issuance |

Ensure your VPS provider does not block outbound HTTP/HTTPS (most do not).

---

## Step 1 — First Login & System Update

Log in as root (or the default cloud user, e.g., `ubuntu` on AWS):

```bash
ssh root@<VPS-IP>
```

Update all packages to the latest versions and reboot to apply any kernel updates:

```bash
apt update && apt upgrade -y

# If a kernel update was applied, reboot
reboot
```

After reboot, log back in:

```bash
ssh root@<VPS-IP>
```

---

## Step 2 — Create Deploy User & Harden SSH

Running the app as root is a security risk. Create a dedicated `deploy` user:

```bash
# Create the user with a home directory
adduser deploy
# (You will be prompted for a password — set a strong one)

# Grant sudo access
usermod -aG sudo deploy

# Copy your SSH public key from root to the new user so you can log in without a password
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Verify you can SSH as the deploy user **before** disabling root login:

```bash
# From your local machine (new terminal)
ssh deploy@<VPS-IP>
```

Once confirmed, harden SSH:

```bash
sudo nano /etc/ssh/sshd_config
```

Find and set these lines (or add them if missing):

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
X11Forwarding no
MaxAuthTries 3
```

Restart SSH:

```bash
sudo systemctl restart sshd
```

> **From here, all commands are run as the `deploy` user.** Prefix with `sudo` where shown.

---

## Step 3 — Configure the Firewall (UFW)

UFW (Uncomplicated Firewall) is the standard firewall on Ubuntu. Configure it **before** enabling so you don't lock yourself out:

```bash
# Allow SSH first — critical, do this before enabling UFW
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS through Nginx
sudo ufw allow 'Nginx Full'

# Enable the firewall
sudo ufw --force enable

# Verify rules
sudo ufw status verbose
```

Expected output:

```
Status: active

To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW IN    Anywhere
Nginx Full                 ALLOW IN    Anywhere
OpenSSH (v6)               ALLOW IN    Anywhere (v6)
Nginx Full (v6)            ALLOW IN    Anywhere (v6)
```

Port 3000 (the Next.js app) is **intentionally not opened** — Nginx proxies to it internally.

---

## Step 4 — Install Required System Packages

```bash
sudo apt install -y \
  curl \
  wget \
  git \
  unzip \
  build-essential \
  python3 \
  python3-pip \
  sqlite3 \
  htop \
  nano \
  fail2ban \
  logrotate
```

**What each does:**

- `curl` / `wget` — download scripts and files
- `git` — clone the repository
- `unzip` — Bun installer needs this
- `build-essential` — provides `gcc`, `g++`, `make` — required by Prisma's native binaries
- `python3` — required by `node-gyp` for native module compilation
- `sqlite3` — lets you inspect `db.sqlite` from the CLI (`sqlite3 db.sqlite ".tables"`)
- `htop` — monitor CPU/RAM usage interactively
- `fail2ban` — automatically bans IPs that fail SSH logins repeatedly

Enable fail2ban:

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
sudo fail2ban-client status sshd  # verify it's watching SSH
```

---

## Step 5 — Install Bun

Bun is the JavaScript runtime and package manager used to run this app:

```bash
curl -fsSL https://bun.sh/install | bash
```

The installer places Bun at `~/.bun/bin/bun` and adds it to your PATH. Apply it to the current session:

```bash
source ~/.bashrc
# or if you use zsh:
source ~/.zshrc
```

Verify:

```bash
bun --version
# Expected: 1.x.x
```

Make Bun available system-wide so PM2 can find it:

```bash
sudo ln -s "$HOME/.bun/bin/bun" /usr/local/bin/bun
which bun   # should print /usr/local/bin/bun
```

---

## Step 6 — Install Node.js

Node.js 20 LTS is required by Prisma CLI and PM2. Use the official NodeSource repository:

```bash
# Add NodeSource repo for Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js and npm
sudo apt install -y nodejs

# Verify
node --version   # Expected: v20.x.x
npm --version    # Expected: 10.x.x
```

---

## Step 7 — Install Nginx

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Verify Nginx is running
sudo systemctl status nginx
# Should show: active (running)

# Enable it on boot
sudo systemctl enable nginx
```

Remove the default Nginx page (optional, prevents confusion):

```bash
sudo rm /etc/nginx/sites-enabled/default
```

---

## Step 8 — Install Git & Clone the Repository

Git was installed in Step 4. Clone the repository to `/srv/apps`:

```bash
# Create the apps directory and set ownership
sudo mkdir -p /srv/apps
sudo chown deploy:deploy /srv/apps

# Clone
cd /srv/apps
git clone https://github.com/<your-username>/food-twin.git food-twin
cd food-twin

# Verify contents
ls -la
```

You should see: `src/`, `prisma/`, `package.json`, `bun.lockb`, etc.

---

## Step 9 — Configure Environment Variables

The app validates environment variables at startup using Zod (via `src/env.js`). Missing or invalid values will crash the server with a descriptive error.

Create the `.env` file:

```bash
nano /srv/apps/food-twin/.env
```

Paste and fill in your values:

```env
# ──────────────────────────────────────────────────────
# Node environment — must be "production" on the server
# ──────────────────────────────────────────────────────
NODE_ENV="production"

# ──────────────────────────────────────────────────────
# Database
# SQLite file path — use an absolute path in production
# The file is created automatically by Prisma on first migrate
# ──────────────────────────────────────────────────────
DATABASE_URL="file:/srv/apps/food-twin/db.sqlite"

# ──────────────────────────────────────────────────────
# USDA FoodData Central API key
# Required — the app will not start without this
# Get a free key at: https://fdc.nal.usda.gov/api-guide.html
# ──────────────────────────────────────────────────────
USDA_API_KEY="your_usda_api_key_here"

# ──────────────────────────────────────────────────────
# Anthropic Claude API key (optional)
# Enables AI-powered food search via Claude
# Get a key at: https://console.anthropic.com
# Leave blank or omit to disable AI search
# ──────────────────────────────────────────────────────
ANTHROPIC_API_KEY="your_anthropic_api_key_here"
```

Lock down the file so only the deploy user can read it:

```bash
chmod 600 /srv/apps/food-twin/.env
ls -la /srv/apps/food-twin/.env
# Should show: -rw------- 1 deploy deploy
```

---

## Step 10 — Install Dependencies & Generate Prisma Client

```bash
cd /srv/apps/food-twin

# Install all dependencies exactly as locked in bun.lockb
# --frozen-lockfile fails if lockfile is out of date (safe for CI/prod)
bun install --frozen-lockfile
```

This will:
1. Install all `dependencies` and `devDependencies` from `package.json`
2. Automatically run the `postinstall` script (`prisma generate`) to compile the Prisma client

Verify the Prisma client was generated:

```bash
ls node_modules/.prisma/client/
# Should contain: libquery_engine-*.so.node, schema.prisma, etc.
```

If `postinstall` didn't run automatically, generate manually:

```bash
bunx prisma generate
```

---

## Step 11 — Set Up the Database

### Run migrations

This creates the `db.sqlite` file and applies all migration files from `prisma/migrations/`:

```bash
bunx prisma migrate deploy
```

Expected output:

```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database "db.sqlite" at "file:/srv/apps/food-twin/db.sqlite"

N migrations found in prisma/migrations

Applying migration `...`

The following migrations have been applied:
...

All migrations have been successfully applied.
```

Verify the database was created:

```bash
ls -lh /srv/apps/food-twin/db.sqlite
# Should show the file (empty/small before seeding)

# Inspect tables
sqlite3 /srv/apps/food-twin/db.sqlite ".tables"
# Should list: Food, FoodNutrient, Measure, Brand, FoodPortion, etc.
```

### Seed the database

This imports ~350,000 USDA food records. **It takes 5–15 minutes** depending on VPS speed. Do not interrupt it.

```bash
bun db:seed
```

> **Low-RAM warning:** If you're on a 1 GB VPS and skipped the swap setup, this may OOM. Set up swap first (see Hardware Requirements section).

After seeding, check the row count:

```bash
sqlite3 /srv/apps/food-twin/db.sqlite "SELECT COUNT(*) FROM Food;"
# Expected: ~300,000–400,000 rows
```

Check final database file size:

```bash
ls -lh /srv/apps/food-twin/db.sqlite
# Expected: ~1–2 GB
```

---

## Step 12 — Build the Application

Compile Next.js for production. This generates the `.next/` directory with optimized bundles:

```bash
cd /srv/apps/food-twin
bun run build
```

This step:
- Compiles all TypeScript
- Bundles React server/client components
- Generates static pages and RSC payloads
- Optimizes images, fonts (Geist), and CSS

Expected duration: **1–4 minutes** depending on CPU count.

Expected output ends with something like:

```
Route (app)                              Size     First Load JS
┌ ○ /                                   ...
└ ○ /search                             ...

○  (Static)   prerendered as static content
```

If the build fails with an OOM error, increase swap (see Step 1) and try again.

---

## Step 13 — Run with PM2 (Process Manager)

PM2 is a production process manager for Node/Bun apps. It:
- Restarts the app automatically if it crashes
- Persists the process list across reboots via systemd
- Streams and rotates logs
- Supports zero-downtime reloads

### Install PM2

```bash
sudo npm install -g pm2
pm2 --version   # verify
```

### Create an ecosystem config file

An ecosystem file gives PM2 full configuration in one place. Create it:

```bash
nano /srv/apps/food-twin/ecosystem.config.cjs
```

```js
module.exports = {
  apps: [
    {
      name: "food-twin",
      script: "bun",
      args: "run start",
      cwd: "/srv/apps/food-twin",
      instances: 1,           // SQLite is single-writer; keep instances: 1
      exec_mode: "fork",      // fork mode (not cluster) for SQLite compatibility
      watch: false,           // never watch in production
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      error_file: "/var/log/pm2/food-twin-error.log",
      out_file: "/var/log/pm2/food-twin-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
```

Create the log directory:

```bash
sudo mkdir -p /var/log/pm2
sudo chown deploy:deploy /var/log/pm2
```

### Start the app

```bash
cd /srv/apps/food-twin
pm2 start ecosystem.config.cjs

# Verify it started
pm2 status
```

Expected output:

```
┌────┬───────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┐
│ id │ name      │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │
├────┼───────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┤
│ 0  │ food-twin │ default     │ 0.1.0   │ fork    │ 12345    │ 0s     │ 0    │ online    │
└────┴───────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┘
```

Test that the app is responding on port 3000:

```bash
curl -s http://localhost:3000 | head -20
# Should return HTML from the Next.js home page
```

### Enable auto-start on reboot

```bash
pm2 save                              # save current process list
pm2 startup systemd -u deploy --hp /home/deploy
```

PM2 will print a command that looks like:

```
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u deploy --hp /home/deploy
```

**Copy and run that exact command** (it will differ slightly on your system). Then confirm:

```bash
sudo systemctl status pm2-deploy
# Should show: active (running)
```

### Useful PM2 commands

```bash
pm2 status                    # list all processes
pm2 logs food-twin            # stream live logs (Ctrl+C to exit)
pm2 logs food-twin --lines 100  # last 100 log lines
pm2 restart food-twin         # hard restart (brief downtime)
pm2 reload food-twin          # zero-downtime reload (preferred)
pm2 stop food-twin            # stop without removing
pm2 delete food-twin          # remove from PM2 entirely
pm2 monit                     # interactive CPU/RAM monitor
```

---

## Step 14 — Configure Nginx Reverse Proxy

Nginx sits in front of Next.js, handles TLS termination, and serves static assets efficiently.

Create the site config:

```bash
sudo nano /etc/nginx/sites-available/food-twin
```

Paste the following. **Replace every occurrence of `yourdomain.com` with your actual domain:**

```nginx
# Upstream definition (Next.js app)
upstream food_twin {
    server 127.0.0.1:3000;
    keepalive 32;              # reuse connections to Next.js
}

# ── HTTP → HTTPS redirect ──────────────────────────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Let's Encrypt ACME challenge (Certbot needs this)
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect everything else to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# ── HTTPS ──────────────────────────────────────────────────────────────────
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # ── TLS certificates (Certbot fills these in) ─────────────────────────
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # ── Security headers ──────────────────────────────────────────────────
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options           "SAMEORIGIN"   always;
    add_header X-Content-Type-Options    "nosniff"      always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy        "camera=(), microphone=(), geolocation=()" always;

    # ── Request limits ────────────────────────────────────────────────────
    client_max_body_size 10M;        # max upload size
    client_body_timeout  30s;
    client_header_timeout 30s;
    send_timeout         30s;

    # ── Next.js static assets — cache forever (Next.js hashes filenames) ──
    location /_next/static/ {
        proxy_pass http://food_twin;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        expires    365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;            # no need to log static asset hits
    }

    # ── Next.js image optimization endpoint ───────────────────────────────
    location /_next/image {
        proxy_pass http://food_twin;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── All other requests → Next.js ──────────────────────────────────────
    location / {
        proxy_pass         http://food_twin;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;     # WebSocket support
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;       # AI food search can take up to 10 s (see foodRouter.ts)
    }

    # ── Favicon and robots — avoid noisy 404 logs ─────────────────────────
    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/food-twin /etc/nginx/sites-enabled/

# Test configuration syntax
sudo nginx -t
# Expected: nginx: configuration file /etc/nginx/nginx.conf test is successful

# Reload Nginx
sudo systemctl reload nginx
```

---

## Step 15 — Issue TLS Certificate (HTTPS)

**Prerequisites:** Your domain's DNS A record must already point to this VPS IP (verify with `dig +short yourdomain.com`).

Create the webroot directory Certbot uses for ACME challenges:

```bash
sudo mkdir -p /var/www/certbot
```

Issue the certificate:

```bash
sudo certbot --nginx \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email your@email.com \
  --agree-tos \
  --no-eff-email \
  --redirect
```

Certbot will:
1. Verify domain ownership via HTTP challenge
2. Download and install the certificate to `/etc/letsencrypt/live/yourdomain.com/`
3. Edit your Nginx config to wire in the cert paths and redirect HTTP→HTTPS
4. Reload Nginx

Verify HTTPS works:

```bash
curl -I https://yourdomain.com
# Expected: HTTP/2 200
```

### Auto-renewal

Certbot installs a systemd timer that renews certificates automatically before they expire (every 90 days). Verify it:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run    # simulate renewal (no changes made)
```

---

## Step 16 — Tune Nginx for Production

Edit the main Nginx config to improve performance:

```bash
sudo nano /etc/nginx/nginx.conf
```

Inside the `http {}` block, verify or add:

```nginx
# Worker processes — set to number of CPU cores
worker_processes auto;

events {
    worker_connections 1024;
    multi_accept on;
    use epoll;
}

http {
    # Basic settings
    sendfile           on;
    tcp_nopush         on;
    tcp_nodelay        on;
    keepalive_timeout  65;
    types_hash_max_size 2048;
    server_tokens      off;    # hide Nginx version from headers

    # Gzip compression
    gzip              on;
    gzip_vary         on;
    gzip_proxied      any;
    gzip_comp_level   6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/x-javascript
        application/xml
        application/xml+rss
        image/svg+xml;

    # Rate limiting — protects against abuse
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
    limit_req_zone $binary_remote_addr zone=general:10m rate=100r/m;

    # ... rest of existing config ...
}
```

Apply rate limiting to the tRPC endpoint in the site config by adding inside `location /`:

```nginx
limit_req zone=general burst=20 nodelay;
```

And for the API specifically inside an extra block:

```nginx
location /api/trpc/ {
    limit_req zone=api burst=10 nodelay;
    proxy_pass http://food_twin;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

Test and reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Step 17 — Database Backups

The entire database is a single SQLite file. Back it up daily.

### Create the backup script

```bash
mkdir -p /home/deploy/backups/food-twin
nano /home/deploy/backup-food-twin.sh
```

```bash
#!/usr/bin/env bash
set -euo pipefail

DB_PATH="/srv/apps/food-twin/db.sqlite"
BACKUP_DIR="/home/deploy/backups/food-twin"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db-$DATE.sqlite"
KEEP_DAYS=14

# Use SQLite's online backup API (safe while the app is running)
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

# Compress to save disk space
gzip "$BACKUP_FILE"

# Remove backups older than KEEP_DAYS
find "$BACKUP_DIR" -name "db-*.sqlite.gz" -mtime +$KEEP_DAYS -delete

echo "Backup complete: ${BACKUP_FILE}.gz ($(du -sh "${BACKUP_FILE}.gz" | cut -f1))"
```

Make it executable:

```bash
chmod +x /home/deploy/backup-food-twin.sh

# Test it manually first
/home/deploy/backup-food-twin.sh
ls -lh /home/deploy/backups/food-twin/
```

### Schedule it with cron

```bash
crontab -e
```

Add this line (runs at 2:00 AM every day):

```cron
0 2 * * * /home/deploy/backup-food-twin.sh >> /var/log/pm2/food-twin-backup.log 2>&1
```

### Restore from a backup

```bash
# Stop the app to prevent database locks
pm2 stop food-twin

# Decompress
gunzip /home/deploy/backups/food-twin/db-20260506_020000.sqlite.gz

# Replace the database
cp /srv/apps/food-twin/db.sqlite /srv/apps/food-twin/db.sqlite.pre-restore
cp /home/deploy/backups/food-twin/db-20260506_020000.sqlite /srv/apps/food-twin/db.sqlite

# Restart the app
pm2 start food-twin
```

### Copy a backup to your local machine

```bash
# From your local machine
scp deploy@yourdomain.com:/home/deploy/backups/food-twin/db-20260506_020000.sqlite.gz ./
```

---

## Step 18 — Log Rotation

PM2 logs grow indefinitely without rotation. Install the PM2 log rotation module:

```bash
pm2 install pm2-logrotate

# Configure rotation
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7        # keep 7 rotated files
pm2 set pm2-logrotate:compress true   # gzip old logs
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'  # rotate at midnight

# Save config
pm2 save
```

---

## Deploying Updates

Every time you push new code to the repository, run this on the VPS:

```bash
cd /srv/apps/food-twin

# 1. Pull latest code
git pull origin main

# 2. Install any new/updated dependencies
bun install --frozen-lockfile

# 3. Apply any new database migrations (safe to run even if no migrations exist)
bunx prisma migrate deploy

# 4. Rebuild Next.js
bun run build

# 5. Zero-downtime reload (PM2 starts the new build before killing the old one)
pm2 reload food-twin

# 6. Verify the app is healthy
pm2 status
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200
```

> **Schema changes:** If `prisma/schema.prisma` changed, run `bunx prisma generate` before the build step to regenerate the Prisma client.

---

## Health Checks & Monitoring

### Check if the app is responding

```bash
# HTTP check (via Nginx)
curl -I https://yourdomain.com

# Direct check (bypass Nginx)
curl -s http://localhost:3000 | head -5

# tRPC health check (replace with an actual procedure)
curl -s "http://localhost:3000/api/trpc/food.search?input=%7B%22query%22%3A%22apple%22%7D"
```

### Monitor resources

```bash
# Real-time CPU + RAM per process
pm2 monit

# System-wide
htop

# Disk usage
df -h

# Database file size
du -sh /srv/apps/food-twin/db.sqlite

# Nginx access logs (live)
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# App logs (live)
pm2 logs food-twin

# App error logs only
tail -f /var/log/pm2/food-twin-error.log
```

### Set up a simple uptime cron alert (optional)

```bash
nano /home/deploy/healthcheck.sh
```

```bash
#!/usr/bin/env bash
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://yourdomain.com)
if [ "$HTTP_CODE" != "200" ]; then
  echo "$(date): food-twin returned $HTTP_CODE — restarting" >> /var/log/pm2/healthcheck.log
  pm2 restart food-twin
fi
```

```bash
chmod +x /home/deploy/healthcheck.sh
crontab -e
# Add:
# */5 * * * * /home/deploy/healthcheck.sh
```

---

## Troubleshooting Reference

### App won't start

```bash
pm2 logs food-twin --lines 100
# Look for: missing env vars, Prisma connection error, port in use
```

Common causes:

| Error message | Fix |
|--------------|-----|
| `Missing required env var DATABASE_URL` | Check `.env` file exists and has correct path |
| `Cannot find module '.prisma/client'` | Run `bunx prisma generate` |
| `EADDRINUSE: address already in use :3000` | `lsof -i :3000` then `kill <PID>` |
| `Error: P1001: Can't reach database server` | Check `db.sqlite` path in `DATABASE_URL` matches file location |
| `Environment variable not found: USDA_API_KEY` | Add `USDA_API_KEY` to `.env` |

### Nginx errors

```bash
# Syntax errors in config
sudo nginx -t

# Error logs
sudo tail -50 /var/log/nginx/error.log

# Check Nginx is listening on 443
sudo ss -tlnp | grep :443
```

### Database issues

```bash
# Check the file exists and is readable
ls -lh /srv/apps/food-twin/db.sqlite

# Check it's a valid SQLite file (not truncated/corrupted)
sqlite3 /srv/apps/food-twin/db.sqlite "PRAGMA integrity_check;"
# Expected: ok

# Database locked (only one writer allowed in SQLite)
# This usually means two app instances are running
pm2 list            # check for duplicate food-twin entries
pm2 delete food-twin && pm2 start ecosystem.config.cjs

# Check row count
sqlite3 /srv/apps/food-twin/db.sqlite "SELECT COUNT(*) FROM Food;"
```

### TLS / HTTPS issues

```bash
# Check certificate validity
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Check certificate expiry date
echo | openssl s_client -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

### Build failures

```bash
# OOM during build — add/increase swap first
sudo fallocate -l 2G /swapfile2
sudo chmod 600 /swapfile2
sudo mkswap /swapfile2
sudo swapon /swapfile2
bun run build

# TypeScript errors
bun typecheck

# Clean build cache and retry
rm -rf /srv/apps/food-twin/.next
bun run build
```

### General diagnostic commands

| Problem | Command |
|---------|---------|
| What port is 3000 occupied by? | `lsof -i :3000` |
| Is Nginx running? | `sudo systemctl status nginx` |
| Is PM2 running as a service? | `sudo systemctl status pm2-deploy` |
| Did my env vars load? | `pm2 env 0` (shows env for process ID 0) |
| What's using all my disk? | `du -sh /srv/apps/food-twin/*` |
| What crashed the app? | `pm2 logs food-twin --err --lines 200` |

---

## Security Checklist

Run through this before going live:

- [ ] SSH root login disabled (`PermitRootLogin no` in `/etc/ssh/sshd_config`)
- [ ] Password authentication disabled (`PasswordAuthentication no`)
- [ ] UFW enabled with only ports 22, 80, 443 open
- [ ] Fail2ban active and watching SSH (`sudo fail2ban-client status sshd`)
- [ ] `.env` file permissions are `600` (`chmod 600 /srv/apps/food-twin/.env`)
- [ ] Port 3000 is NOT exposed to the internet (Nginx proxies to it internally)
- [ ] HTTPS is working and HTTP redirects to HTTPS
- [ ] HSTS header is set (`Strict-Transport-Security` in Nginx config)
- [ ] `server_tokens off` in Nginx (hides version from attackers)
- [ ] `X-Frame-Options`, `X-Content-Type-Options` headers present
- [ ] Rate limiting is configured on the tRPC API endpoint
- [ ] `ANTHROPIC_API_KEY` and `USDA_API_KEY` are not committed to git
- [ ] Backups are running and verified (check cron, check backup dir)
- [ ] PM2 auto-start on reboot is configured and tested (reboot the VPS once)
- [ ] Certbot auto-renewal timer is active (`sudo systemctl status certbot.timer`)
- [ ] Log rotation is configured (PM2 logrotate module)
