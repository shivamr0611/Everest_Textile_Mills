import sqlite3
import os
import hashlib
from datetime import datetime
from colors_seed import PANTONE_COLORS

DB_PATH = os.path.join(os.path.dirname(__file__), "everest_textile.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def init_db():
    conn = get_connection()
    cur = conn.cursor()

    # Create tables
    cur.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('company','customer','supplier')),
        phone TEXT
    );

    CREATE TABLE IF NOT EXISTS colours (
        colour_id INTEGER PRIMARY KEY AUTOINCREMENT,
        colour_name TEXT NOT NULL,
        pantone_code TEXT UNIQUE NOT NULL,
        hex_value TEXT,
        is_standard INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS yarn_types (
        yarn_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS yarn_orders (
        order_no TEXT PRIMARY KEY,
        supplier_id INTEGER NOT NULL,
        colour_id INTEGER NOT NULL,
        yarn_type_id INTEGER NOT NULL,
        quantity NUMERIC NOT NULL,
        price_per_kg NUMERIC NOT NULL,
        status TEXT NOT NULL DEFAULT 'not_supplied' CHECK(status IN ('not_supplied','supplied')),
        ordered_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES users(user_id),
        FOREIGN KEY (colour_id) REFERENCES colours(colour_id),
        FOREIGN KEY (yarn_type_id) REFERENCES yarn_types(yarn_type_id)
    );

    CREATE TABLE IF NOT EXISTS yarn_receipts (
        receipt_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT NOT NULL,
        yarn_type_id INTEGER NOT NULL,
        colour_id INTEGER NOT NULL,
        quantity NUMERIC NOT NULL CHECK (quantity > 0),
        received_by INTEGER NOT NULL,
        received_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_no) REFERENCES yarn_orders(order_no),
        FOREIGN KEY (yarn_type_id) REFERENCES yarn_types(yarn_type_id),
        FOREIGN KEY (colour_id) REFERENCES colours(colour_id),
        FOREIGN KEY (received_by) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS yarn_stock (
        stock_id INTEGER PRIMARY KEY AUTOINCREMENT,
        yarn_type_id INTEGER NOT NULL,
        colour_id INTEGER NOT NULL,
        available_kg NUMERIC NOT NULL DEFAULT 0,
        reserved_kg NUMERIC NOT NULL DEFAULT 0,
        reorder_level NUMERIC NOT NULL DEFAULT 100,
        UNIQUE (yarn_type_id, colour_id),
        FOREIGN KEY (yarn_type_id) REFERENCES yarn_types(yarn_type_id),
        FOREIGN KEY (colour_id) REFERENCES colours(colour_id)
    );

    CREATE TABLE IF NOT EXISTS buyer_orders (
        order_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        yarn_type_id INTEGER NOT NULL,
        colour_id INTEGER NOT NULL,
        quantity_kg NUMERIC NOT NULL,
        yarn_needed_kg NUMERIC NOT NULL,
        price_per_kg NUMERIC NOT NULL,
        deadline TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'placed' CHECK(status IN (
            'placed','awaiting_yarn','in_queue','spinning','weaving','dyeing',
            'quality_check','ready_to_ship','dispatched'
        )),
        ready_at TEXT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(user_id),
        FOREIGN KEY (yarn_type_id) REFERENCES yarn_types(yarn_type_id),
        FOREIGN KEY (colour_id) REFERENCES colours(colour_id)
    );

    CREATE TABLE IF NOT EXISTS machines (
        machine_id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_name TEXT UNIQUE NOT NULL,
        stage TEXT NOT NULL CHECK(stage IN ('spinning','weaving','dyeing')),
        status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','running','breakdown','removed')),
        capacity_kg_per_hr NUMERIC NULL,
        installed_on TEXT NOT NULL DEFAULT (DATE('now')),
        removed_on TEXT NULL,
        removal_reason TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS production_jobs (
        job_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        stage TEXT NOT NULL CHECK(stage IN ('spinning','weaving','dyeing')),
        machine_id INTEGER NULL,
        target_kg NUMERIC NOT NULL,
        done_kg NUMERIC NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed')),
        queued_at TEXT DEFAULT CURRENT_TIMESTAMP,
        started_at TEXT NULL,
        finished_at TEXT NULL,
        FOREIGN KEY (order_id) REFERENCES buyer_orders(order_id),
        FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
    );

    CREATE TABLE IF NOT EXISTS production_log (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        machine_id INTEGER NOT NULL,
        worker_id INTEGER NULL,
        shift TEXT NOT NULL CHECK(shift IN ('morning','evening','night')),
        kg_produced NUMERIC NOT NULL CHECK (kg_produced > 0),
        logged_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES production_jobs(job_id),
        FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
    );

    CREATE TABLE IF NOT EXISTS daily_reports (
        report_date TEXT PRIMARY KEY,
        total_kg NUMERIC NOT NULL,
        generated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fabric_rolls (
        roll_id INTEGER PRIMARY KEY AUTOINCREMENT,
        roll_code TEXT NOT NULL,
        order_id INTEGER NOT NULL,
        machine_id INTEGER NOT NULL,
        weight_kg NUMERIC NOT NULL,
        produced_at TEXT DEFAULT CURRENT_TIMESTAMP,
        qc_status TEXT NOT NULL DEFAULT 'pending' CHECK(qc_status IN ('pending','passed','rework','rejected')),
        store_status TEXT NOT NULL DEFAULT 'not_ready' CHECK(store_status IN ('not_ready','in_stock','dispatched')),
        FOREIGN KEY (order_id) REFERENCES buyer_orders(order_id),
        FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
    );

    CREATE TABLE IF NOT EXISTS qc_inspections (
        inspection_id INTEGER PRIMARY KEY AUTOINCREMENT,
        roll_id INTEGER NOT NULL,
        inspector_id INTEGER NOT NULL,
        result TEXT NOT NULL CHECK(result IN ('passed','rework','rejected')),
        defect_type TEXT NULL CHECK(defect_type IN ('hole','colour_mismatch','uneven_weaving','other') OR defect_type IS NULL),
        notes TEXT,
        inspected_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (roll_id) REFERENCES fabric_rolls(roll_id),
        FOREIGN KEY (inspector_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS dispatches (
        dispatch_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        truck_no TEXT NOT NULL,
        dispatched_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES buyer_orders(order_id)
    );

    CREATE TABLE IF NOT EXISTS dispatch_items (
        dispatch_id INTEGER NOT NULL,
        roll_id INTEGER NOT NULL,
        PRIMARY KEY (dispatch_id, roll_id),
        FOREIGN KEY (dispatch_id) REFERENCES dispatches(dispatch_id),
        FOREIGN KEY (roll_id) REFERENCES fabric_rolls(roll_id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
        invoice_id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no TEXT UNIQUE NOT NULL,
        dispatch_id INTEGER UNIQUE NOT NULL,
        order_id INTEGER NOT NULL,
        total_kg NUMERIC NOT NULL,
        amount NUMERIC NOT NULL,
        issued_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dispatch_id) REFERENCES dispatches(dispatch_id),
        FOREIGN KEY (order_id) REFERENCES buyer_orders(order_id)
    );

    CREATE TABLE IF NOT EXISTS workers (
        worker_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        daily_wage NUMERIC NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
        worker_id INTEGER NOT NULL,
        work_date TEXT NOT NULL,
        shift TEXT NOT NULL CHECK(shift IN ('morning','evening','night')),
        present INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (worker_id, work_date, shift),
        FOREIGN KEY (worker_id) REFERENCES workers(worker_id)
    );

    CREATE TABLE IF NOT EXISTS wage_payments (
        payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id INTEGER NOT NULL,
        month_year TEXT NOT NULL,
        days_present INTEGER NOT NULL,
        amount NUMERIC NOT NULL,
        paid_on TEXT NOT NULL,
        FOREIGN KEY (worker_id) REFERENCES workers(worker_id)
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
        payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        paid_on TEXT NOT NULL,
        FOREIGN KEY (order_no) REFERENCES yarn_orders(order_no)
    );

    CREATE TABLE IF NOT EXISTS buyer_payments (
        payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NULL,
        invoice_id INTEGER NULL,
        amount NUMERIC NOT NULL,
        paid_on TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES buyer_orders(order_id),
        FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
    );

    CREATE TABLE IF NOT EXISTS machine_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id INTEGER NOT NULL,
        event_type TEXT NOT NULL CHECK(event_type IN ('added','job_started','job_finished','breakdown','repaired','removed')),
        job_id INTEGER NULL,
        note TEXT,
        user_id INTEGER NULL,
        event_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (machine_id) REFERENCES machines(machine_id),
        FOREIGN KEY (job_id) REFERENCES production_jobs(job_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    );
    """)

    conn.commit()

    # Seed data if colours is empty
    count = cur.execute("SELECT COUNT(*) as cnt FROM colours").fetchone()["cnt"]
    if count == 0:
        seed_data(cur, conn)

    conn.close()

def seed_data(cur, conn):
    print("Seeding Everest Textile Mills initial data...")

    # 1. Colours
    for c in PANTONE_COLORS:
        cur.execute(
            "INSERT INTO colours (colour_name, pantone_code, hex_value, is_standard) VALUES (?, ?, ?, ?)",
            (c["name"], c["code"], c["hex"], c["is_standard"])
        )

    # 2. Yarn types
    yarn_types = ["Cotton", "Polyester", "Linen", "Silk", "Wool", "Viscose"]
    for yt in yarn_types:
        cur.execute("INSERT INTO yarn_types (type_name) VALUES (?)", (yt,))

    # 3. Users (role: company, customer, supplier)
    users = [
        # Company
        ("Everest Admin", "admin@everest.com", hash_password("admin123"), "company", "+91 98765 43210"),
        ("Suresh Sharma (Supervisor)", "suresh@everest.com", hash_password("pass123"), "company", "+91 98765 43211"),
        ("Kavita Nair (QC Inspector)", "kavita@everest.com", hash_password("pass123"), "company", "+91 98765 43212"),
        # Customers (buyers)
        ("Apex Garments (Buyer)", "buyer@apex.com", hash_password("buyer123"), "customer", "+91 98123 45678"),
        ("Global Denim Co (Buyer)", "orders@globaldenim.com", hash_password("buyer123"), "customer", "+91 98234 56789"),
        ("Urban Threads (Buyer)", "purchase@urbanthreads.com", hash_password("buyer123"), "customer", "+91 98345 67890"),
        # Suppliers
        ("Vardhman Spinners (Supplier)", "supplier@vardhman.com", hash_password("supp123"), "supplier", "+91 98456 78901"),
        ("Premier Yarns Ltd (Supplier)", "sales@premieryarns.com", hash_password("supp123"), "supplier", "+91 98567 89012")
    ]
    for u in users:
        cur.execute(
            "INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)",
            u
        )

    # 4. Machines (Module J)
    machines = [
        ("Spinning Frame #1 (SP-01)", "spinning", 120.0, "2025-01-15"),
        ("Spinning Frame #2 (SP-02)", "spinning", 120.0, "2025-02-10"),
        ("Spinning Frame #3 (SP-03)", "spinning", 100.0, "2025-03-01"),
        ("Airjet Loom #1 (WV-01)", "weaving", 80.0, "2025-01-20"),
        ("Rapier Loom #2 (WV-02)", "weaving", 85.0, "2025-02-18"),
        ("Waterjet Loom #3 (WV-03)", "weaving", 90.0, "2025-03-05"),
        ("Softflow Dyeing Vessel #1 (DY-01)", "dyeing", 150.0, "2025-01-25"),
        ("High-Temp Dyeing Vessel #2 (DY-02)", "dyeing", 150.0, "2025-02-22"),
    ]
    for m in machines:
        cur.execute(
            "INSERT INTO machines (machine_name, stage, capacity_kg_per_hr, installed_on, status) VALUES (?, ?, ?, ?, 'idle')",
            m
        )
        mid = cur.lastrowid
        cur.execute("INSERT INTO machine_events (machine_id, event_type, note) VALUES (?, 'added', 'Initial setup')", (mid,))

    # 5. Workers (Module I)
    workers = [
        ("Rajesh Verma", 650.0),
        ("Amitabh Sen", 600.0),
        ("Pooja Choudhary", 650.0),
        ("Sunita Devi", 580.0),
        ("Manoj Tiwari", 620.0),
        ("Vikram Singh", 700.0),
    ]
    for w in workers:
        cur.execute("INSERT INTO workers (name, daily_wage) VALUES (?, ?)", w)

    # 6. Initial yarn stock (Module D)
    # Let's seed some items with healthy stock and one with low stock to trigger D2 warning!
    stocks = [
        (1, 5, 850.0, 100.0, 150.0), # Cotton, Standard Blue -> Free = 750 (Healthy)
        (1, 1, 60.0, 0.0, 100.0),    # Cotton, Standard Red -> Free = 60 <= 100 (LOW STOCK ALERT!)
        (2, 9, 1200.0, 200.0, 200.0),# Polyester, Standard Black -> Free = 1000 (Healthy)
        (3, 10, 450.0, 50.0, 100.0), # Linen, Standard White -> Free = 400 (Healthy)
        (1, 13, 80.0, 0.0, 150.0),   # Cotton, Classic Navy -> Free = 80 <= 150 (LOW STOCK ALERT!)
        (1, 4, 500.0, 50.0, 100.0),  # Cotton, Standard Green -> Free = 450 (Healthy)
    ]
    for s in stocks:
        cur.execute(
            "INSERT INTO yarn_stock (yarn_type_id, colour_id, available_kg, reserved_kg, reorder_level) VALUES (?, ?, ?, ?, ?)",
            s
        )

    # 7. Initial Yarn Orders (Module B)
    # Supplier 1 id=7 (Vardhman), Supplier 2 id=8 (Premier)
    yarn_orders = [
        ("YO-2026-0001", 7, 5, 1, 500.0, 220.0, "supplied", "2026-10-01 09:30:00"),
        ("YO-2026-0002", 7, 1, 1, 300.0, 240.0, "not_supplied", "2026-10-08 11:15:00"),
        ("YO-2026-0003", 8, 13, 1, 400.0, 235.0, "not_supplied", "2026-10-09 14:00:00"),
    ]
    for yo in yarn_orders:
        cur.execute(
            "INSERT INTO yarn_orders (order_no, supplier_id, colour_id, yarn_type_id, quantity, price_per_kg, status, ordered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            yo
        )

    # 8. Yarn Receipts for supplied order (Module C)
    cur.execute(
        "INSERT INTO yarn_receipts (order_no, yarn_type_id, colour_id, quantity, received_by, received_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("YO-2026-0001", 1, 5, 500.0, 1, "2026-10-02 10:00:00")
    )

    # 9. Initial Buyer Orders (Module G)
    # Customer 4 (Apex), 5 (Global Denim), 6 (Urban Threads)
    # Buyer order 1: Apex, 200kg Cotton Standard Blue, yarn_needed = 210kg. Enough yarn!
    cur.execute(
        """INSERT INTO buyer_orders (customer_id, yarn_type_id, colour_id, quantity_kg, yarn_needed_kg, price_per_kg, deadline, status, ready_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (4, 1, 5, 200.0, 210.0, 520.0, "2026-10-25", "in_queue", "2026-10-05 10:00:00", "2026-10-05 09:45:00")
    )
    bo1_id = cur.lastrowid

    # Buyer order 2: Global Denim, 400kg Cotton Classic Navy. Short of yarn -> awaiting_yarn!
    cur.execute(
        """INSERT INTO buyer_orders (customer_id, yarn_type_id, colour_id, quantity_kg, yarn_needed_kg, price_per_kg, deadline, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (5, 1, 13, 400.0, 420.0, 550.0, "2026-10-30", "awaiting_yarn", "2026-10-08 14:20:00")
    )

    # 10. Jobs for bo1: Assign to spinning machine 1 (SP-01)
    cur.execute(
        """INSERT INTO production_jobs (order_id, stage, machine_id, target_kg, done_kg, status, queued_at, started_at)
           VALUES (?, 'spinning', 1, 200.0, 120.0, 'running', '2026-10-05 10:00:00', '2026-10-06 08:00:00')""",
        (bo1_id,)
    )
    job1_id = cur.lastrowid
    cur.execute("UPDATE machines SET status = 'running' WHERE machine_id = 1")
    cur.execute("UPDATE buyer_orders SET status = 'spinning' WHERE order_id = ?", (bo1_id,))
    cur.execute("INSERT INTO machine_events (machine_id, event_type, job_id, note) VALUES (1, 'job_started', ?, 'Order #1 Spinning in progress')", (job1_id,))

    # Log some production for today
    cur.execute(
        """INSERT INTO production_log (job_id, machine_id, worker_id, shift, kg_produced, logged_at)
           VALUES (?, 1, 1, 'morning', 120.0, datetime('now'))""",
        (job1_id,)
    )

    # 11. Initial attendance & finances (Module I)
    today = datetime.now().strftime("%Y-%m-%d")
    cur.execute("INSERT INTO attendance (worker_id, work_date, shift, present) VALUES (1, ?, 'morning', 1)", (today,))
    cur.execute("INSERT INTO attendance (worker_id, work_date, shift, present) VALUES (2, ?, 'morning', 1)", (today,))
    cur.execute("INSERT INTO attendance (worker_id, work_date, shift, present) VALUES (3, ?, 'morning', 1)", (today,))

    # Wage payment record
    cur.execute(
        "INSERT INTO wage_payments (worker_id, month_year, days_present, amount, paid_on) VALUES (1, '2026-09', 26, 16900.0, '2026-10-01')"
    )
    # Supplier payment record
    cur.execute(
        "INSERT INTO supplier_payments (order_no, amount, paid_on) VALUES ('YO-2026-0001', 110000.0, '2026-10-03')"
    )

    conn.commit()
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    init_db()
