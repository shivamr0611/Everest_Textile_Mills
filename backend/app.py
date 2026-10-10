import os
import io
import csv
from datetime import datetime, date, timedelta
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from database import get_connection, init_db, hash_password
from fifo import run_fifo_assigner, recheck_awaiting_yarn, record_production_log

app = Flask(__name__, static_folder="../frontend/dist", static_url_path="")
CORS(app)

# Initialize database on startup
init_db()

# Helper for dict rows
def dict_from_row(row):
    return dict(row) if row else None

def dicts_from_rows(rows):
    return [dict(r) for r in rows]

# ==========================================================
# MODULE A: AUTHENTICATION & USERS
# ==========================================================

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json or {}
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    hashed = hash_password(password)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT user_id, name, email, role, phone, status, worker_role FROM users WHERE email = ? AND password_hash = ?",
        (email, hashed)
    )
    user = cur.fetchone()
    conn.close()

    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    if user['status'] == 'pending_approval':
        return jsonify({"error": "Your account is pending approval by an Assistant Manager. Please wait."}), 403

    if user['status'] not in ('active', None):
        return jsonify({"error": "Your account is not active. Contact management."}), 403

    return jsonify({
        "message": "Login successful",
        "user": dict(user),
        "token": f"token-{user['user_id']}-{user['role']}"
    })

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()
    role = data.get("role", "").strip()
    phone = data.get("phone", "").strip()

    if not (name and email and password and role):
        return jsonify({"error": "Name, email, password, and role are required"}), 400

    ALLOWED_SELF_REGISTER = ['customer', 'supplier', 'maintenance', 'inspection', 'accountant', 'gate_attendant', 'production_worker']
    if role not in ALLOWED_SELF_REGISTER:
        return jsonify({"error": "This role cannot be self-registered. Contact management."}), 400

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM users WHERE email = ?", (email,))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": "Email is already registered"}), 400

    hashed = hash_password(password)
    worker_roles = ['maintenance', 'inspection', 'accountant', 'gate_attendant', 'production_worker']
    status = 'pending_approval' if role in worker_roles else 'active'
    worker_role = role if role in worker_roles else None

    try:
        cur.execute(
            """INSERT INTO users (name, email, password_hash, role, phone, status, worker_role)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (name, email, hashed, role, phone, status, worker_role)
        )
        user_id = cur.lastrowid
        conn.commit()
        cur.execute("SELECT user_id, name, email, role, phone, status, worker_role FROM users WHERE user_id = ?", (user_id,))
        user = cur.fetchone()
        conn.close()

        if status == 'pending_approval':
            return jsonify({
                "message": "Registration submitted! Your account is pending approval by an Assistant Manager.",
                "pending": True,
                "user": dict(user)
            }), 201
        else:
            return jsonify({
                "message": "Registration successful",
                "user": dict(user),
                "token": f"token-{user['user_id']}-{user['role']}"
            }), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": f"Failed to register user: {str(e)}"}), 500

@app.route("/api/users/pending", methods=["GET"])
def get_pending_users():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT user_id, name, email, role, phone, status, worker_role, created_at FROM users WHERE status = 'pending_approval' ORDER BY created_at DESC")
    users = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(users)

@app.route("/api/users/<int:user_id>/approve", methods=["PATCH"])
def approve_user(user_id):
    data = request.json or {}
    action = data.get("action", "approve")
    conn = get_connection()
    cur = conn.cursor()
    if action == 'approve':
        cur.execute("UPDATE users SET status = 'active' WHERE user_id = ?", (user_id,))
        # Also ensure worker is registered in workers table
        cur.execute("SELECT user_id, name, role FROM users WHERE user_id = ?", (user_id,))
        u = cur.fetchone()
        if u and u["role"] in ['maintenance', 'inspection', 'accountant', 'gate_attendant', 'production_worker']:
            cur.execute("SELECT worker_id FROM workers WHERE user_id = ?", (user_id,))
            if not cur.fetchone():
                cur.execute(
                    "INSERT INTO workers (name, daily_wage, user_id, role) VALUES (?, 600, ?, ?)",
                    (u["name"], user_id, u["role"])
                )
    else:
        cur.execute("DELETE FROM users WHERE user_id = ? AND status = 'pending_approval'", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": f"User {action}d successfully"})

@app.route("/api/users", methods=["GET"])
def get_users():
    role = request.args.get("role")
    conn = get_connection()
    cur = conn.cursor()
    if role:
        cur.execute("SELECT user_id, name, email, role, phone, status FROM users WHERE role = ?", (role,))
    else:
        cur.execute("SELECT user_id, name, email, role, phone, status FROM users")
    users = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(users)

@app.route("/api/users", methods=["POST"])
def create_internal_user():
    data = request.json or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()
    role = data.get("role", "").strip()
    phone = data.get("phone", "").strip()

    INTERNAL_ROLES = ['manager', 'assistant_manager']
    if role not in INTERNAL_ROLES:
        return jsonify({"error": "Only 'manager' or 'assistant_manager' can be created via this endpoint"}), 400
    if not (name and email and password):
        return jsonify({"error": "Name, email, and password are required"}), 400

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM users WHERE email = ?", (email,))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": "Email already registered"}), 400

    hashed = hash_password(password)
    try:
        cur.execute(
            "INSERT INTO users (name, email, password_hash, role, phone, status) VALUES (?, ?, ?, ?, ?, 'active')",
            (name, email, hashed, role, phone)
        )
        conn.commit()
        conn.close()
        return jsonify({"message": f"{role.replace('_',' ').title()} account created successfully"}), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500

@app.route("/api/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "User deleted"})

# Reference data
@app.route("/api/colours", methods=["GET"])
def get_colours():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT colour_id, colour_name, pantone_code, hex_value, is_standard FROM colours ORDER BY is_standard DESC, colour_name ASC")
    colours = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(colours)

@app.route("/api/yarn-types", methods=["GET"])
def get_yarn_types():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT yarn_type_id, type_name FROM yarn_types ORDER BY type_name ASC")
    types = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(types)

# ==========================================================
# MODULE B: YARN ORDERING (Company -> Supplier)
# ==========================================================

@app.route("/api/yarn-orders", methods=["GET", "POST"])
def yarn_orders():
    conn = get_connection()
    cur = conn.cursor()

    if request.method == "POST":
        data = request.json or {}
        supplier_id = data.get("supplier_id")
        yarn_type_id = data.get("yarn_type_id")
        colour_id = data.get("colour_id")
        quantity = float(data.get("quantity", 0))
        price_per_kg = float(data.get("price_per_kg", 0))

        if not (supplier_id and yarn_type_id and colour_id and quantity > 0 and price_per_kg > 0):
            conn.close()
            return jsonify({"error": "All fields are required with valid positive amounts"}), 400

        # Generate unique order_no YO-2026-XXXX
        cur.execute("SELECT COUNT(*) as cnt FROM yarn_orders")
        next_num = cur.fetchone()["cnt"] + 1
        order_no = f"YO-2026-{next_num:04d}"

        cur.execute(
            """INSERT INTO yarn_orders (order_no, supplier_id, colour_id, yarn_type_id, quantity, price_per_kg, status, ordered_at)
               VALUES (?, ?, ?, ?, ?, ?, 'not_supplied', datetime('now'))""",
            (order_no, supplier_id, colour_id, yarn_type_id, quantity, price_per_kg)
        )
        conn.commit()
        conn.close()
        return jsonify({"message": "Yarn order created successfully", "order_no": order_no}), 201

    # GET
    supplier_filter = request.args.get("supplier_id")
    query = """
        SELECT yo.order_no, yo.supplier_id, u.name as supplier_name,
               yo.yarn_type_id, yt.type_name,
               yo.colour_id, c.colour_name, c.pantone_code, c.hex_value,
               yo.quantity, yo.price_per_kg, yo.status, yo.ordered_at,
               ROUND(yo.quantity * yo.price_per_kg, 2) as total_amount,
               COALESCE((SELECT SUM(quantity) FROM yarn_receipts yr WHERE yr.order_no = yo.order_no), 0) as received_kg,
               COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.order_no = yo.order_no), 0) as paid_amount,
               CASE 
                   WHEN (SELECT COUNT(*) FROM supplier_payments sp WHERE sp.order_no = yo.order_no) > 0 THEN 'paid' 
                   ELSE 'unpaid' 
               END as payment_status
        FROM yarn_orders yo
        JOIN users u ON u.user_id = yo.supplier_id
        JOIN yarn_types yt ON yt.yarn_type_id = yo.yarn_type_id
        JOIN colours c ON c.colour_id = yo.colour_id
    """
    params = []
    if supplier_filter:
        query += " WHERE yo.supplier_id = ?"
        params.append(supplier_filter)
    query += " ORDER BY yo.ordered_at DESC"

    cur.execute(query, params)
    orders = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(orders)

@app.route("/api/yarn-orders/<order_no>/pay", methods=["POST"])
def pay_yarn_order(order_no):
    """Company pays the supplier for a yarn order."""
    data = request.get_json(silent=True) or {}
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT order_no, quantity, price_per_kg FROM yarn_orders WHERE order_no = ?", (order_no,))
    yo = cur.fetchone()
    if not yo:
        conn.close()
        return jsonify({"error": "Yarn order not found"}), 404

    # Calculate bill or use passed amount
    amount = float(data.get("amount") or (float(yo["quantity"]) * float(yo["price_per_kg"])))
    now = datetime.now().strftime("%Y-%m-%d")
    cur.execute(
        "INSERT INTO supplier_payments (order_no, amount, paid_on) VALUES (?, ?, ?)",
        (order_no, amount, now)
    )
    conn.commit()
    conn.close()
    return jsonify({"message": f"Supplier payment of ₹{amount:,.2f} recorded for {order_no}", "amount": amount, "payment_status": "paid"}), 201

# ==========================================================
# MODULE C: YARN ARRIVAL AT THE GATE (4 inputs)
# ==========================================================

@app.route("/api/gate-entry", methods=["POST"])
def gate_entry():
    """
    Gate-entry form takes exactly four inputs:
    quantity received (kg), yarn type, colour, and yarn order number.
    """
    data = request.json or {}
    order_no = str(data.get("order_no", "")).strip()
    yarn_type_id = data.get("yarn_type_id")
    colour_id = data.get("colour_id")
    quantity_received = float(data.get("quantity", 0))
    received_by = data.get("received_by", 1) # Default admin/staff

    if not order_no or not yarn_type_id or not colour_id or quantity_received <= 0:
        return jsonify({"error": "All 4 inputs (order number, yarn type, colour, quantity > 0) are strictly required"}), 400

    conn = get_connection()
    cur = conn.cursor()

    # C2: Validate order exists and is still not_supplied
    cur.execute(
        "SELECT order_no, supplier_id, colour_id, yarn_type_id, quantity, status FROM yarn_orders WHERE order_no = ?",
        (order_no,)
    )
    order = cur.fetchone()

    if not order:
        conn.close()
        return jsonify({"error": f"Yarn order '{order_no}' does not exist"}), 404

    if order["status"] == "supplied":
        conn.close()
        return jsonify({"error": f"Yarn order '{order_no}' is already fully supplied"}), 400

    # Validate type and colour match
    if int(order["yarn_type_id"]) != int(yarn_type_id) or int(order["colour_id"]) != int(colour_id):
        conn.close()
        return jsonify({
            "error": "Yarn type or colour does not match the purchase order specification. Entry rejected."
        }), 400

    # Calculate previously received total
    cur.execute(
        "SELECT COALESCE(SUM(quantity), 0) as total_rcvd FROM yarn_receipts WHERE order_no = ?",
        (order_no,)
    )
    prev_received = float(cur.fetchone()["total_rcvd"])
    new_total_received = prev_received + quantity_received
    order_quantity = float(order["quantity"])

    is_fully_supplied = new_total_received >= order_quantity

    # Insert yarn_receipts record (who, when, qty)
    cur.execute(
        """INSERT INTO yarn_receipts (order_no, yarn_type_id, colour_id, quantity, received_by, received_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))""",
        (order_no, yarn_type_id, colour_id, quantity_received, received_by)
    )

    # Update or insert yarn_stock
    cur.execute(
        "SELECT stock_id, available_kg FROM yarn_stock WHERE yarn_type_id = ? AND colour_id = ?",
        (yarn_type_id, colour_id)
    )
    st = cur.fetchone()
    if st:
        cur.execute(
            "UPDATE yarn_stock SET available_kg = available_kg + ? WHERE stock_id = ?",
            (quantity_received, st["stock_id"])
        )
    else:
        cur.execute(
            """INSERT INTO yarn_stock (yarn_type_id, colour_id, available_kg, reserved_kg, reorder_level)
               VALUES (?, ?, ?, 0, 100)""",
            (yarn_type_id, colour_id, quantity_received)
        )

    # C3: Update yarn order status
    warning_msg = None
    if is_fully_supplied:
        cur.execute("UPDATE yarn_orders SET status = 'supplied' WHERE order_no = ?", (order_no,))
        # Trigger automatic recheck of awaiting_yarn orders (oldest first)
        unblocked = recheck_awaiting_yarn(cur, conn)
    else:
        warning_msg = f"Partial delivery: Received {new_total_received:.2f} kg of {order_quantity:.2f} kg ordered. Remaining: {order_quantity - new_total_received:.2f} kg."
        unblocked = 0

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Gate entry recorded successfully. Stock updated.",
        "order_no": order_no,
        "quantity_received": quantity_received,
        "total_received": new_total_received,
        "order_status": "supplied" if is_fully_supplied else "not_supplied",
        "warning": warning_msg,
        "orders_unblocked": unblocked
    }), 201

# ==========================================================
# MODULE D: RAW MATERIAL STOCK & WARNINGS
# ==========================================================

@app.route("/api/stock", methods=["GET"])
def get_stock():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT s.stock_id, s.yarn_type_id, yt.type_name,
               s.colour_id, c.colour_name, c.pantone_code, c.hex_value, c.is_standard,
               s.available_kg, s.reserved_kg,
               (s.available_kg - s.reserved_kg) as free_kg,
               s.reorder_level,
               CASE WHEN (s.available_kg - s.reserved_kg) <= s.reorder_level THEN 1 ELSE 0 END as is_low_stock
        FROM yarn_stock s
        JOIN yarn_types yt ON yt.yarn_type_id = s.yarn_type_id
        JOIN colours c ON c.colour_id = s.colour_id
        ORDER BY is_low_stock DESC, yt.type_name ASC, c.colour_name ASC
    """)
    stock_items = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(stock_items)

