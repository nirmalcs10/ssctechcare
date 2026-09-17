# SSC TechCare - Computer Service Center Management System

A modern, full-featured management application tailored for computer service centers, laptop repair shops, and IT hardware workshops.

![Node.js](https://img.shields.io/badge/Node.js-v24-green.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-lightgrey.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3.4-skyblue.svg)

---

## 🌟 Key Features

### 1. 🎫 Device Intake & Job Card Management
- **Unique Ticket Numbering**: e.g., `REP-2026-0001` with barcode and quick lookup.
- **Detailed Hardware Profile**:
  - Device type (*Laptop, Desktop, MacBook, iMac, All-in-One, Mini PC, Server, Gaming Rig, Printer, Monitor*).
  - Brand, Model, Serial Number / Service Tag.
  - OS Password / PIN with show/hide eye toggle.
  - Received Accessories Checklist (*Power Adapter, Bag, Mouse, Cables, Box*).
  - Physical Condition Matrix (*Scratches, Dents, Loose Hinges, Broken Screws, Liquid Spill*).
  - Customer Reported Issues & Symptoms.
- **Workshop State Machine**:
  - `RECEIVED` ➔ `IN_DIAGNOSIS` ➔ `QUOTATION_PENDING` ➔ `APPROVED` ➔ `WAITING_PARTS` ➔ `IN_REPAIR` ➔ `TESTING_QC` ➔ `READY_FOR_PICKUP` ➔ `DELIVERED`.
- **System Inspection Matrix**: Power state, Display, Keyboard, Ports, Thermals, S.M.A.R.T. Drive Health, Battery health.

### 2. 📋 Technician Workbench & Kanban Board
- Interactive visual staging board across all repair stages.
- Filter by technician and priority (*Urgent, High, Normal, Low*).
- Move jobs forward or backward with one click.
- Chronological workshop timeline log for benchmark scores, customer calls, and engineer notes.

### 3. 📦 Spare Parts & Inventory Warehouse
- Complete spare parts catalog: *RAM (DDR4/DDR5), NVMe/SATA SSDs, FHD Display Panels, Laptop Batteries, Cooling Fans, Thermal Pastes, Power Supplies, Hinge kits*.
- Direct Ticket Deduction: Adding a replacement part to a repair ticket automatically deducts warehouse stock and calculates repair cost.
- Low Stock Alerts with configurable minimum thresholds.
- Quick stock adjustments (+/- stock) with reason logging.

### 4. 🧾 Billing, Quotations & Tax Invoices
- Itemized charges: Labor & diagnostic fees + Replaced spare parts.
- Automated tax calculation (configurable GST / VAT rate) & discounts.
- Advance deposit reconciliation & balance due tracking.
- Multiple payment modes (*UPI / QR, Cash, Credit/Debit Card, Bank Transfer*).
- Status tracking (*Paid, Partial, Unpaid*).

### 5. 🖨️ Professional A4 Print Formats
- **A4 Service Intake Job Sheet**:
  - Comprehensive customer drop-off receipt with accessories checklist, physical state, advance payment, terms & conditions, and customer signature line.
- **A4 Official Tax Invoice**:
  - Clean, professional invoice with itemized parts and labor, tax breakdown, balance due, and warranty terms.

### 6. 🔍 Customer Self-Service Status Tracker
- Dedicated portal where customers can enter their Ticket ID or phone number to view live repair progress, diagnosis findings, and pickup readiness without needing staff login.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation
Dependencies are already installed in this workspace. If setting up on a fresh machine:
```bash
# Install root backend dependencies
npm install

# Install frontend client dependencies
cd client
npm install
cd ..
```

### Running the Application

To start both the Express API server (`http://localhost:5000`) and the Vite React frontend (`http://localhost:5173`) concurrently:
```bash
npm run dev
```

Open your browser at **`http://localhost:5173`**.

---

## 🌐 Running on an Online Server

To host this application online so staff and customers can access it over the internet, see our complete guide:
👉 **[DEPLOYMENT.md](DEPLOYMENT.md)**

Covers:
- **Render.com / Railway.app** (1-Click Cloud Hosting)
- **Linux Cloud VPS** (Ubuntu with PM2 & Nginx SSL)
- **Docker & Docker Compose** (`docker compose up -d`)
- **Cloudflare Tunnel** (Run locally in your shop and access globally for free)

---

## 🛠️ Additional Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs backend API server and Vite frontend concurrently |
| `npm run dev:server` | Starts only the Express API backend on port `5000` |
| `npm run dev:client` | Starts only the Vite React frontend on port `5173` |
| `npm run seed` | Resets and populates SQLite database with realistic initial data |
| `npm test` | Runs the automated 12-point API test suite |
| `npm run build` | Compiles production-ready frontend bundle |

---

## 📁 Project Architecture

```
SSC/
├── package.json                 # Unified npm scripts & dependencies
├── test_api.js                  # Automated verification test suite
├── server/
│   ├── src/
│   │   ├── db/
│   │   │   ├── database.js      # SQLite connection & schema initialization
│   │   │   └── seed.js          # Realistic demo dataset (repairs, parts, customers)
│   │   ├── routes/
│   │   │   ├── tickets.js       # Repair ticket CRUD, status transitions, parts, timeline
│   │   │   ├── inventory.js     # Spare parts CRUD & stock adjustments
│   │   │   ├── customers.js     # Customer profiles & service histories
│   │   │   ├── technicians.js   # Staff management & workload stats
│   │   │   ├── invoices.js      # Billing, estimates, tax & payment recording
│   │   │   ├── dashboard.js     # KPIs, active repairs, revenue stats
│   │   │   ├── tracking.js      # Customer self-service lookup API
│   │   │   └── settings.js      # Service center profile configuration
│   │   └── server.js            # Express server entrypoint (port 5000)
│   └── data/
│       └── service_center.db    # Embedded SQLite database file
├── client/
│   ├── index.html
│   ├── vite.config.js           # Vite dev server & proxy setup
│   ├── tailwind.config.js       # Tailwind CSS styling
│   └── src/
│       ├── App.jsx              # Main router & layout controller
│       ├── api/index.js         # Frontend REST API client
│       ├── components/
│       │   ├── Navbar.jsx       # Header with search & quick intake
│       │   ├── Sidebar.jsx      # Navigation sidebar with badge counts
│       │   ├── StatusBadge.jsx  # Stage badges (Received, In Repair, Ready, etc.)
│       │   ├── PriorityBadge.jsx# Urgent, High, Normal, Low indicators
│       │   ├── NewTicketModal.jsx# Comprehensive intake modal
│       │   ├── PrintJobCard.jsx # Print-ready A4 Job Sheet
│       │   └── PrintInvoice.jsx # Print-ready A4 Tax Invoice
│       └── pages/
│           ├── Dashboard.jsx    # Workshop analytics & urgent jobs
│           ├── Tickets.jsx      # Ticket table with filtering & search
│           ├── TicketDetail.jsx # Detailed job card workbench & parts usage
│           ├── KanbanBoard.jsx  # Technician workshop staging board
│           ├── Inventory.jsx    # Spare parts catalog & stock in/out
│           ├── Customers.jsx    # Customer directory & history
│           ├── Invoices.jsx     # Billing, estimates, and payment records
│           ├── Technicians.jsx  # Workshop engineers & workload
│           ├── PublicTrack.jsx  # Customer self-service tracking portal
│           └── Settings.jsx     # Service center profile & tax settings
```
