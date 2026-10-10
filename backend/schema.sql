-- =======================================================
-- RCOD Document – Textile Manufacturing System
-- Client: Everest Textile Mills
-- Database Schema for MySQL
-- =======================================================

DROP DATABASE IF EXISTS everest_textile;
CREATE DATABASE everest_textile;
USE everest_textile;

-- Reference data
CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('company','customer','supplier') NOT NULL,
  phone VARCHAR(20)
);

CREATE TABLE colours (
  colour_id INT PRIMARY KEY AUTO_INCREMENT,
  colour_name VARCHAR(60) NOT NULL,
  pantone_code VARCHAR(30) UNIQUE NOT NULL,
  hex_value CHAR(7),
  is_standard TINYINT(1) DEFAULT 0
);

CREATE TABLE yarn_types (
  yarn_type_id INT PRIMARY KEY AUTO_INCREMENT,
  type_name VARCHAR(60) UNIQUE NOT NULL      -- e.g. Cotton, Polyester
);

-- Module B/C: yarn orders
CREATE TABLE yarn_orders (
  order_no      VARCHAR(20) PRIMARY KEY,        -- e.g. YO-2026-0001
  supplier_id   INT NOT NULL,                   -- FK users (role=supplier)
  colour_id     INT NOT NULL,                   -- FK colours  (colour)
  yarn_type_id  INT NOT NULL,                   -- FK yarn_types (type)
  quantity      DECIMAL(10,2) NOT NULL,         -- kg ordered
  price_per_kg  DECIMAL(10,2) NOT NULL,
  status        ENUM('not_supplied','supplied') NOT NULL DEFAULT 'not_supplied',
  ordered_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id)  REFERENCES users(user_id),
  FOREIGN KEY (colour_id)    REFERENCES colours(colour_id),
  FOREIGN KEY (yarn_type_id) REFERENCES yarn_types(yarn_type_id)
);

-- Module C: gate entry (4 inputs: qty, type, colour, order_no)
CREATE TABLE yarn_receipts (
  receipt_id    INT PRIMARY KEY AUTO_INCREMENT,
  order_no      VARCHAR(20) NOT NULL,
  yarn_type_id  INT NOT NULL,
  colour_id     INT NOT NULL,
  quantity      DECIMAL(10,2) NOT NULL CHECK (quantity > 0),   -- kg received
  received_by   INT NOT NULL,
  received_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_no) REFERENCES yarn_orders(order_no),
  FOREIGN KEY (yarn_type_id) REFERENCES yarn_types(yarn_type_id),
  FOREIGN KEY (colour_id) REFERENCES colours(colour_id),
  FOREIGN KEY (received_by) REFERENCES users(user_id)
);

-- Module D: stock
CREATE TABLE yarn_stock (
  stock_id      INT PRIMARY KEY AUTO_INCREMENT,
  yarn_type_id  INT NOT NULL,
  colour_id     INT NOT NULL,
  available_kg  DECIMAL(10,2) NOT NULL DEFAULT 0,
  reserved_kg   DECIMAL(10,2) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(10,2) NOT NULL DEFAULT 100,
  UNIQUE (yarn_type_id, colour_id),
  FOREIGN KEY (yarn_type_id) REFERENCES yarn_types(yarn_type_id),
  FOREIGN KEY (colour_id) REFERENCES colours(colour_id)
);

-- Module G: buyer orders
CREATE TABLE buyer_orders (
  order_id       INT PRIMARY KEY AUTO_INCREMENT,
  customer_id    INT NOT NULL,
  yarn_type_id   INT NOT NULL,                  -- fabric/yarn type needed
  colour_id      INT NOT NULL,
  quantity_kg    DECIMAL(10,2) NOT NULL,        -- fabric ordered
  yarn_needed_kg DECIMAL(10,2) NOT NULL,        -- quantity x (1 + wastage)
  price_per_kg   DECIMAL(10,2) NOT NULL,        -- selling price
  deadline       DATE NOT NULL,
  status ENUM('placed','awaiting_yarn','in_queue','spinning','weaving','dyeing',
              'quality_check','ready_to_ship','dispatched') NOT NULL DEFAULT 'placed',
  ready_at       DATETIME NULL,                 -- when it joined FIFO queue
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(user_id),
  FOREIGN KEY (yarn_type_id) REFERENCES yarn_types(yarn_type_id),
  FOREIGN KEY (colour_id) REFERENCES colours(colour_id)
);

-- Module E & J: machines and jobs
CREATE TABLE machines (
  machine_id INT PRIMARY KEY AUTO_INCREMENT,
  machine_name VARCHAR(50) UNIQUE NOT NULL,
  stage ENUM('spinning','weaving','dyeing') NOT NULL,
  status ENUM('idle','running','breakdown','removed') NOT NULL DEFAULT 'idle',
  capacity_kg_per_hr DECIMAL(8,2) NULL,
  installed_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  removed_on DATE NULL,
  removal_reason VARCHAR(255) NULL
);