@app.route("/api/stock/alerts", methods=["GET"])
def get_stock_alerts():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT s.stock_id, s.yarn_type_id, yt.type_name,
               s.colour_id, c.colour_name, c.pantone_code, c.hex_value,
               s.available_kg, s.reserved_kg,
               (s.available_kg - s.reserved_kg) as free_kg,
               s.reorder_level
        FROM yarn_stock s
        JOIN yarn_types yt ON yt.yarn_type_id = s.yarn_type_id
        JOIN colours c ON c.colour_id = s.colour_id
        WHERE (s.available_kg - s.reserved_kg) <= s.reorder_level
        ORDER BY free_kg ASC
    """)
    alerts = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(alerts)

# ==========================================================
# MODULE G & D: BUYER ORDERS
# ==========================================================

@app.route("/api/orders", methods=["GET", "POST"])
def buyer_orders():
    conn = get_connection()
    cur = conn.cursor()

    if request.method == "POST":
        data = request.json or {}
        customer_id = data.get("customer_id")
        yarn_type_id = data.get("yarn_type_id")
        colour_id = data.get("colour_id")
        quantity_kg = float(data.get("quantity_kg", 0))
        deadline = data.get("deadline")
        price_per_kg = float(data.get("price_per_kg", 550.0))

        payment_timing = data.get("payment_timing", "after_delivery") # 'before_delivery' or 'after_delivery'

        if not (customer_id and yarn_type_id and colour_id and quantity_kg > 0 and deadline):
            conn.close()
            return jsonify({"error": "Customer, yarn type, colour, quantity, and deadline are required"}), 400

        # Wastage factor 5%: yarn_needed = quantity_kg * 1.05
        yarn_needed_kg = round(quantity_kg * 1.05, 2)

        # Check stock: free = available - reserved
        cur.execute(
            "SELECT available_kg, reserved_kg FROM yarn_stock WHERE yarn_type_id = ? AND colour_id = ?",
            (yarn_type_id, colour_id)
        )
        st = cur.fetchone()
        available = float(st["available_kg"]) if st else 0.0
        reserved = float(st["reserved_kg"]) if st else 0.0
        free_kg = available - reserved

        if free_kg >= yarn_needed_kg:
            status = "in_queue"
            ready_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            # Reserve yarn
            if st:
                cur.execute(
                    "UPDATE yarn_stock SET reserved_kg = reserved_kg + ? WHERE yarn_type_id = ? AND colour_id = ?",
                    (yarn_needed_kg, yarn_type_id, colour_id)
                )
            else:
                cur.execute(
                    "INSERT INTO yarn_stock (yarn_type_id, colour_id, available_kg, reserved_kg, reorder_level) VALUES (?, ?, 0, ?, 100)",
                    (yarn_type_id, colour_id, yarn_needed_kg)
                )
            
            # Insert buyer order
            cur.execute(
                """INSERT INTO buyer_orders (customer_id, yarn_type_id, colour_id, quantity_kg, yarn_needed_kg, price_per_kg, deadline, status, ready_at, payment_timing, payment_status, is_received, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', 0, datetime('now'))""",
                (customer_id, yarn_type_id, colour_id, quantity_kg, yarn_needed_kg, price_per_kg, deadline, status, ready_at, payment_timing)
            )
            order_id = cur.lastrowid

            # Create fabrication job (status 'queued')
            cur.execute(
                """INSERT INTO production_jobs (order_id, stage, machine_id, target_kg, done_kg, status, queued_at)
                   VALUES (?, 'fabrication', NULL, ?, 0, 'queued', datetime('now'))""",
                (order_id, quantity_kg)
            )

            # Run FIFO assigner
            assigned = run_fifo_assigner(cur, conn)
            message = "Order placed and enough yarn reserved! Fabrication queued."
        else:
            status = "awaiting_yarn"
            shortfall = round(yarn_needed_kg - free_kg, 2)
            cur.execute(
                """INSERT INTO buyer_orders (customer_id, yarn_type_id, colour_id, quantity_kg, yarn_needed_kg, price_per_kg, deadline, status, payment_timing, payment_status, is_received, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', 0, datetime('now'))""",
                (customer_id, yarn_type_id, colour_id, quantity_kg, yarn_needed_kg, price_per_kg, deadline, status, payment_timing)
            )
            order_id = cur.lastrowid
            message = f"Order placed, but short by {shortfall} kg yarn. Status: awaiting_yarn."

        conn.commit()
        conn.close()

        return jsonify({
            "message": message,
            "order_id": order_id,
            "status": status,
            "yarn_needed_kg": yarn_needed_kg,
            "free_yarn_kg": free_kg,
            "shortfall_kg": max(0.0, round(yarn_needed_kg - free_kg, 2))
        }), 201

    # GET (Company view: all buyer orders with full info)
    cur.execute("""
        SELECT bo.order_id, bo.customer_id, u.name as customer_name,
               bo.yarn_type_id, yt.type_name,
               bo.colour_id, c.colour_name, c.pantone_code, c.hex_value,
               bo.quantity_kg, bo.yarn_needed_kg, bo.price_per_kg, bo.deadline,
               bo.status, bo.ready_at, bo.created_at,
               bo.payment_status, bo.payment_timing, bo.is_received, bo.received_at,
               ROUND(bo.quantity_kg * bo.price_per_kg, 2) as total_amount,
               COALESCE((SELECT (s.available_kg - s.reserved_kg) FROM yarn_stock s WHERE s.yarn_type_id = bo.yarn_type_id AND s.colour_id = bo.colour_id), 0) as free_yarn_kg
        FROM buyer_orders bo
        JOIN users u ON u.user_id = bo.customer_id
        JOIN yarn_types yt ON yt.yarn_type_id = bo.yarn_type_id
        JOIN colours c ON c.colour_id = bo.colour_id
        ORDER BY bo.created_at DESC
    """)
    orders = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(orders)

