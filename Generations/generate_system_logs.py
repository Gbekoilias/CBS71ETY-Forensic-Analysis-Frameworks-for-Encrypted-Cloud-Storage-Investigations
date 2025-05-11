#!/usr/bin/env python3
"""
generate_system_logs.py

Simulates user session logs, including:
- session IDs
- user actions (mount, upload, download, delete)
- timestamps
- memory references
- anomaly flags

Writes the output as JSON to `system_logs.json`.
"""

import json
import random
import uuid
from datetime import datetime, timedelta

# Configuration
NUM_SESSIONS = 100
USERS = [f"user_{chr(c)}" for c in range(ord('A'), ord('A') + 10)]
ACTIONS = ["mount_encrypted_volume", "upload_file", "download_file", "delete_file", "modify_file"]
ANOMALY_PROB = 0.15  # 15% of entries flagged as anomalous

def random_timestamp(start: datetime, end: datetime) -> str:
    """Return a random ISO8601 timestamp between start and end."""
    total = (end - start).total_seconds()
    offset = random.uniform(0, total)
    return (start + timedelta(seconds=offset)).isoformat() + "Z"

def random_memory_ref() -> str:
    """Generate a plausible memory address reference."""
    return hex(random.randint(0x7ffe00000000, 0x7fffffffefff))

def generate_logs(num: int) -> list:
    """Create a list of simulated system log entries."""
    now = datetime.utcnow()
    yesterday = now - timedelta(days=1)
    logs = []

    for _ in range(num):
        session = {
            "session_id": str(uuid.uuid4()),
            "user_id": random.choice(USERS),
            "action": random.choice(ACTIONS),
            "timestamp": random_timestamp(yesterday, now),
            "memory_ref": random_memory_ref(),
            "anomaly_flag": random.random() < ANOMALY_PROB
        }
        logs.append(session)

    # Sort chronologically
    logs.sort(key=lambda x: x["timestamp"])
    return logs

def main():
    logs = generate_logs(NUM_SESSIONS)
    with open("system_logs.json", "w") as f:
        json.dump(logs, f, indent=2)
    print(f"Wrote {len(logs)} session logs to system_logs.json")

if __name__ == "__main__":
    main()
