# Everest Textile Mills — Textile Manufacturing & ERP Web System

An end-to-end web platform built in strict compliance with the **RCOD Document (Requirements, Constraints, Objectives, Design)** for **Everest Textile Mills**.

---

## 🎨 Theme & Visual Design
- **Theme**: Basic blue and white and complementary shades of blue:
  - **Deep Mill Navy (`#0f2744`)**: Top navigation and executive branding.
  - **Classic Primary Blue (`#1e3a8a`)**: Primary cards, badges, and headers.
  - **Royal Blue (`#2563eb`)**: Action buttons, active indicators, and progress bars.
  - **Sky Blue & Ice Blue (`#0284c7`, `#e0f2fe`, `#f0f7ff`)**: Subtle backgrounds, stats highlights, and tooltips.
  - **Crisp White (`#ffffff`)**: Clean data tables, modal dialogs, and content cards.
- **Unit of Measure**: Strictly **kg** throughout all yarn stock, orders, machines, and rolls.

---

## 🏗️ Architecture & Stack
- **Database**: 
  - Standard **MySQL schema** provided in [`backend/schema.sql`](file:///c:/Users/lucif/OneDrive/Desktop/oddo/backend/schema.sql).
  - Out-of-the-box **SQLite (`backend/everest_textile.db`)** with foreign keys enabled (`PRAGMA foreign_keys = ON;`) so the system runs immediately with zero external server dependencies.
- **Backend API**: Python **Flask REST API** (`backend/app.py`, `backend/fifo.py`, `backend/database.py`).
- **Frontend**: **React** with modern components, interactive modals, live gauges, and responsive tables (`frontend/`).
- **Seed Data**: 100 Pantone textile colours (with official TCX codes and hex swatches, 12 standard colours flagged `is_standard = 1`), initial machines across Spinning/Weaving/Dyeing, demo users across all 3 roles, workers, stock, and sample orders.

---

## 📋 RCOD Modules Coverage

| Module | Features & Implementation |
|---|---|
| **Module A: Authentication & Roles** | Role-based navigation for **Company** (staff/admin/QC), **Customer** (fabric buyer), and **Supplier**. Live role-switcher in top header for effortless evaluation. |
| **Module B: Yarn Ordering** | Company raises PO to yarn suppliers with Pantone colour dropdown, material type, quantity (kg), and price/kg. Unique `order_no` created with status `not_supplied`. |
| **Module C: Gate Entry** | **Strictly takes exactly four inputs**: Quantity received (kg), Yarn type, Colour, and Yarn Order Number. Validates order exists, is `not_supplied`, and checks type & colour match. Partial delivery warning and auto-recheck of `awaiting_yarn` orders when fully supplied. |
| **Module D: Raw Material Stock & Warnings** | Displays Available, Reserved, and Free stock (`available - reserved`) per (type, colour). Low-stock alert badge/banner when `free <= reorder_level`. 5% wastage formula (`yarn_needed = fabric_kg * 1.05`). Button to pre-fill yarn order for shortfall. |
| **Module E: Production Floor & FIFO** | Sequence: Spinning → Weaving → Dyeing. Auto-assigns oldest queued jobs to idle machines in strict FIFO order. Supervisor logs daily output with shift and worker. Live daily output gauge and downloadable EOD CSV report. |
| **Module F: Quality Check (QC)** | Rolls generated upon dyeing completion with unique `roll_code`. QC Inspector marks `passed`, `rework`, or `rejected`. Defect type mandatory for rework/reject (`hole`, `colour_mismatch`, `uneven_weaving`, `other`). Machine defect traceability report. |
| **Module G: Buyer Order Tracking** | Customer portal with 8-stage progress tracker. Strictly hides machine names, roll IDs, invoices, and mill costs. |
| **Module H: Dispatch & Invoicing** | Roll verification: right rolls, right buyer, right quantity. Roll can only be dispatched once (`UNIQUE` constraint). Matching commercial invoice generated with load details. |
| **Module I: Workers, Wages & Month-End Finance** | Daily shift attendance register. Monthly wage calculation (`days_present * daily_wage`). True order costing (`yarn_cost + allocated_wages`). Live profit/loss indicator in green/red. |
| **Module J: Machine Management** | Add machine (starts as idle, runs FIFO assigner). Machine detail modal with breakdown count, defect rate %, and dated event history. Mark breakdown (returns running job to front of queue). Remove machine (soft delete with reason). |

---

## 🚀 How to Run

### Step 1: Start the Backend (Serves API & Frontend on port 5000)
```powershell
cd c:\Users\lucif\OneDrive\Desktop\oddo\backend
python app.py
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser!

### Step 2 (Optional): Run Frontend in Vite Dev Server
```powershell
cd c:\Users\lucif\OneDrive\Desktop\oddo\frontend
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser!