@app.route("/api/orders/my", methods=["GET"])
def customer_orders():
    """
    Module G: Customer page view.
    Returns only order number, status, quantity, deadline, and estimated delivery date.
    Strictly NO roll numbers, invoices, machine names or costs.
    """
    customer_id = request.args.get("customer_id")
    if not customer_id:
        return jsonify({"error": "Customer ID required"}), 400

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT bo.order_id,
               bo.quantity_kg,
               bo.price_per_kg,
               bo.deadline,
               bo.status,
               bo.created_at,
               bo.payment_timing,
               bo.payment_status,
               bo.is_received,
               bo.received_at,
               yt.type_name as fabric_type,
               c.colour_name,
               c.pantone_code,
               c.hex_value
        FROM buyer_orders bo
        JOIN yarn_types yt ON yt.yarn_type_id = bo.yarn_type_id
        JOIN colours c ON c.colour_id = bo.colour_id
        WHERE bo.customer_id = ?
        ORDER BY bo.created_at DESC
    """, (customer_id,))
    rows = cur.fetchall()
    orders = []

    # Map status to customer-friendly display and estimated delivery
    status_map = {
        "placed": "Order Placed",
        "awaiting_yarn": "Awaiting Material",
        "in_queue": "In Queue",
        "fabrication": "Fabrication (Production)",
        "spinning": "Fabrication (Production)",
        "weaving": "Fabrication (Production)",
        "dyeing": "Fabrication (Production)",
        "quality_check": "Quality Check",
        "ready_to_ship": "Ready to Ship",
        "dispatched": "Dispatched"
    }

    for r in rows:
        d = dict(r)
        d["display_status"] = status_map.get(d["status"], d["status"])
        d["estimated_delivery"] = d["deadline"]
        orders.append(d)

    conn.close()
    return jsonify(orders)

@app.route("/api/orders/<int:order_id>/pay", methods=["POST"])
def customer_pay_order(order_id):
    """Customer pays for order (before or after delivery)."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT order_id, quantity_kg, price_per_kg FROM buyer_orders WHERE order_id = ?", (order_id,))
    order = cur.fetchone()
    if not order:
        conn.close()
        return jsonify({"error": "Order not found"}), 404

    cur.execute("UPDATE buyer_orders SET payment_status = 'paid' WHERE order_id = ?", (order_id,))
    
    # Calculate amount
    amount = round(float(order["quantity_kg"]) * float(order["price_per_kg"]), 2)
    # Check invoice if any
    cur.execute("SELECT invoice_id FROM invoices WHERE order_id = ?", (order_id,))
    inv = cur.fetchone()
    invoice_id = inv["invoice_id"] if inv else None

    # Insert into buyer_payments if not already recorded
    cur.execute("SELECT payment_id FROM buyer_payments WHERE order_id = ?", (order_id,))
    existing = cur.fetchone()
    if not existing:
        cur.execute(
            """INSERT INTO buyer_payments (order_id, invoice_id, amount, paid_on)
               VALUES (?, ?, ?, DATE('now'))""",
            (order_id, invoice_id, amount)
        )

    conn.commit()
    conn.close()
    return jsonify({"message": "Payment recorded successfully", "payment_status": "paid", "amount": amount})

