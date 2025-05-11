import json       # load snapshots
import re         # regex search
from datetime import datetime
#!/usr/bin/env python3
"""
memory_analysis.py

Scan simulated RAM snapshots for known forensic artefacts.
"""

import json
import re
from datetime import datetime

# -------------------------------------------------------------------
# 1) Configuration: which patterns to look for in memory dumps
# -------------------------------------------------------------------
artifact_patterns = {
    # 512-bit Serpent-XTS master key (hex‐encoded, simplified pattern)
    "serpent_xts_key": re.compile(r"([A-Fa-f0-9]{64}){8}"),
    # Master File Table header in NTFS ($MFT)
    "mft_header":      re.compile(rb"\x46\x49\x4C\x45\s\x4D\x46\x54"),  # “FILE MFT”
    # ASCII text fragments (e.g. filenames ending with .docx)
    "plaintext_doc":   re.compile(r"[A-Za-z0-9_\-]+\.(docx|txt|pdf)")
}


def load_snapshots(path="memory_snapshots.json"):
    """Load a list of simulated memory snapshots from JSON."""
    with open(path, "r") as f:
        data = json.load(f)
    return data  # expect list of { snapshot_id, process_id, raw_hex }


def extract_artifacts(snapshots, patterns):
    """
    Scan each snapshot for all patterns.
    Returns list of dicts: { snapshot_id, process_id, artifact_type, match, offset }
    """
    results = []
    for snap in snapshots:
        sid = snap["snapshot_id"]
        pid = snap["process_id"]
        raw = bytes.fromhex(snap["raw_hex"])
        for name, regex in patterns.items():
            for match in regex.finditer(raw):
                results.append({
                    "snapshot_id":   sid,
                    "process_id":    pid,
                    "artifact_type": name,
                    "match":         match.group().hex() if isinstance(match.group(), bytes) else match.group(),
                    "offset":        match.start(),
                    "timestamp":     datetime.utcnow().isoformat() + "Z"
                })
    return results


def save_results(results, outpath="extracted_artifacts.json"):
    """Write the extracted artifacts to disk."""
    with open(outpath, "w") as f:
        json.dump(results, f, indent=2)


if __name__ == "__main__":
    snaps = load_snapshots()
    artifacts = extract_artifacts(snaps, artifact_patterns)
    print(f"[+] Found {len(artifacts)} artefacts across {len(snaps)} snapshots.")
    save_results(artifacts)
      print(f"[+] Saved results to extracted_artifacts.json")