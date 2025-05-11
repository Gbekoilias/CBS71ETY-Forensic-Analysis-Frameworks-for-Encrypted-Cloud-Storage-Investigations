#!/usr/bin/env python3
"""
generate_encrypted_data.py

Generates a mock dataset of encrypted file metadata, including:
- file IDs
- user IDs
- timestamps
- file hashes
- encryption algorithms

Writes the output as JSON to `encrypted_data.json`.
"""

import json
import uuid
import random
import hashlib
from datetime import datetime, timedelta

# Configuration
NUM_FILES = 50
USERS = [f"user_{chr(c)}" for c in range(ord('A'), ord('A') + 10)]
ALGORITHMS = ["AES-256-XTS", "ChaCha20-Poly1305", "AES-128-CBC"]

def random_timestamp(start: datetime, end: datetime) -> str:
    """Generate an ISO8601 timestamp between two datetimes."""
    diff = (end - start).total_seconds()
    rand_sec = random.uniform(0, diff)
    return (start + timedelta(seconds=rand_sec)).isoformat() + "Z"

def random_hash() -> str:
    """Produce a random 32-byte hex hash."""
    data = uuid.uuid4().bytes + uuid.uuid4().bytes
    return hashlib.sha256(data).hexdigest()

def generate_entries(num: int) -> list:
    """Create a list of encrypted-file metadata entries."""
    now = datetime.utcnow()
    one_day_ago = now - timedelta(days=1)
    entries = []

    for i in range(1, num + 1):
        entry = {
            "file_id": f"file_{i:03d}",
            "user_id": random.choice(USERS),
            "timestamp": random_timestamp(one_day_ago, now),
            "file_hash": random_hash(),
            "encryption_algorithm": random.choice(ALGORITHMS)
        }
        entries.append(entry)

    return entries

def main():
    data = generate_entries(NUM_FILES)
    with open("encrypted_data.json", "w") as f:
        json.dump(data, f, indent=2)
    print(f"Wrote {len(data)} records to encrypted_data.json")

if __name__ == "__main__":
    main()
# End of file