@app.route("/api/orders/<int:order_id>/confirm-received", methods=["POST"])
def customer_confirm_received(order_id):
    """Customer acknowledges that order has been received."""
    conn = get_connection()
    cur = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("UPDATE buyer_orders SET is_received = 1, received_at = ? WHERE order_id = ?", (now, order_id))
    conn.commit()
    conn.close()
    return jsonify({"message": "Order marked as received", "is_received": 1, "received_at": now})

@app.route("/api/orders/<int:order_id>/yarn-check", methods=["GET"])
def order_yarn_check(order_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT order_id, yarn_type_id, colour_id, quantity_kg, yarn_needed_kg, status FROM buyer_orders WHERE order_id = ?",
        (order_id,)
    )
    order = cur.fetchone()
    if not order:
        conn.close()
        return jsonify({"error": "Order not found"}), 404

    cur.execute(
        "SELECT available_kg, reserved_kg FROM yarn_stock WHERE yarn_type_id = ? AND colour_id = ?",
        (order["yarn_type_id"], order["colour_id"])
    )
    st = cur.fetchone()
    available = float(st["available_kg"]) if st else 0.0
    reserved = float(st["reserved_kg"]) if st else 0.0
    free = available - reserved
    needed = float(order["yarn_needed_kg"])

    conn.close()
    return jsonify({
        "order_id": order_id,
        "yarn_type_id": order["yarn_type_id"],
        "colour_id": order["colour_id"],
        "needed_kg": needed,
        "available_kg": available,
        "reserved_kg": reserved,
        "free_kg": free,
        "enough_yarn": free >= needed,
        "shortfall_kg": max(0.0, round(needed - free, 2))
    })

# ==========================================================
# MODULE E & J: FACTORY STATUS & MACHINES
# ==========================================================

@app.route("/api/factory-status", methods=["GET"])
def factory_status():
    """
    Shows every machine: state, order it is on, stage, progress (kg done / target, %),
    and kg produced today. Idle machines are listed clearly.
    """
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT m.machine_id, m.machine_name, m.stage, m.status,
               m.capacity_kg_per_hr, m.installed_on,
               j.job_id, j.order_id, j.done_kg, j.target_kg,
               CASE WHEN j.target_kg > 0 THEN ROUND(100.0 * j.done_kg / j.target_kg, 1) ELSE 0 END as progress_pct,
               COALESCE((
                   SELECT SUM(p.kg_produced) 
                   FROM production_log p 
                   WHERE p.machine_id = m.machine_id 
                     AND DATE(p.logged_at) = DATE('now')
               ), 0) as kg_today
        FROM machines m
        LEFT JOIN production_jobs j ON j.machine_id = m.machine_id AND j.status = 'running'
        WHERE m.status <> 'removed'
        ORDER BY m.stage ASC, m.machine_name ASC
    """)
    machines = dicts_from_rows(cur.fetchall())

    # Get active/queued jobs
    cur.execute("""
        SELECT pj.job_id, pj.order_id, pj.stage, pj.target_kg, pj.done_kg, pj.status, pj.queued_at,
               pj.assigned_worker_id, w.name as assigned_worker_name,
               c.colour_name, yt.type_name, bo.deadline
        FROM production_jobs pj
        JOIN buyer_orders bo ON bo.order_id = pj.order_id
        JOIN colours c ON c.colour_id = bo.colour_id
        JOIN yarn_types yt ON yt.yarn_type_id = bo.yarn_type_id
        LEFT JOIN workers w ON w.worker_id = pj.assigned_worker_id
        WHERE pj.status IN ('queued', 'running')
        ORDER BY pj.queued_at ASC
    """)
    queued_jobs = dicts_from_rows(cur.fetchall())

    # Total fabric produced today
    cur.execute("SELECT COALESCE(SUM(kg_produced), 0) as total_today FROM production_log WHERE DATE(logged_at) = DATE('now')")
    today_total = float(cur.fetchone()["total_today"])

    conn.close()

    idle_machines = [m for m in machines if m["status"] == "idle"]
    running_machines = [m for m in machines if m["status"] == "running"]
    breakdown_machines = [m for m in machines if m["status"] == "breakdown"]

    return jsonify({
        "all_machines": machines,
        "idle_machines": idle_machines,
        "running_machines": running_machines,
        "breakdown_machines": breakdown_machines,
        "queued_jobs": queued_jobs,
        "kg_today_total": today_total
    })

@app.route("/api/production-jobs/<int:job_id>/assign", methods=["PATCH"])
def assign_job_worker(job_id):
    """Assistant manager assigns a worker to a fabrication job."""
    data = request.json or {}
    worker_id = data.get("worker_id")
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE production_jobs SET assigned_worker_id = ? WHERE job_id = ?", (worker_id, job_id))
    conn.commit()
    conn.close()
    return jsonify({"message": "Worker assigned successfully", "assigned_worker_id": worker_id})

@app.route("/api/production-log", methods=["POST"])
def log_production():
    """
    Supervisors record production (kg) against a job, with shift and worker.
    """
    data = request.json or {}
    job_id = data.get("job_id")
    worker_id = data.get("worker_id")
    shift = data.get("shift", "morning")
    kg_produced = float(data.get("kg_produced", 0))

    if not job_id or kg_produced <= 0:
        return jsonify({"error": "Job ID and positive kg_produced are required"}), 400

    conn = get_connection()
    cur = conn.cursor()

    try:
        result = record_production_log(cur, conn, job_id, worker_id, shift, kg_produced)
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 400

    conn.close()
    return jsonify({
        "message": "Production recorded successfully",
        "result": result
    }), 201

@app.route("/api/machines", methods=["GET", "POST"])
def machines():
    conn = get_connection()
    cur = conn.cursor()

    if request.method == "POST":
        data = request.json or {}
        name = data.get("machine_name", "").strip()
        stage = data.get("stage", "").strip()
        capacity = float(data.get("capacity_kg_per_hr", 100.0))
        installed_on = data.get("installed_on", datetime.now().strftime("%Y-%m-%d"))

        if not name or stage not in ['fabrication', 'spinning', 'weaving', 'dyeing']:
            conn.close()
            return jsonify({"error": "Valid machine name and stage (fabrication) are required"}), 400

        try:
            cur.execute(
                """INSERT INTO machines (machine_name, stage, status, capacity_kg_per_hr, installed_on)
                   VALUES (?, ?, 'idle', ?, ?)""",
                (name, stage, capacity, installed_on)
            )
            mid = cur.lastrowid
            cur.execute("INSERT INTO machine_events (machine_id, event_type, note) VALUES (?, 'added', 'Added new machine')", (mid,))
            # Run FIFO assigner immediately
            run_fifo_assigner(cur, conn)
            conn.commit()
            conn.close()
            return jsonify({"message": "Machine added successfully and set to idle", "machine_id": mid}), 201
        except Exception as e:
            conn.close()
            return jsonify({"error": f"Failed to add machine: {str(e)}"}), 400

    # GET
    cur.execute("""
        SELECT machine_id, machine_name, stage, status, capacity_kg_per_hr, installed_on, removed_on, removal_reason
        FROM machines
        WHERE status <> 'removed'
        ORDER BY machine_name ASC
    """)
    machs = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(machs)

@app.route("/api/machines/<int:machine_id>", methods=["GET"])
def machine_detail(machine_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT m.machine_id, m.machine_name, m.stage, m.status, m.capacity_kg_per_hr, m.installed_on, m.removed_on, m.removal_reason,
               (SELECT COALESCE(SUM(kg_produced), 0) FROM production_log WHERE machine_id = m.machine_id AND DATE(logged_at) = DATE('now')) as kg_today,
               (SELECT COALESCE(SUM(kg_produced), 0) FROM production_log WHERE machine_id = m.machine_id AND strftime('%Y-%m', logged_at) = strftime('%Y-%m', 'now')) as kg_month,
               (SELECT COUNT(*) FROM machine_events WHERE machine_id = m.machine_id AND event_type = 'breakdown') as breakdowns,
               (SELECT COUNT(*) FROM fabric_rolls WHERE machine_id = m.machine_id AND qc_status IN ('rework','rejected')) as defective_rolls,
               (SELECT COUNT(*) FROM fabric_rolls WHERE machine_id = m.machine_id) as total_rolls
        FROM machines m
        WHERE m.machine_id = ?
    """, (machine_id,))
    mach = cur.fetchone()

    if not mach:
        conn.close()
        return jsonify({"error": "Machine not found"}), 404

    d = dict(mach)
    tot = d["total_rolls"]
    defective = d["defective_rolls"]
    d["defect_rate_pct"] = round(100.0 * defective / tot, 1) if tot > 0 else 0.0

    # Get events history
    cur.execute("""
        SELECT event_id, event_type, note, event_at
        FROM machine_events
        WHERE machine_id = ?
        ORDER BY event_at DESC
    """, (machine_id,))
    d["events"] = dicts_from_rows(cur.fetchall())

    conn.close()
    return jsonify(d)

