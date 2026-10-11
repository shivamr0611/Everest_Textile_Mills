"""
Seed new role users into Everest Textile Mills DB.
Run: python seed_roles.py
"""
import sqlite3
import hashlib
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'everest_textile.db')

def hash_password(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Enable FK
cur.execute("PRAGMA foreign_keys = ON")

# Check current schema
cur.execute("PRAGMA table_info(users)")
cols = [r['name'] for r in cur.fetchall()]
print("Users columns:", cols)

# Add status column if missing
if 'status' not in cols:
    cur.execute("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'")
    print("Added 'status' column")

# Add worker_role column if missing
if 'worker_role' not in cols:
    cur.execute("ALTER TABLE users ADD COLUMN worker_role TEXT")
    print("Added 'worker_role' column")

conn.commit()

# Seed users
seed_users = [
    # (name, email, password, role, worker_role, status)
    ('Everest Admin', 'admin@everest.com', 'admin123', 'admin', None, 'active'),
    ('Mill Manager', 'manager@everest.com', 'manager123', 'manager', None, 'active'),
    ('Assistant Manager', 'asst@everest.com', 'asst123', 'assistant_manager', None, 'active'),
    ('Maintenance Staff', 'maintenance@everest.com', 'maint123', 'maintenance', 'maintenance', 'active'),
    ('QC Inspector', 'qc@everest.com', 'qc123', 'inspection', 'inspection', 'active'),
    ('Accountant', 'accounts@everest.com', 'acc123', 'accountant', 'accountant', 'active'),
    ('Gate Attendant', 'gate@everest.com', 'gate123', 'gate_attendant', 'gate_attendant', 'active'),
    # Sample pending workers for approval demo
    ('Raju Mehta', 'raju@example.com', 'raju123', 'maintenance', 'maintenance', 'pending_approval'),
    ('Priya Singh', 'priya@example.com', 'priya123', 'inspection', 'inspection', 'pending_approval'),
]

inserted = 0
skipped = 0
for (name, email, pw, role, worker_role, status) in seed_users:
    cur.execute("SELECT user_id FROM users WHERE email = ?", (email,))
    if cur.fetchone():
        print(f"  SKIP (exists): {email}")
        skipped += 1
        continue
    cur.execute(
        "INSERT INTO users (name, email, password_hash, role, worker_role, status) VALUES (?, ?, ?, ?, ?, ?)",
        (name, email, hash_password(pw), role, worker_role, status)
    )
    print(f"  INSERTED: {email} ({role}) [{status}]")
    inserted += 1

# Update old 'company' role users to 'admin'
cur.execute("UPDATE users SET role='admin', status='active' WHERE role='company'")
updated = cur.rowcount
if updated:
    print(f"  Updated {updated} old 'company' users -> 'admin'")

conn.commit()
conn.close()

print(f"\nDone! Inserted={inserted}, Skipped={skipped}, CompanyUpdated={updated}")

