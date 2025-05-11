import json
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from datetime import datetime
#!/usr/bin/env python3
"""
user_behavior_model.py

Model and detect anomalous user behavior from forensic logs.
"""

import json
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from datetime import datetime

OFF_HOUR_START = 0   # midnight
OFF_HOUR_END   = 6   # 6 AM


def load_logs(path="system_logs.json"):
    with open(path) as f:
        return pd.DataFrame(json.load(f))


def preprocess(log_df):
    # Parse timestamp
    log_df["timestamp"] = pd.to_datetime(log_df["timestamp"])
    log_df["hour"] = log_df["timestamp"].dt.hour
    # Identify off-hour events
    log_df["is_off_hour"] = log_df["hour"].apply(
        lambda h: OFF_HOUR_START <= h < OFF_HOUR_END
    )
    return log_df


def engineer_features(log_df):
    """
    For each user_id, compute:
      - session_count: # of distinct sessions
      - avg_actions: total actions / distinct sessions
      - off_hour_pct: fraction of actions in off hours
    """
    agg = log_df.groupby("user_id").agg(
        session_count  = ("session_id", pd.Series.nunique),
        total_actions  = ("action", "count"),
        off_hour_count = ("is_off_hour", "sum")
    ).reset_index()
    agg["avg_actions"]   = agg.total_actions / agg.session_count
    agg["off_hour_pct"]  = agg.off_hour_count / agg.total_actions
    return agg[["user_id", "session_count", "avg_actions", "off_hour_pct"]]


def detect_anomalies(features_df):
    # Fit isolation forest on numeric features
    X = features_df[["session_count", "avg_actions", "off_hour_pct"]]
    iso = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
    features_df["anomaly_score"] = iso.fit_predict(X)  # -1 anomaly, +1 normal
    return features_df


def save_results(df, outpath="user_anomalies.json"):
    df.to_json(outpath, orient="records")


if __name__ == "__main__":
    logs = load_logs()
    logs = preprocess(logs)
    feats = engineer_features(logs)
    outdf = detect_anomalies(feats)
    num_anom = (outdf.anomaly_score == -1).sum()
    print(f"[+] Identified {num_anom} anomalous user profiles out of {len(outdf)} users.")
    save_results(outdf)
      print(f"[+] Results saved to {outdf}")