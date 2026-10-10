from datetime import datetime
import uuid

def run_fifo_assigner(cur, conn):
    """
    Assigns queued fabrication jobs to idle machines strictly in FIFO order (by queued_at).
    Single process: 'fabrication'.
    """
    assigned_count = 0

    # Get idle machines for fabrication
    cur.execute(
        "SELECT machine_id, machine_name FROM machines WHERE stage = 'fabrication' AND status = 'idle'"
    )
    idle_machines = cur.fetchall()

    for machine in idle_machines:
        # Find the oldest queued fabrication job (FIFO)
        cur.execute(
            """SELECT job_id, order_id, target_kg 
               FROM production_jobs 
               WHERE stage = 'fabrication' AND status = 'queued' 
               ORDER BY queued_at ASC 
               LIMIT 1"""
        )
        oldest_job = cur.fetchone()

        if oldest_job:
            job_id = oldest_job["job_id"]
            order_id = oldest_job["order_id"]
            mach_id = machine["machine_id"]

            # Assign job to machine
            cur.execute(
                """UPDATE production_jobs 
                   SET machine_id = ?, status = 'running', started_at = datetime('now') 
                   WHERE job_id = ?""",
                (mach_id, job_id)
            )

            # Set machine to running
            cur.execute(
                "UPDATE machines SET status = 'running' WHERE machine_id = ?",
                (mach_id,)
            )

            # Update buyer order status
            cur.execute(
                "UPDATE buyer_orders SET status = 'fabrication' WHERE order_id = ?",
                (order_id,)
            )

            # Log machine event
            cur.execute(
                """INSERT INTO machine_events (machine_id, event_type, job_id, note)
                   VALUES (?, 'job_started', ?, ?)""",
                (mach_id, job_id, f"Auto-assigned Order #{order_id} via FIFO")
            )
            assigned_count += 1

    return assigned_count

def recheck_awaiting_yarn(cur, conn):
    """
    Re-checks buyer orders in 'awaiting_yarn' (oldest first).
    Triggered when new yarn arrives at gate.
    """
    cur.execute(
        """SELECT order_id, yarn_type_id, colour_id, quantity_kg, yarn_needed_kg 
           FROM buyer_orders 
           WHERE status = 'awaiting_yarn' 
           ORDER BY created_at ASC"""
    )
    waiting_orders = cur.fetchall()
    unblocked = 0

    for order in waiting_orders:
        oid = order["order_id"]
        ytid = order["yarn_type_id"]
        cid = order["colour_id"]
        needed = float(order["yarn_needed_kg"])

        cur.execute(
            "SELECT available_kg, reserved_kg FROM yarn_stock WHERE yarn_type_id = ? AND colour_id = ?",
            (ytid, cid)
        )
        st = cur.fetchone()
        if st:
            free = float(st["available_kg"]) - float(st["reserved_kg"])
            if free >= needed:
                # Reserve yarn
                cur.execute(
                    "UPDATE yarn_stock SET reserved_kg = reserved_kg + ? WHERE yarn_type_id = ? AND colour_id = ?",
                    (needed, ytid, cid)
                )
                # Move to in_queue
                cur.execute(
                    "UPDATE buyer_orders SET status = 'in_queue', ready_at = datetime('now') WHERE order_id = ?",
                    (oid,)
                )
                # Create single fabrication job (queued)
                cur.execute(
                    """INSERT INTO production_jobs (order_id, stage, machine_id, target_kg, done_kg, status, queued_at)
                       VALUES (?, 'fabrication', NULL, ?, 0, 'queued', datetime('now'))""",
                    (oid, order["quantity_kg"])
                )
                unblocked += 1

    if unblocked > 0:
        run_fifo_assigner(cur, conn)

    return unblocked

def record_production_log(cur, conn, job_id, worker_id, shift, kg_produced):
    """
    Supervisors / workers record production (kg) against a fabrication job.
    Updates progress and checks if fabrication is completed.
    """
    cur.execute(
        "SELECT job_id, order_id, stage, machine_id, target_kg, done_kg, status FROM production_jobs WHERE job_id = ?",
        (job_id,)
    )
    job = cur.fetchone()
    if not job:
        raise ValueError("Production job not found")

    cur.execute(
        """INSERT INTO production_log (job_id, machine_id, worker_id, shift, kg_produced, logged_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))""",
        (job_id, job["machine_id"], worker_id, shift, kg_produced)
    )

    new_done = float(job["done_kg"]) + float(kg_produced)
    target = float(job["target_kg"])
    machine_id = job["machine_id"]
    order_id = job["order_id"]

    if new_done >= target:
        # Complete fabrication job
        cur.execute(
            """UPDATE production_jobs 
               SET done_kg = ?, status = 'completed', finished_at = datetime('now') 
               WHERE job_id = ?""",
            (new_done, job_id)
        )

        # Free machine
        if machine_id:
            cur.execute("UPDATE machines SET status = 'idle' WHERE machine_id = ?", (machine_id,))
            cur.execute(
                """INSERT INTO machine_events (machine_id, event_type, job_id, note)
                   VALUES (?, 'job_finished', ?, ?)""",
                (machine_id, job_id, f"Finished fabrication for Order #{order_id}")
            )

        # Single process: Fabrication is finished -> Fabric rolls created -> Move to QC
        create_fabric_rolls_for_order(cur, order_id, machine_id, target)
        cur.execute("UPDATE buyer_orders SET status = 'quality_check' WHERE order_id = ?", (order_id,))

        # Run FIFO assigner for freed machine and next queued jobs
        run_fifo_assigner(cur, conn)
    else:
        # Just update done_kg
        cur.execute(
            "UPDATE production_jobs SET done_kg = ? WHERE job_id = ?",
            (new_done, job_id)
        )

    return {"done_kg": new_done, "target_kg": target, "completed": new_done >= target}

def create_fabric_rolls_for_order(cur, order_id, machine_id, total_kg):
    """
    Creates fabric rolls:
    Each roll gets a unique roll code and is linked to order and machine.
    Roll weight: ~50 kg per roll.
    """
    remaining = float(total_kg)
    cur.execute("SELECT COUNT(*) as cnt FROM fabric_rolls WHERE order_id = ?", (order_id,))
    existing_row = cur.fetchone()
    existing_cnt = existing_row["cnt"] if existing_row else 0
    roll_idx = existing_cnt + 1
    roll_weight_standard = 50.0

    while remaining > 0:
        w = min(roll_weight_standard, remaining)
        roll_code = f"R-{order_id:04d}-{roll_idx:02d}"
        cur.execute(
            """INSERT INTO fabric_rolls (roll_code, order_id, machine_id, weight_kg, qc_status, store_status, produced_at)
               VALUES (?, ?, ?, ?, 'pending', 'not_ready', datetime('now'))""",
            (roll_code, order_id, machine_id, round(w, 2))
        )
        remaining -= w
        roll_idx += 1