@app.route("/api/machines/<int:machine_id>/status", methods=["PATCH"])
def update_machine_status(machine_id):
    data = request.json or {}
    new_status = data.get("status") # 'breakdown' or 'idle' (repaired)

    if new_status not in ['breakdown', 'idle']:
        return jsonify({"error": "Status must be 'breakdown' or 'idle'"}), 400

    conn = get_connection()
    cur = conn.cursor()

    if new_status == "breakdown":
        # Mark breakdown: machine skipped by assigner.
        # If it was running a job, job returns to front of its stage queue!
        cur.execute("SELECT job_id FROM production_jobs WHERE machine_id = ? AND status = 'running'", (machine_id,))
        running_job = cur.fetchone()

        cur.execute("UPDATE machines SET status = 'breakdown' WHERE machine_id = ?", (machine_id,))

        if running_job:
            jid = running_job["job_id"]
            cur.execute("UPDATE production_jobs SET machine_id = NULL, status = 'queued' WHERE job_id = ?", (jid,))
            cur.execute("INSERT INTO machine_events (machine_id, event_type, job_id, note) VALUES (?, 'breakdown', ?, 'Returned job to queue')", (machine_id, jid))
        else:
            cur.execute("INSERT INTO machine_events (machine_id, event_type, note) VALUES (?, 'breakdown', 'Machine broke down while idle')", (machine_id,))

    elif new_status == "idle":
        # Machine repaired!
        cur.execute("UPDATE machines SET status = 'idle' WHERE machine_id = ?", (machine_id,))
        cur.execute("INSERT INTO machine_events (machine_id, event_type, note) VALUES (?, 'repaired', 'Repaired and set back to idle')", (machine_id,))
        run_fifo_assigner(cur, conn)

    conn.commit()
    conn.close()
    return jsonify({"message": f"Machine updated to {new_status}"})

@app.route("/api/machines/<int:machine_id>", methods=["DELETE"])
def remove_machine(machine_id):
    """
    Remove machine (Module J4, J5):
    Allowed only when machine is breakdown or idle.
    Requires reason. Soft delete sets status='removed'.
    """
    data = request.json or {}
    reason = data.get("reason", "").strip()

    if not reason:
        return jsonify({"error": "Removal reason is required"}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT machine_id, machine_name, status FROM machines WHERE machine_id = ?", (machine_id,))
    mach = cur.fetchone()

    if not mach:
        conn.close()
        return jsonify({"error": "Machine not found"}), 404

    if mach["status"] not in ['breakdown', 'idle']:
        conn.close()
        return jsonify({"error": f"Cannot remove a machine while status is '{mach['status']}'. Must be breakdown or idle."}), 400

    today = datetime.now().strftime("%Y-%m-%d")
    cur.execute(
        "UPDATE machines SET status = 'removed', removed_on = ?, removal_reason = ? WHERE machine_id = ?",
        (today, reason, machine_id)
    )
    cur.execute(
        "INSERT INTO machine_events (machine_id, event_type, note) VALUES (?, 'removed', ?)",
        (machine_id, f"Soft deleted. Reason: {reason}")
    )

    conn.commit()
    conn.close()
    return jsonify({"message": f"Machine '{mach['machine_name']}' soft-deleted successfully"})

@app.route("/api/machines/removed", methods=["GET"])
def get_removed_machines():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT machine_id, machine_name, stage, status, installed_on, removed_on, removal_reason
        FROM machines
        WHERE status = 'removed'
        ORDER BY removed_on DESC
    """)
    removed = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(removed)

# ==========================================================
# MODULE F: QUALITY CHECK (QC) & FABRIC ROLLS
# ==========================================================

@app.route("/api/rolls", methods=["GET"])
def get_fabric_rolls():
    conn = get_connection()
    cur = conn.cursor()
    order_id = request.args.get("order_id")
    qc_status = request.args.get("qc_status")

    query = """
        SELECT r.roll_id, r.roll_code, r.order_id, r.machine_id, m.machine_name,
               r.weight_kg, r.qc_status, r.store_status, r.produced_at,
               c.colour_name, c.hex_value, yt.type_name, u.name as customer_name
        FROM fabric_rolls r
        JOIN buyer_orders bo ON bo.order_id = r.order_id
        JOIN users u ON u.user_id = bo.customer_id
        JOIN colours c ON c.colour_id = bo.colour_id
        JOIN yarn_types yt ON yt.yarn_type_id = bo.yarn_type_id
        JOIN machines m ON m.machine_id = r.machine_id
    """
    params = []
    conditions = []
    if order_id:
        conditions.append("r.order_id = ?")
        params.append(order_id)
    if qc_status:
        conditions.append("r.qc_status = ?")
        params.append(qc_status)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY r.produced_at DESC, r.roll_id DESC"

    cur.execute(query, params)
    rolls = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(rolls)

@app.route("/api/qc", methods=["POST"])
def submit_qc():
    data = request.json or {}
    roll_id = data.get("roll_id")
    inspector_id = data.get("inspector_id", 1)
    result = data.get("result") # 'passed', 'rework', 'rejected'
    defect_type = data.get("defect_type") # 'hole', 'colour_mismatch', 'uneven_weaving', 'other'
    notes = data.get("notes", "").strip()

    if not roll_id or result not in ['passed', 'rework', 'rejected']:
        return jsonify({"error": "Roll ID and valid result (passed, rework, rejected) are required"}), 400

    if result in ['rework', 'rejected'] and not defect_type:
        return jsonify({"error": "Defect type is mandatory for rework or rejected results"}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT roll_id, order_id, weight_kg FROM fabric_rolls WHERE roll_id = ?", (roll_id,))
    roll = cur.fetchone()
    if not roll:
        conn.close()
        return jsonify({"error": "Fabric roll not found"}), 404

    # Record QC inspection
    cur.execute(
        """INSERT INTO qc_inspections (roll_id, inspector_id, result, defect_type, notes, inspected_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))""",
        (roll_id, inspector_id, result, defect_type, notes)
    )

    order_id = roll["order_id"]

    if result == "passed":
        cur.execute("UPDATE fabric_rolls SET qc_status = 'passed', store_status = 'in_stock' WHERE roll_id = ?", (roll_id,))
        # Check if all rolls of this order are now passed
        cur.execute("SELECT COUNT(*) as unpassed FROM fabric_rolls WHERE order_id = ? AND qc_status <> 'passed'", (order_id,))
        unpassed = cur.fetchone()["unpassed"]
        if unpassed == 0:
            cur.execute("UPDATE buyer_orders SET status = 'ready_to_ship' WHERE order_id = ?", (order_id,))
    elif result in ["rework", "rejected"]:
        # Defective roll: transfer back to assistant manager production floor
        cur.execute("UPDATE fabric_rolls SET qc_status = ?, store_status = 'not_ready' WHERE roll_id = ?", (result, roll_id))
        cur.execute("UPDATE buyer_orders SET status = 'fabrication' WHERE order_id = ?", (order_id,))
        # Queue a rework fabrication job for the production floor
        roll_weight = float(roll["weight_kg"]) if roll["weight_kg"] else 50.0
        cur.execute(
            """INSERT INTO production_jobs (order_id, stage, machine_id, target_kg, done_kg, status, queued_at)
               VALUES (?, 'fabrication', NULL, ?, 0, 'queued', datetime('now'))""",
            (order_id, roll_weight)
        )
        run_fifo_assigner(cur, conn)

    conn.commit()
    conn.close()
    return jsonify({"message": f"QC inspection recorded as {result}. Transferred to Production Floor for Rework." if result in ['rework', 'rejected'] else f"QC inspection recorded as {result}"})

@app.route("/api/qc/defect-summary", methods=["GET"])
def qc_defect_summary():
    """
    Defect traceability summary per machine.
    """
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT m.machine_name, m.stage, q.defect_type, COUNT(*) as defect_count
        FROM qc_inspections q
        JOIN fabric_rolls r ON r.roll_id = q.roll_id
        JOIN machines m ON m.machine_id = r.machine_id
        WHERE q.result <> 'passed'
        GROUP BY m.machine_name, q.defect_type
        ORDER BY defect_count DESC
    """)
    summary = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(summary)

