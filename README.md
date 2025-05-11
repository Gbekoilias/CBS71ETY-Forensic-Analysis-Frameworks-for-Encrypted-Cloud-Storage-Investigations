# encrypted-cloud-forensics-sim

A modular, provider-agnostic proof-of-concept layered framework for forensic investigations in encrypted cloud environments. It leverages volatile memory analysis, log reconstruction, metadata correlation, a lightweight workflow engine, and a real-time web dashboard to reconstruct user sessions, extract encryption keys, detect anomalies, and generate comprehensive forensic reports.

---

## Table of Contents

1. [Features](#features)  
2. [Architecture & Folder Structure](#architecture--folder-structure)  
3. [Prerequisites](#prerequisites)  
4. [Installation](#installation)  
5. [Data Files](#data-files)  
6. [Usage](#usage)  
   1. [Simulation Models](#1-simulation-models)  
   2. [Workflow Engine](#2-workflow-engine)  
   3. [Visualization Dashboard](#3-visualization-dashboard)  
   4. [Generating Final Report](#4-generating-final-report)  
   5. [Full Orchestration via Bash](#5-full-orchestration-via-bash)  
7. [Example Bash Script](#example-bash-script)  
8. [Contributing](#contributing)  
9. [License](#license)  

---

## Features

- **Memory Analysis**: Extract encryption keys & plaintext artifacts from RAM snapshots.  
- **Log Reconstruction**: Parse simulated cloud logs (CloudTrail-style) into session timelines.  
- **Metadata Correlation**: Align filesystem metadata with logs & memory findings to infer behavior.  
- **Workflow Engine**: Rule-based orchestration of steps with anomaly triggers.  
- **Visualization**: React + Chart.js dashboard for interactive timelines, charts, and tables.  
- **Reporting**: Auto-generated HTML forensic reports in `analysis_results/report.html`.  

---

## Architecture & Folder Structure
- **data/**
  - `encrypted_data.json`   _Mocked encrypted file metadata, timestamps, user IDs, file hashes_
  - `system_logs.json`    _Simulated user sessions, memory references, access timestamps, anomalies_
  - `metadata.json`        _Reconstructed metadata: file sizes, access patterns, session IDs, timelines_

- **models/**
  - `memory_analysis.py`        _Python: volatility‐style memory‐artifact extraction_
  - `metadata_reconstruction.py` _Python: piece together fragmented metadata & align with logs_
  - `user_behavior_model.py`    _Python: simulate user actions & anomaly detection_

- **workflow_engine/**
  - `workflow_manager.js`   _Node.js: orchestrates metadata ➔ logs ➔ correlation steps_
  - `decision_tree.js`        _JS: rule‐based alerts for suspicious encrypted activity_

- **visualization/**
  - `dashboard.html`        _React + Chart.js interface for timelines, graphs & anomaly highlights_
  - `scripts.js`                _Event handlers, data fetch (WebSockets/REST) & UI glue code_
  - `graph_data.js`           _D3/Chart.js data‐prep functions for evidence‐flow diagrams_

- **analysis_results/**
  - `analysis_output.json` _Final structured simulation output: reconstructed events, summaries_
  - `report.html`               _Auto‐generated HTML forensic report with embedded charts & tables_

- **README.md**                _Project overview, setup instructions, and usage guide._
---

## Prerequisites
- **Python 3.8+**  
- **Node.js 14+** and **npm**  
- Modern web browser (for dashboard & report)  

---

## Installation
### 1. Clone
```bash
git clone https://github.com/your-org/encrypted-cloud-forensics-sim.git
cd encrypted-cloud-forensics-sim
```
### 2. Python dependencies (optional; virtualenv recommended)
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
### 3. Node.js dependencies
```bash
cd visualization && npm install && cd ../workflow_engine && npm install && cd ..
```

## Data Files
- ```data/encrypted_data.json```
Mock encrypted-file metadata: file hashes, timestamps, user IDs.

- ```data/system_logs.json```
Simulated logs: user sessions, memory references, access timestamps, anomalies.

- ```data/metadata.json```
Pre-reconstructed metadata: file sizes, access patterns, session IDs, timeline data.

## Usage
### 1. Simulation Models
- Generate intermediate artifacts:
#### Memory analysis: extract keys & artefacts
python3 models/memory_analysis.py \
  --input data/system_logs.json \
  --output analysis_results/memory_artifacts.json

#### Metadata reconstruction
python3 models/metadata_reconstruction.py \
  --metadata data/metadata.json \
  --logs data/system_logs.json \
  --output analysis_results/metadata_recon.json

#### User behavior & anomaly detection
python3 models/user_behavior_model.py \
  --logs data/system_logs.json \
  --output analysis_results/behavior_patterns.json


### 2. Workflow Engine
- Correlate artifacts and detect anomalies:
cd workflow_engine
node workflow_manager.js \
  --mem-file ../analysis_results/memory_artifacts.json \
  --meta-file ../analysis_results/metadata_recon.json \
  --behavior-file ../analysis_results/behavior_patterns.json \
  --out-file ../analysis_results/analysis_output.json
cd ..

### 3. Visualization Dashboard
- Open in browser or serve statically:

```bash
cd visualization
open dashboard.html
```
or run:
```bash
npx serve
```
It fetches analysis_results/analysis_output.json to render interactive charts.

### 4. Generating Final Report
```bash
open analysis_results/report.html
```
Presents a polished forensic summary using Chart.js and Bootstrap.

### 5. Full Orchestration via Bash
```bash
export DATA_DIR=./data
export OUT_DIR=./analysis_results
```

## 1) Models
python3 models/memory_analysis.py 
  --input $DATA_DIR/system_logs.json 
  --output $OUT_DIR/memory_artifacts.json

python3 models/metadata_reconstruction.py 
  --metadata $DATA_DIR/metadata.json 
  --logs $DATA_DIR/system_logs.json 
  --output $OUT_DIR/metadata_recon.json

python3 models/user_behavior_model.py 
  --logs $DATA_DIR/system_logs.json 
  --output $OUT_DIR/behavior_patterns.json

## 2) Workflow
cd workflow_engine
node workflow_manager.js \
  --mem-file ../$OUT_DIR/memory_artifacts.json \
  --meta-file ../$OUT_DIR/metadata_recon.json \
  --behavior-file ../$OUT_DIR/behavior_patterns.json \
  --out-file ../$OUT_DIR/analysis_output.json
cd ..

## 3) Reports & Dashboard
open $OUT_DIR/report.html
open visualization/dashboard.html
Example Bash Script
```bash
Create run_full_analysis.sh:
```
```bash
#!/usr/bin/env bash
set -euo pipefail
```
DATA_DIR="./data"
OUT_DIR="./analysis_results"

## Memory Analysis
python3 models/memory_analysis.py \
  --input "${DATA_DIR}/system_logs.json" \
  --output "${OUT_DIR}/memory_artifacts.json"

## Metadata Reconstruction
python3 models/metadata_reconstruction.py \
  --metadata "${DATA_DIR}/metadata.json" \
  --logs "${DATA_DIR}/system_logs.json" \
  --output "${OUT_DIR}/metadata_recon.json"

## Behavior Modeling
python3 models/user_behavior_model.py \
  --logs "${DATA_DIR}/system_logs.json" \
  --output "${OUT_DIR}/behavior_patterns.json"

## Workflow Orchestration
cd workflow_engine
node workflow_manager.js \
  --mem-file "../${OUT_DIR}/memory_artifacts.json" \
  --meta-file "../${OUT_DIR}/metadata_recon.json" \
  --behavior-file "../${OUT_DIR}/behavior_patterns.json" \
  --out-file "../${OUT_DIR}/analysis_output.json"
cd ..

## Open Reports & Dashboard
  - echo "Analysis complete. Opening report and dashboard..."
  - open "${OUT_DIR}/report.html"
  - open "visualization/dashboard.html"
  - Make executable:

```bash
chmod +x run_full_analysis.sh
```

## Contributing
- Fork the repository
- Create a feature branch
- Commit your changes
- Submit a Pull Request

### Please follow the existing code style and include tests where applicable.

## License
This project is licensed under the MIT License. See LICENSE for details.
