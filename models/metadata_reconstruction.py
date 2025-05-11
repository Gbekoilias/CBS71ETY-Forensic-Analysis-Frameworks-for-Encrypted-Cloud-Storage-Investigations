import json
import pandas as pd
from datetime import datetime, timedelta
#!/usr/bin/env python3
"""
metadata_reconstruction.py

Reconstruct a unified timeline by joining scattered metadata and log events.
"""

import json
import pandas as pd
from datetime import datetime, timedelta

TIME_WINDOW_SEC = 30  # allowable timestamp drift


def load_data(meta_path="metadata.json", log_path="system_logs.json"):
    with open(meta_path) as f:
        meta = json.load(f)
    with open(log_path) as f:
        logs = json.load(f)
    return meta, logs


def to_dataframe(records, time_field):
    """Convert list of dicts to DataFrame and parse timestamps."""
    df = pd.DataFrame(records)
    df[time_field] = pd.to_datetime(df[time_field])
    return df


def reconstruct_timeline(meta_df, log_df, window=TIME_WINDOW_SEC):
    """
    For each metadata entry, find the closest log event for the same file_id
    within ±window seconds, and merge them.
    """
    reconstructed = []
    delta = pd.Timedelta(seconds=window)

    # Index logs by file_id for speed
    logs_grouped = log_df.groupby("file_id")

    for idx, m in meta_df.iterrows():
        fid = m.file_id
        mtime = m.timestamp
        if fid not in logs_grouped.groups:
            continue
        candidates = logs_grouped.get_group(fid)
        # Compute time diff
        candidates["diff"] = (candidates.timestamp - mtime).abs()
        # Filter within window
        nearby = candidates[candidates.diff <= delta]
        if nearby.empty:
            continue
        best = nearby.loc[nearby.diff.idxmin()]
        reconstructed.append({
            "file_id":       fid,
            "metadata_time": mtime.isoformat(),
            "log_time":      best.timestamp.isoformat(),
            "action":        best.action,
            "size":          m.size,
            "session_id":    best.session_id
        })
    return pd.DataFrame(reconstructed)


def save_reconstruction(df, outpath="reconstructed_metadata.json"):
    df.to_json(outpath, orient="records", date_format="iso")


if __name__ == "__main__":
    meta, logs = load_data()
    meta_df = to_dataframe(meta, "timestamp")
    log_df  = to_dataframe(logs, "timestamp")
    recon_df = reconstruct_timeline(meta_df, log_df)
    print(f"[+] Reconstructed {len(recon_df)} metadata‐log events.")
    save_reconstruction(recon_df)