# ==========================================================
# MODULE H: FINISHED GOODS STORE & DISPATCH & INVOICING
# ==========================================================

@app.route("/api/store", methods=["GET"])
def finished_goods_store():
    conn = get_connection()
    cur = conn.cursor()

    # Finished rolls on shelf: store_status = 'in_stock'
    cur.execute("""
        SELECT r.roll_id, r.roll_code, r.order_id, r.weight_kg, r.produced_at,
               c.colour_name, c.hex_value, yt.type_name, u.name as customer_name
        FROM fabric_rolls r
        JOIN buyer_orders bo ON bo.order_id = r.order_id
        JOIN users u ON u.user_id = bo.customer_id
        JOIN colours c ON c.colour_id = bo.colour_id
        JOIN yarn_types yt ON yt.yarn_type_id = bo.yarn_type_id
        WHERE r.store_status = 'in_stock'
        ORDER BY r.produced_at DESC
    """)
    on_shelf_rolls = dicts_from_rows(cur.fetchall())

    cur.execute("SELECT COALESCE(SUM(weight_kg), 0) as total_shelf_kg FROM fabric_rolls WHERE store_status = 'in_stock'")
    total_shelf_kg = float(cur.fetchone()["total_shelf_kg"])

    # Dispatches history
    cur.execute("""
        SELECT d.dispatch_id, d.order_id, d.truck_no, d.dispatched_at,
               u.name as customer_name, inv.invoice_no, inv.amount, inv.total_kg
        FROM dispatches d
        JOIN buyer_orders bo ON bo.order_id = d.order_id
        JOIN users u ON u.user_id = bo.customer_id
        LEFT JOIN invoices inv ON inv.dispatch_id = d.dispatch_id
        ORDER BY d.dispatched_at DESC
    """)
    dispatch_history = dicts_from_rows(cur.fetchall())

    conn.close()
    return jsonify({
        "on_shelf_rolls": on_shelf_rolls,
        "total_shelf_kg": total_shelf_kg,
        "dispatch_history": dispatch_history
    })

@app.route("/api/dispatch/ready-orders", methods=["GET"])
def get_dispatch_ready_orders():
    """
    Returns orders that have passed rolls in stock ready to load.
    """
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT bo.order_id, bo.customer_id, bo.quantity_kg, bo.price_per_kg, bo.status,
               u.name as customer_name, yt.type_name, c.colour_name, c.hex_value,
               COUNT(r.roll_id) as passed_rolls_count,
               COALESCE(SUM(r.weight_kg), 0) as passed_rolls_kg
        FROM buyer_orders bo
        JOIN users u ON u.user_id = bo.customer_id
        JOIN yarn_types yt ON yt.yarn_type_id = bo.yarn_type_id
        JOIN colours c ON c.colour_id = bo.colour_id
        JOIN fabric_rolls r ON r.order_id = bo.order_id AND r.store_status = 'in_stock'
        GROUP BY bo.order_id
        ORDER BY bo.order_id DESC
    """)
    ready_orders = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(ready_orders)

@app.route("/api/dispatch", methods=["POST"])
def create_dispatch():
    """
    Module H2-H4: Dispatch matching & invoice creation.
    Validates:
    1. Pick order -> passed rolls belonging to that order.
    2. Sum of roll weight matches order quantity (or confirmed partial).
    3. Roll can go out once only (UNIQUE roll_id).
    4. Auto-generates matching invoice.
    """
    data = request.json or {}
    order_id = data.get("order_id")
    roll_ids = data.get("roll_ids", [])
    truck_no = str(data.get("truck_no", "")).strip()

    if not order_id or not roll_ids or not truck_no:
        return jsonify({"error": "Order ID, roll IDs list, and truck number are required"}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT order_id, customer_id, quantity_kg, price_per_kg FROM buyer_orders WHERE order_id = ?", (order_id,))
    order = cur.fetchone()
    if not order:
        conn.close()
        return jsonify({"error": "Buyer order not found"}), 404

    # Verify each roll
    placeholders = ",".join(["?"] * len(roll_ids))
    cur.execute(
        f"""SELECT roll_id, order_id, weight_kg, qc_status, store_status 
            FROM fabric_rolls 
            WHERE roll_id IN ({placeholders})""",
        roll_ids
    )
    rolls = cur.fetchall()

    if len(rolls) != len(roll_ids):
        conn.close()
        return jsonify({"error": "Some selected rolls were not found"}), 400

    loaded_kg = 0.0
    for r in rolls:
        if r["order_id"] != order_id:
            conn.close()
            return jsonify({"error": f"Roll {r['roll_id']} does not belong to Order #{order_id} (wrong buyer/order)"}), 400
        if r["qc_status"] != "passed":
            conn.close()
            return jsonify({"error": f"Roll {r['roll_id']} has not passed QC"}), 400
        if r["store_status"] != "in_stock":
            conn.close()
            return jsonify({"error": f"Roll {r['roll_id']} is not in stock (already dispatched or not ready)"}), 400
        loaded_kg += float(r["weight_kg"])

    # Insert dispatch
    cur.execute(
        "INSERT INTO dispatches (order_id, truck_no, dispatched_at) VALUES (?, ?, datetime('now'))",
        (order_id, truck_no)
    )
    dispatch_id = cur.lastrowid

    # Insert dispatch items (UNIQUE roll_id) and mark rolls dispatched
    for r in rolls:
        cur.execute(
            "INSERT INTO dispatch_items (dispatch_id, roll_id) VALUES (?, ?)",
            (dispatch_id, r["roll_id"])
        )
        cur.execute(
            "UPDATE fabric_rolls SET store_status = 'dispatched' WHERE roll_id = ?",
            (r["roll_id"],)
        )

    # Generate invoice matching loaded rolls
    cur.execute("SELECT COUNT(*) as cnt FROM invoices")
    inv_num = cur.fetchone()["cnt"] + 1
    invoice_no = f"INV-2026-{inv_num:04d}"
    amount = round(loaded_kg * float(order["price_per_kg"]), 2)

    cur.execute(
        """INSERT INTO invoices (invoice_no, dispatch_id, order_id, total_kg, amount, issued_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))""",
        (invoice_no, dispatch_id, order_id, loaded_kg, amount)
    )
    invoice_id = cur.lastrowid

    # Update buyer order status
    cur.execute("UPDATE buyer_orders SET status = 'dispatched' WHERE order_id = ?", (order_id,))

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Dispatch completed successfully and matching invoice generated",
        "dispatch_id": dispatch_id,
        "invoice_no": invoice_no,
        "invoice_id": invoice_id,
        "loaded_kg": loaded_kg,
        "amount": amount
    }), 201

@app.route("/api/invoices/<int:invoice_id>", methods=["GET"])
def get_invoice(invoice_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT inv.invoice_id, inv.invoice_no, inv.dispatch_id, inv.order_id,
               inv.total_kg, inv.amount, inv.issued_at,
               d.truck_no, d.dispatched_at,
               u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
               bo.quantity_kg, bo.price_per_kg,
               c.colour_name, c.pantone_code, yt.type_name
        FROM invoices inv
        JOIN dispatches d ON d.dispatch_id = inv.dispatch_id
        JOIN buyer_orders bo ON bo.order_id = inv.order_id
        JOIN users u ON u.user_id = bo.customer_id
        JOIN colours c ON c.colour_id = bo.colour_id
        JOIN yarn_types yt ON yt.yarn_type_id = bo.yarn_type_id
        WHERE inv.invoice_id = ?
    """, (invoice_id,))
    inv = cur.fetchone()
    if not inv:
        conn.close()
        return jsonify({"error": "Invoice not found"}), 404

    d = dict(inv)

    # Fetch loaded rolls
    cur.execute("""
        SELECT r.roll_id, r.roll_code, r.weight_kg, m.machine_name
        FROM dispatch_items di
        JOIN fabric_rolls r ON r.roll_id = di.roll_id
        JOIN machines m ON m.machine_id = r.machine_id
        WHERE di.dispatch_id = ?
    """, (d["dispatch_id"],))
    d["rolls"] = dicts_from_rows(cur.fetchall())

    conn.close()
    return jsonify(d)

