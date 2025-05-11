/**
 * decision_tree.js
 *
 * Load anomalies or artifact data and apply rules:
 *   - If user_anomalies.json marks a user as anomalous → alert
 *   - If an extracted encryption key was found outside working hours → alert
 */

const fs   = require('fs');
const path = require('path');

const WORK_HOUR_START = 8;  // 08:00
const WORK_HOUR_END   = 18; // 18:00

// Helper: parse ISO time, get hour
function getHour(isoTimestamp) {
  return new Date(isoTimestamp).getUTCHours();
}

// Rule #1: alert on any anomalous user profile
function ruleAnomalousUser(anomalies) {
  anomalies.forEach(rec => {
    if (rec.anomaly_score === -1) {
      console.warn(`[Alert] Suspicious user activity: user_id=${rec.user_id}`);
    }
  });
}

// Rule #2: encryption keys extracted off-hours
function ruleOffHourKeyExtraction(artifacts) {
  artifacts.forEach(a => {
    if (a.artifact_type === 'serpent_xts_key') {
      const h = getHour(a.timestamp);
      if (h < WORK_HOUR_START || h >= WORK_HOUR_END) {
        console.warn(`[Alert] Key extracted at off-hours (${h}h): snapshot=${a.snapshot_id}`);
      }
    }
  });
}

// Entry point: load JSON and run rules
function evaluate(anomalyPath, artifactPath = '../models/extracted_artifacts.json') {
  console.log('[DecisionTree] Loading anomaly data…');
  const anomalies = JSON.parse(fs.readFileSync(anomalyPath));
  ruleAnomalousUser(anomalies);

  console.log('[DecisionTree] Loading extracted artifact data…');
  const artifacts = JSON.parse(fs.readFileSync(path.resolve(__dirname, artifactPath)));
  ruleOffHourKeyExtraction(artifacts);
}

module.exports = { evaluate };
