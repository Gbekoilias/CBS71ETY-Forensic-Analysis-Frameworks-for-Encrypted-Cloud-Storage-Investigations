/**
 * workflow_manager.js
 *
 * Defines and executes the forensic workflow:
 *   1. Collect metadata
 *   2. Analyze logs
 *   3. Correlate evidence
 *   4. Raise alerts via decision tree
 */

const EventEmitter = require('events');
const { exec }      = require('child_process');
const dtree         = require('./decision_tree');

// --- 1) Define steps as functions that return Promises --- //
function collectMetadata(sourceFile = '../data/metadata.json') {
  return new Promise((resolve, reject) => {
    console.log('[Workflow] Collecting metadata from', sourceFile);
    // Simulate running metadata_reconstruction.py
    exec(`python3 ../models/metadata_reconstruction.py`, (err, stdout, stderr) => {
      if (err) return reject(stderr);
      console.log(stdout.trim());
      resolve({ step: 'metadata_collected', file: sourceFile });
    });
  });
}

function analyzeLogs(logFile = '../data/system_logs.json') {
  return new Promise((resolve, reject) => {
    console.log('[Workflow] Analyzing logs from', logFile);
    exec(`python3 ../models/user_behavior_model.py`, (err, stdout, stderr) => {
      if (err) return reject(stderr);
      console.log(stdout.trim());
      resolve({ step: 'logs_analyzed', file: logFile });
    });
  });
}

function correlateEvidence(artifactFile = '../models/extracted_artifacts.json') {
  return new Promise((resolve, reject) => {
    console.log('[Workflow] Correlating evidence using', artifactFile);
    // Could invoke another script, or do custom JS correlation
    // Here: just simulate a delay
    setTimeout(() => {
      console.log('[Workflow] Evidence correlation complete');
      resolve({ step: 'evidence_correlated', file: artifactFile });
    }, 1500);
  });
}

// --- 2) Event Bus to coordinate steps --- //
class WorkflowEngine extends EventEmitter {
  constructor() {
    super();
    this.on('start', this.runPipeline.bind(this));
    this.on('stepDone', this.nextStep.bind(this));
  }

  async runPipeline() {
    console.log('[Engine] Starting forensic workflow…');
    try {
      const result = await collectMetadata();
      this.emit('stepDone', result);
    } catch (e) {
      console.error('[Engine] Metadata step failed:', e);
    }
  }

  async nextStep(prev) {
    console.log(`[Engine] Completed: ${prev.step}`);
    switch (prev.step) {
      case 'metadata_collected':
        try {
          const res = await analyzeLogs();
          this.emit('stepDone', res);
        } catch (e) {
          console.error('[Engine] Log analysis failed:', e);
        }
        break;

      case 'logs_analyzed':
        try {
          // After logs, run decision tree on anomalies
          dtree.evaluate('../models/user_anomalies.json');
          const res = await correlateEvidence();
          this.emit('stepDone', res);
        } catch (e) {
          console.error('[Engine] Evidence correlation failed:', e);
        }
        break;

      case 'evidence_correlated':
        console.log('[Engine] Workflow complete. All steps done.');
        break;

      default:
        console.warn('[Engine] Unknown step:', prev.step);
    }
  }
}

// --- 3) Kick it off --- //
if (require.main === module) {
  const engine = new WorkflowEngine();
  engine.emit('start');
}

module.exports = WorkflowEngine;