-- One row per order per stage. status 'queued' rows form the FIFO queue.
CREATE TABLE production_jobs (
  job_id       INT PRIMARY KEY AUTO_INCREMENT,
  order_id     INT NOT NULL,
  stage        ENUM('spinning','weaving','dyeing') NOT NULL,
  machine_id   INT NULL,                        -- NULL while waiting
  target_kg    DECIMAL(10,2) NOT NULL,
  done_kg      DECIMAL(10,2) NOT NULL DEFAULT 0,
  status       ENUM('queued','running','completed') NOT NULL DEFAULT 'queued',
  queued_at    DATETIME DEFAULT CURRENT_TIMESTAMP,   -- FIFO key
  started_at   DATETIME NULL,
  finished_at  DATETIME NULL,
  FOREIGN KEY (order_id) REFERENCES buyer_orders(order_id),
  FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
);

CREATE TABLE production_log (                   -- daily output entries
  log_id     INT PRIMARY KEY AUTO_INCREMENT,
  job_id     INT NOT NULL,
  machine_id INT NOT NULL,
  worker_id  INT NULL,
  shift      ENUM('morning','evening','night') NOT NULL,
  kg_produced DECIMAL(10,2) NOT NULL CHECK (kg_produced > 0),
  logged_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES production_jobs(job_id),
  FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
);

CREATE TABLE daily_reports (                    -- saved end-of-day report
  report_date DATE PRIMARY KEY,
  total_kg    DECIMAL(10,2) NOT NULL,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Module F: rolls and QC
CREATE TABLE fabric_rolls (
  roll_id     INT PRIMARY KEY AUTO_INCREMENT,
  roll_code   VARCHAR(30) UNIQUE NOT NULL,      -- e.g. R-000123
  order_id    INT NOT NULL,                     -- traceability: order
  machine_id  INT NOT NULL,                     -- traceability: machine
  weight_kg   DECIMAL(8,2) NOT NULL,
  produced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  qc_status   ENUM('pending','passed','rework','rejected') NOT NULL DEFAULT 'pending',
  store_status ENUM('not_ready','in_stock','dispatched') NOT NULL DEFAULT 'not_ready',
  FOREIGN KEY (order_id) REFERENCES buyer_orders(order_id),
  FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
);

CREATE TABLE qc_inspections (
  inspection_id INT PRIMARY KEY AUTO_INCREMENT,
  roll_id INT NOT NULL,
  inspector_id INT NOT NULL,
  result ENUM('passed','rework','rejected') NOT NULL,
  defect_type ENUM('hole','colour_mismatch','uneven_weaving','other') NULL,
  notes VARCHAR(255),
  inspected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (roll_id) REFERENCES fabric_rolls(roll_id),
  FOREIGN KEY (inspector_id) REFERENCES users(user_id)
);

-- Module H: dispatch and invoice
CREATE TABLE dispatches (
  dispatch_id INT PRIMARY KEY AUTO_INCREMENT,
  order_id    INT NOT NULL,
  truck_no    VARCHAR(20) NOT NULL,
  dispatched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES buyer_orders(order_id)
);

CREATE TABLE dispatch_items (
  dispatch_id INT NOT NULL,
  roll_id     INT NOT NULL UNIQUE,              -- UNIQUE = a roll can go out only once
  PRIMARY KEY (dispatch_id, roll_id),
  FOREIGN KEY (dispatch_id) REFERENCES dispatches(dispatch_id),
  FOREIGN KEY (roll_id) REFERENCES fabric_rolls(roll_id)
);

CREATE TABLE invoices (
  invoice_id  INT PRIMARY KEY AUTO_INCREMENT,
  invoice_no  VARCHAR(20) UNIQUE NOT NULL,
  dispatch_id INT UNIQUE NOT NULL,              -- one invoice per dispatch
  order_id    INT NOT NULL,
  total_kg    DECIMAL(10,2) NOT NULL,           -- sum of loaded rolls
  amount      DECIMAL(12,2) NOT NULL,           -- total_kg x price_per_kg
  issued_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dispatch_id) REFERENCES dispatches(dispatch_id),
  FOREIGN KEY (order_id) REFERENCES buyer_orders(order_id)
);

-- Module I: workers, wages, payments
CREATE TABLE workers (
  worker_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  daily_wage DECIMAL(8,2) NOT NULL
);

CREATE TABLE attendance (
  worker_id INT NOT NULL,
  work_date DATE NOT NULL,
  shift      ENUM('morning','evening','night') NOT NULL,
  present TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (worker_id, work_date, shift),
  FOREIGN KEY (worker_id) REFERENCES workers(worker_id)
);

CREATE TABLE wage_payments (
  payment_id INT PRIMARY KEY AUTO_INCREMENT,
  worker_id INT NOT NULL,
  month_year CHAR(7) NOT NULL,                  -- '2026-10'
  days_present INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  paid_on DATE NOT NULL,
  FOREIGN KEY (worker_id) REFERENCES workers(worker_id)
);

CREATE TABLE supplier_payments (
  payment_id INT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(20) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  paid_on DATE NOT NULL,
  FOREIGN KEY (order_no) REFERENCES yarn_orders(order_no)
);

CREATE TABLE buyer_payments (
  payment_id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  paid_on DATE NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
);

-- Module J: Machine event history
CREATE TABLE machine_events (
  event_id INT PRIMARY KEY AUTO_INCREMENT,
  machine_id INT NOT NULL,
  event_type ENUM('added','job_started','job_finished','breakdown','repaired','removed') NOT NULL,
  job_id INT NULL,
  note VARCHAR(255),
  user_id INT NULL,
  event_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (machine_id) REFERENCES machines(machine_id),
  FOREIGN KEY (job_id) REFERENCES production_jobs(job_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