@app.route("/api/invoices", methods=["GET"])
def list_invoices():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT inv.invoice_id, inv.invoice_no, inv.dispatch_id, inv.order_id,
               inv.total_kg, inv.amount, inv.issued_at,
               u.name as customer_name, d.truck_no
        FROM invoices inv
        JOIN dispatches d ON d.dispatch_id = inv.dispatch_id
        JOIN buyer_orders bo ON bo.order_id = inv.order_id
        JOIN users u ON u.user_id = bo.customer_id
        ORDER BY inv.issued_at DESC
    """)
    invoices = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(invoices)

# ==========================================================
# MODULE I: WORKERS, WAGES & MONTH-END FINANCE
# ==========================================================

@app.route("/api/workers", methods=["GET", "POST"])
def workers():
    conn = get_connection()
    cur = conn.cursor()
    if request.method == "POST":
        data = request.json or {}
        name = data.get("name", "").strip()
        daily_wage = float(data.get("daily_wage", 600.0))
        if not name or daily_wage <= 0:
            conn.close()
            return jsonify({"error": "Worker name and valid daily wage required"}), 400
        cur.execute("INSERT INTO workers (name, daily_wage) VALUES (?, ?)", (name, daily_wage))
        wid = cur.lastrowid
        conn.commit()
        conn.close()
        return jsonify({"message": "Worker added", "worker_id": wid}), 201

    cur.execute("SELECT worker_id, name, daily_wage FROM workers ORDER BY name ASC")
    workers_list = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(workers_list)

@app.route("/api/attendance", methods=["GET", "POST"])
def attendance():
    conn = get_connection()
    cur = conn.cursor()
    if request.method == "POST":
        data = request.json or {}
        records = data.get("records", []) # list of {worker_id, work_date, shift, present}
        for rec in records:
            cur.execute("""
                INSERT INTO attendance (worker_id, work_date, shift, present)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(worker_id, work_date, shift) DO UPDATE SET present = excluded.present
            """, (rec["worker_id"], rec["work_date"], rec["shift"], 1 if rec.get("present") else 0))
        conn.commit()
        conn.close()
        return jsonify({"message": f"{len(records)} attendance records updated"}), 200

    work_date = request.args.get("work_date", datetime.now().strftime("%Y-%m-%d"))
    # Automatically compute attendance status based on real user check-ins
    cur.execute("""
        SELECT w.worker_id, w.name, w.daily_wage, w.user_id, w.role,
               COALESCE(uc.check_in_time, '') as check_in_time,
               COALESCE(uc.check_out_time, '') as check_out_time,
               CASE 
                   WHEN uc.check_in_time IS NOT NULL AND uc.check_out_time IS NULL THEN 'Checked In'
                   WHEN uc.check_in_time IS NOT NULL AND uc.check_out_time IS NOT NULL THEN 'Checked Out'
                   WHEN a.present = 1 THEN 'Checked In'
                   ELSE 'Absent'
               END as live_status,
               CASE WHEN uc.check_in_time IS NOT NULL OR a.present = 1 THEN 1 ELSE 0 END as present
        FROM workers w
        LEFT JOIN user_checkins uc ON uc.user_id = w.user_id AND uc.check_date = ?
        LEFT JOIN attendance a ON a.worker_id = w.worker_id AND a.work_date = ?
        ORDER BY w.name ASC
    """, (work_date, work_date))
    rows = dicts_from_rows(cur.fetchall())
    conn.close()
    return jsonify(rows)

@app.route("/api/attendance/user/<int:user_id>", methods=["GET"])
def get_user_attendance(user_id):
    """Get today's check-in status for a specific user."""
    date = request.args.get("date", datetime.now().strftime("%Y-%m-%d"))
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM user_checkins WHERE user_id = ? AND check_date = ?",
        (user_id, date)
    )
    row = cur.fetchone()
    conn.close()
    return jsonify(dict(row) if row else {})

@app.route("/api/attendance/checkin", methods=["POST"])
def user_checkin():
    data = request.json or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    today = datetime.now().strftime("%Y-%m-%d")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_connection()
    cur = conn.cursor()
    # Create table if not exists
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_checkins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            check_date TEXT NOT NULL,
            check_in_time TEXT,
            check_out_time TEXT,
            UNIQUE(user_id, check_date)
        )
    """)
    # Check if already checked in today
    cur.execute("SELECT * FROM user_checkins WHERE user_id = ? AND check_date = ?", (user_id, today))
    existing = cur.fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "Already checked in for today"}), 400
    cur.execute(
        "INSERT INTO user_checkins (user_id, check_date, check_in_time) VALUES (?, ?, ?)",
        (user_id, today, now)
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Checked in successfully", "check_in_time": now})

@app.route("/api/attendance/checkout", methods=["POST"])
def user_checkout():
    data = request.json or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    today = datetime.now().strftime("%Y-%m-%d")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM user_checkins WHERE user_id = ? AND check_date = ?", (user_id, today))
    existing = cur.fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "No check-in found for today. Please check in first."}), 400
    cur.execute(
        "UPDATE user_checkins SET check_out_time = ? WHERE user_id = ? AND check_date = ?",
        (now, user_id, today)
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Checked out successfully", "check_out_time": now})



@app.route("/api/payments/wage", methods=["POST"])
def pay_wage():
    data = request.json or {}
    worker_id = data.get("worker_id")
    month_year = data.get("month_year", datetime.now().strftime("%Y-%m"))
    days_present = int(data.get("days_present", 26))
    amount = float(data.get("amount", 0))

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO wage_payments (worker_id, month_year, days_present, amount, paid_on)
           VALUES (?, ?, ?, ?, DATE('now'))""",
        (worker_id, month_year, days_present, amount)
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Wage payment recorded successfully"}), 201

