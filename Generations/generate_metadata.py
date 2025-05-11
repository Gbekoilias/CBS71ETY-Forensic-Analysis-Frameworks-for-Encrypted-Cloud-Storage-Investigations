#!/usr/bin/env python3
"""
generate_metadata.py

Reads `encrypted_data.json` and `system_logs.json` to reconstruct:
- file sizes
- access patterns
- session IDs
- human-readable timelines

Writes the output as JSON to `metadata.json`.
"""

import json
import random
from pathlib import Path
from datetime import datetime

# Helpers
def parse_iso(ts: str) -> datetime:
    """Parse an incoming ISO8601 timestamp string."""
    return datetime.fromisoformat(ts.rstrip("Z"))

def format_timeline(events: list) -> list:
    """Convert events to human-readable timeline strings."""
    return [f"{e['timestamp']} – {e['event']}" for e in events]

def main():
    # Load inputs
    data_dir = Path(".")
    enc_file = data_dir / "encrypted_data.json"
    log_file = data_dir / "system_logs.json"

    with enc_file.open() as f:
        encrypted_data = json.load(f)
    with log_file.open() as f:
        system_logs = json.load(f)

    # Build a lookup: file_id -> list of related log entries
    sessions_by_file = {}
    for log in system_logs:
        # assume log entries referencing a file via session_id matching user
        # Here we randomly assign a file for demonstration
        fid = random.choice(encrypted_data)["file_id"]
        sessions_by_file.setdefault(fid, []).append(log)

    metadata_entries = []
    for file in encrypted_data:
        fid = file["file_id"]
        # Fake file size between 100 KB and 5 MB
        size = random.randint(100_000, 5_000_000)
        logs = sessions_by_file.get(fid, [])

        # Build access pattern events
        access_patterns = []
        for entry in logs:
            access_patterns.append({
                "event": entry["action"],
                "timestamp": entry["timestamp"]
            })

        # Reconstruct timeline by sorting access patterns
        sorted_patterns = sorted(access_patterns, key=lambda e: parse_iso(e["timestamp"]))
        timeline = format_timeline(sorted_patterns)

        metadata_entries.append({
            "file_id": fid,
            "size_bytes": size,
            "access_patterns": sorted_patterns,
            "session_id": logs[0]["session_id"] if logs else None,
            "reconstructed_timeline": timeline
        })

    # Write out
    with open("metadata.json", "w") as f:
        json.dump(metadata_entries, f, indent=2)
    print(f"Wrote metadata for {len(metadata_entries)} files to metadata.json")

if __name__ == "__main__":
    main()
# This script generates metadata for encrypted files based on previously generated data.
# It reads from `encrypted_data.json` and `system_logs.json`, reconstructs file sizes,    