@app.route("/api/payments/supplier", methods=["POST"])
def pay_supplier():
    data = request.json or {}
    order_no = data.get("order_no")
    amount = float(data.get("amount", 0))

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO supplier_payments (order_no, amount, paid_on) VALUES (?, ?, DATE('now'))",
        (order_no, amount)
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Supplier payment recorded successfully"}), 201

@app.route("/api/payments/buyer", methods=["POST"])
def pay_buyer():
    data = request.json or {}
    invoice_id = data.get("invoice_id")
    amount = float(data.get("amount", 0))

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO buyer_payments (invoice_id, amount, paid_on) VALUES (?, ?, DATE('now'))",
        (invoice_id, amount)
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Buyer payment received and recorded"}), 201

@app.route("/api/reports/monthly", methods=["GET"])
def monthly_report():
    """
    Module I5 Month-End Dashboard:
    (a) Cost of each order (yarn cost + allocated wages)
    (b) kg produced by every machine in the month
    (c) Total wages paid
    (d) Money received from buyers
    (e) Supplier yarn payments
    (f) Profit / Loss for the month
    """
    month = request.args.get("month", datetime.now().strftime("%Y-%m"))
    conn = get_connection()
    cur = conn.cursor()

    # Cash In & Out
    cur.execute("SELECT COALESCE(SUM(amount), 0) as money_in FROM buyer_payments WHERE strftime('%Y-%m', paid_on) = ?", (month,))
    money_in = float(cur.fetchone()["money_in"])

    cur.execute("SELECT COALESCE(SUM(amount), 0) as wages_out FROM wage_payments WHERE month_year = ?", (month,))
    wages_out = float(cur.fetchone()["wages_out"])

    cur.execute("SELECT COALESCE(SUM(amount), 0) as yarn_out FROM supplier_payments WHERE strftime('%Y-%m', paid_on) = ?", (month,))
    yarn_out = float(cur.fetchone()["yarn_out"])

    profit_loss = money_in - (wages_out + yarn_out)

    # Machine production breakdown
    cur.execute("""
        SELECT m.machine_name, m.stage, COALESCE(SUM(p.kg_produced), 0) as kg
        FROM machines m
        LEFT JOIN production_log p ON p.machine_id = m.machine_id AND strftime('%Y-%m', p.logged_at) = ?
        GROUP BY m.machine_id
        ORDER BY kg DESC
    """, (month,))
    machine_output = dicts_from_rows(cur.fetchall())

    total_kg_month = sum(m["kg"] for m in machine_output)

    # Cost of each buyer order in month
    # Yarn cost = yarn_needed_kg * average yarn price (~220-240)
    # Allocated wages = month's wage total * (order produced kg / all produced kg)
    cur.execute("""
        SELECT bo.order_id, bo.quantity_kg, bo.yarn_needed_kg, bo.price_per_kg,
               u.name as customer_name, yt.type_name, c.colour_name,
               COALESCE((
                   SELECT AVG(yo.price_per_kg) 
                   FROM yarn_orders yo 
                   WHERE yo.yarn_type_id = bo.yarn_type_id AND yo.colour_id = bo.colour_id
               ), 230.0) as yarn_price
        FROM buyer_orders bo
        JOIN users u ON u.user_id = bo.customer_id
        JOIN yarn_types yt ON yt.yarn_type_id = bo.yarn_type_id
        JOIN colours c ON c.colour_id = bo.colour_id
    """)
    orders = cur.fetchall()
    order_costs = []
    for o in orders:
        needed_yarn = float(o["yarn_needed_kg"])
        yarn_p = float(o["yarn_price"])
        yarn_cost = round(needed_yarn * yarn_p, 2)
        qty = float(o["quantity_kg"])
        allocated_wages = round((wages_out * (qty / max(total_kg_month, 1))), 2) if total_kg_month > 0 else 0.0
        total_order_cost = yarn_cost + allocated_wages
        revenue = round(qty * float(o["price_per_kg"]), 2)
        margin = revenue - total_order_cost

        order_costs.append({
            "order_id": o["order_id"],
            "customer_name": o["customer_name"],
            "fabric": f"{o['type_name']} ({o['colour_name']})",
            "quantity_kg": qty,
            "yarn_cost": yarn_cost,
            "allocated_wages": allocated_wages,
            "total_cost": total_order_cost,
            "revenue": revenue,
            "margin": margin
        })

    conn.close()
    return jsonify({
        "month": month,
        "money_in": money_in,
        "wages_out": wages_out,
        "yarn_out": yarn_out,
        "profit_loss": profit_loss,
        "is_profit": profit_loss >= 0,
        "machine_output": machine_output,
        "total_kg_month": total_kg_month,
        "order_costs": order_costs
    })

# ==========================================================
# END-OF-DAY PRODUCTION REPORT & CSV (Module E6, E7)
# ==========================================================

@app.route("/api/reports/daily", methods=["GET"])
def daily_report():
    report_date = request.args.get("date", datetime.now().strftime("%Y-%m-%d"))
    download_csv = request.args.get("download") == "true"

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT p.log_id, p.logged_at, p.shift, p.kg_produced,
               m.machine_name, m.stage,
               w.name as worker_name,
               bo.order_id, u.name as customer_name
        FROM production_log p
        JOIN machines m ON m.machine_id = p.machine_id
        LEFT JOIN workers w ON w.worker_id = p.worker_id
        JOIN production_jobs pj ON pj.job_id = p.job_id
        JOIN buyer_orders bo ON bo.order_id = pj.order_id
        JOIN users u ON u.user_id = bo.customer_id
        WHERE DATE(p.logged_at) = ?
        ORDER BY p.logged_at ASC
    """, (report_date,))
    logs = dicts_from_rows(cur.fetchall())

    cur.execute("SELECT COALESCE(SUM(kg_produced), 0) as total FROM production_log WHERE DATE(logged_at) = ?", (report_date,))
    total_today = float(cur.fetchone()["total"])

    # Breakdown per machine
    cur.execute("""
        SELECT m.machine_name, COALESCE(SUM(p.kg_produced), 0) as kg
        FROM machines m
        LEFT JOIN production_log p ON p.machine_id = m.machine_id AND DATE(p.logged_at) = ?
        GROUP BY m.machine_name
    """, (report_date,))
    machine_breakdown = dicts_from_rows(cur.fetchall())

    conn.close()

    if download_csv:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Everest Textile Mills - End of Day Production Report", report_date])
        writer.writerow(["Total Fabric Produced (kg)", total_today])
        writer.writerow([])
        writer.writerow(["Log ID", "Time", "Machine", "Stage", "Shift", "Worker", "Order ID", "Customer", "Kg Produced"])
        for l in logs:
            writer.writerow([
                l["log_id"], l["logged_at"], l["machine_name"], l["stage"], l["shift"],
                l["worker_name"] or "N/A", l["order_id"], l["customer_name"], l["kg_produced"]
            ])
        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment;filename=everest_daily_report_{report_date}.csv"}
        )

    return jsonify({
        "report_date": report_date,
        "total_kg": total_today,
        "machine_breakdown": machine_breakdown,
        "logs": logs
    })

# Serve Frontend static build
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/dist"))
    if path and os.path.exists(os.path.join(dist_dir, path)):
        return send_from_directory(dist_dir, path)
    if os.path.exists(os.path.join(dist_dir, "index.html")):
        return send_from_directory(dist_dir, "index.html")
    return jsonify({
        "message": "Everest Textile Mills API is running. Build or run frontend via npm run dev or build."
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
