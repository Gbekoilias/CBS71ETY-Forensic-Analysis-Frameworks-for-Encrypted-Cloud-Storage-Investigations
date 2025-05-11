const express = require('express');
// Reuse the existing app instance instead of redeclaring
const port = 3000;

// Workflow states
let simulationRunning = false;

app.post('/start', (req, res) => {
simulationRunning = true;
// Initiate data simulation
simulateData();
res.send({ status: 'Simulation started' });
});

app.post('/stop', (req, res) => {
simulationRunning = false;
res.send({ status: 'Simulation stopped' });
});

// Function to simulate data
function simulateData() {
if (simulationRunning) {
// Call simulate_data.js functionalities
require('../data_simulation/simulate_data');
setTimeout(simulateData, 5000); // repeat every 5 seconds
}
}

app.listen(port, () => {
console.log(`Forensic simulation server listening at http://localhost:${port}`);
});
/**
 * app_controller.js
 * Main orchestrator script for managing workflow states and forensic processes
 * Part of the /app_management/ module
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const cluster = require('cluster');
const os = require('os');

// Import configuration
const config = require('./config.json');

// Initialize Express app
const PORT = config.systemConfig.serverPort || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Process states and tracking
const processStates = {
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPING: 'stopping',
  ERROR: 'error',
  COMPLETED: 'completed'
};

// Active processes registry
const activeProcesses = new Map();

// Workflow states registry
const workflowStates = new Map();

// Process logs
const processLogs = new Map();

/**
 * Process Manager Class
 * Handles the lifecycle of forensic processes
 */
class ProcessManager {
  constructor() {
    this.logger = require('../utils/logger')('process-manager');
    this.maxConcurrent = config.systemConfig.maxConcurrentProcesses || 5;
  }

  /**
   * Start a new forensic process
   * @param {string} processType - Type of forensic process
   * @param {object} parameters - Process parameters
   * @returns {string} Process ID
   */
  async startProcess(processType, parameters) {
    try {
      // Check if we're at capacity
      if (activeProcesses.size >= this.maxConcurrent) {
        throw new Error('Maximum concurrent processes reached');
      }

      // Generate unique process ID
      const processId = `${processType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize process state
      activeProcesses.set(processId, {
        type: processType,
        parameters,
        state: processStates.INITIALIZING,
        startTime: Date.now(),
        updateTime: Date.now(),
        progress: 0,
        pid: null
      });

      // Log creation
      this.logger.info(`Process ${processId} initialization started`, { processType, parameters });
      processLogs.set(processId, []);
      this._logProcess(processId, 'Process initialization started');

      // Process specific initialization based on type
      let childProcess;
      switch (processType) {
        case 'disk-imaging':
          childProcess = await this._startDiskImagingProcess(processId, parameters);
          break;
        case 'memory-dump':
          childProcess = await this._startMemoryDumpProcess(processId, parameters);
          break;
        case 'network-capture':
          childProcess = await this._startNetworkCaptureProcess(processId, parameters);
          break;
        case 'log-analysis':
          childProcess = await this._startLogAnalysisProcess(processId, parameters);
          break;
        case 'malware-scan':
          childProcess = await this._startMalwareScanProcess(processId, parameters);
          break;
        default:
          throw new Error(`Unknown process type: ${processType}`);
      }

      // Update process state with PID and change state to RUNNING
      const processInfo = activeProcesses.get(processId);
      processInfo.state = processStates.RUNNING;
      processInfo.pid = childProcess.pid;
      processInfo.updateTime = Date.now();
      activeProcesses.set(processId, processInfo);
      
      this._logProcess(processId, `Process started with PID ${childProcess.pid}`);
      
      // Setup process monitoring
      this._monitorProcess(processId, childProcess);
      
      return processId;
    } catch (error) {
      this.logger.error('Failed to start process', { error: error.message, processType, parameters });
      throw error;
    }
  }

  /**
   * Stop a running process
   * @param {string} processId - ID of process to stop
   * @returns {boolean} Success status
   */
  async stopProcess(processId) {
    try {
      const processInfo = activeProcesses.get(processId);
      if (!processInfo) {
        throw new Error(`Process ${processId} not found`);
      }

      // Update state to stopping
      processInfo.state = processStates.STOPPING;
      processInfo.updateTime = Date.now();
      activeProcesses.set(processId, processInfo);
      
      this._logProcess(processId, 'Process stopping initiated');
      
      // Terminate the process
      if (processInfo.pid) {
        try {
          process.kill(processInfo.pid);
          this._logProcess(processId, `Process ${processInfo.pid} terminated`);
        } catch (killError) {
          this._logProcess(processId, `Error terminating process: ${killError.message}`);
          this.logger.warn(`Failed to kill process ${processInfo.pid}`, { error: killError.message });
        }
      }

      // Run cleanup based on process type
      await this._cleanupProcess(processId, processInfo.type);
      
      // Update final state
      processInfo.state = processStates.COMPLETED;
      processInfo.updateTime = Date.now();
      processInfo.endTime = Date.now();
      processInfo.progress = 100;
      activeProcesses.set(processId, processInfo);
      
      this._logProcess(processId, 'Process cleanup completed');
      
      // Move to historical processes after a delay
      setTimeout(() => {
        activeProcesses.delete(processId);
      }, 3600000); // Keep in active map for 1 hour
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to stop process ${processId}`, { error: error.message });
      
      // Mark as error state
      if (activeProcesses.has(processId)) {
        const processInfo = activeProcesses.get(processId);
        processInfo.state = processStates.ERROR;
        processInfo.error = error.message;
        processInfo.updateTime = Date.now();
        activeProcesses.set(processId, processInfo);
        this._logProcess(processId, `Process error: ${error.message}`);
      }
      
      return false;
    }
  }

  /**
   * Pause a running process (if supported)
   * @param {string} processId - ID of process to pause
   * @returns {boolean} Success status
   */
  async pauseProcess(processId) {
    try {
      const processInfo = activeProcesses.get(processId);
      if (!processInfo) {
        throw new Error(`Process ${processId} not found`);
      }

      // Check if process is running
      if (processInfo.state !== processStates.RUNNING) {
        throw new Error(`Process ${processId} is not in running state`);
      }

      // Check if process type supports pausing
      const pausableProcesses = ['disk-imaging', 'network-capture', 'log-analysis'];
      if (!pausableProcesses.includes(processInfo.type)) {
        throw new Error(`Process type ${processInfo.type} does not support pausing`);
      }

      // Send SIGSTOP to pause the process
      if (processInfo.pid) {
        process.kill(processInfo.pid, 'SIGSTOP');
        
        // Update state
        processInfo.state = processStates.PAUSED;
        processInfo.updateTime = Date.now();
        activeProcesses.set(processId, processInfo);
        
        this._logProcess(processId, 'Process paused');
        return true;
      } else {
        throw new Error('Process has no PID assigned');
      }
    } catch (error) {
      this.logger.error(`Failed to pause process ${processId}`, { error: error.message });
      return false;
    }
  }

  /**
   * Resume a paused process
   * @param {string} processId - ID of process to resume
   * @returns {boolean} Success status
   */
  async resumeProcess(processId) {
    try {
      const processInfo = activeProcesses.get(processId);
      if (!processInfo) {
        throw new Error(`Process ${processId} not found`);
      }

      // Check if process is paused
      if (processInfo.state !== processStates.PAUSED) {
        throw new Error(`Process ${processId} is not in paused state`);
      }

      // Send SIGCONT to resume the process
      if (processInfo.pid) {
        process.kill(processInfo.pid, 'SIGCONT');
        
        // Update state
        processInfo.state = processStates.RUNNING;
        processInfo.updateTime = Date.now();
        activeProcesses.set(processId, processInfo);
        
        this._logProcess(processId, 'Process resumed');
        return true;
      } else {
        throw new Error('Process has no PID assigned');
      }
    } catch (error) {
      this.logger.error(`Failed to resume process ${processId}`, { error: error.message });
      return false;
    }
  }

  /**
   * Get process status
   * @param {string} processId - ID of process
   * @returns {object} Process status and details
   */
  getProcessStatus(processId) {
    const processInfo = activeProcesses.get(processId);
    if (!processInfo) {
      return { exists: false };
    }
    
    // Return a copy with logs
    return {
      exists: true,
      ...processInfo,
      runtime: processInfo.endTime ? 
        (processInfo.endTime - processInfo.startTime) : 
        (Date.now() - processInfo.startTime),
      logs: processLogs.get(processId) || []
    };
  }

  /**
   * Get all active processes
   * @returns {Array} List of active processes
   */
  getAllProcesses() {
    const processes = [];
    for (const [processId, processInfo] of activeProcesses.entries()) {
      processes.push({
        id: processId,
        type: processInfo.type,
        state: processInfo.state,
        startTime: processInfo.startTime,
        runtime: processInfo.endTime ? 
          (processInfo.endTime - processInfo.startTime) : 
          (Date.now() - processInfo.startTime),
        progress: processInfo.progress
      });
    }
    return processes;
  }

  /**
   * Update progress for a process
   * @param {string} processId - ID of process
   * @param {number} progress - Progress percentage (0-100)
   */
  updateProcessProgress(processId, progress) {
    const processInfo = activeProcesses.get(processId);
    if (processInfo) {
      processInfo.progress = Math.min(Math.max(progress, 0), 100);
      processInfo.updateTime = Date.now();
      activeProcesses.set(processId, processInfo);
      
      // Log significant progress milestones
      if (progress % 25 === 0) {
        this._logProcess(processId, `Progress: ${progress}%`);
      }
    }
  }

  /**
   * Process-specific startup methods
   */
  async _startDiskImagingProcess(processId, parameters) {
    this._logProcess(processId, 'Initializing disk imaging process');
    // In a real implementation, this would launch the actual disk imaging tool
    const childProcess = require('child_process').spawn(
      'node',
      [path.join(__dirname, '../forensics/simulators/disk_imaging_simulator.js')],
      {
        env: {
          ...process.env,
          PROCESS_ID: processId,
          SOURCE_DRIVE: parameters.sourceDrive,
          TARGET_PATH: parameters.targetPath,
          COMPRESSION: parameters.compression || 'none',
          VERIFICATION: parameters.verification || 'false'
        }
      }
    );
    
    return childProcess;
  }

  async _startMemoryDumpProcess(processId, parameters) {
    this._logProcess(processId, 'Initializing memory dump process');
    // Simulated memory dump process
    const childProcess = require('child_process').spawn(
      'node',
      [path.join(__dirname, '../forensics/simulators/memory_dump_simulator.js')],
      {
        env: {
          ...process.env,
          PROCESS_ID: processId,
          TARGET_SYSTEM: parameters.targetSystem,
          OUTPUT_PATH: parameters.outputPath,
          FORMAT: parameters.format || 'raw'
        }
      }
    );
    
    return childProcess;
  }

  async _startNetworkCaptureProcess(processId, parameters) {
    this._logProcess(processId, 'Initializing network capture process');
    // Simulated network capture process
    const childProcess = require('child_process').spawn(
      'node',
      [path.join(__dirname, '../forensics/simulators/network_capture_simulator.js')],
      {
        env: {
          ...process.env,
          PROCESS_ID: processId,
          INTERFACE: parameters.interface,
          DURATION: parameters.duration || '3600',
          FILTER: parameters.filter || '',
          OUTPUT_PATH: parameters.outputPath
        }
      }
    );
    
    return childProcess;
  }

  async _startLogAnalysisProcess(processId, parameters) {
    this._logProcess(processId, 'Initializing log analysis process');
    // Simulated log analysis process
    const childProcess = require('child_process').spawn(
      'node',
      [path.join(__dirname, '../forensics/simulators/log_analysis_simulator.js')],
      {
        env: {
          ...process.env,
          PROCESS_ID: processId,
          LOG_PATH: parameters.logPath,
          PATTERN: parameters.pattern || '',
          TIME_RANGE: parameters.timeRange || '',
          OUTPUT_FORMAT: parameters.outputFormat || 'json'
        }
      }
    );
    
    return childProcess;
  }

  async _startMalwareScanProcess(processId, parameters) {
    this._logProcess(processId, 'Initializing malware scan process');
    // Simulated malware scan process
    const childProcess = require('child_process').spawn(
      'node',
      [path.join(__dirname, '../forensics/simulators/malware_scan_simulator.js')],
      {
        env: {
          ...process.env,
          PROCESS_ID: processId,
          TARGET_PATH: parameters.targetPath,
          SCAN_DEPTH: parameters.scanDepth || 'normal',
          SIGNATURE_DB: parameters.signatureDb || 'default'
        }
      }
    );
    
    return childProcess;
  }

  /**
   * Monitor a running process
   * @param {string} processId - Process ID
   * @param {ChildProcess} childProcess - Node.js child process
   */
  _monitorProcess(processId, childProcess) {
    // Handle stdout
    childProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      this._logProcess(processId, output);
      
      // Check for progress updates in the output
      const progressMatch = output.match(/progress:\s*(\d+)/i);
      if (progressMatch && progressMatch[1]) {
        this.updateProcessProgress(processId, parseInt(progressMatch[1], 10));
      }
    });

    // Handle stderr
    childProcess.stderr.on('data', (data) => {
      const error = data.toString().trim();
      this._logProcess(processId, `ERROR: ${error}`);
    });

    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      const processInfo = activeProcesses.get(processId);
      if (processInfo) {
        if (code === 0) {
          processInfo.state = processStates.COMPLETED;
          processInfo.progress = 100;
          this._logProcess(processId, 'Process completed successfully');
        } else {
          processInfo.state = processStates.ERROR;
          processInfo.error = `Process exited with code ${code} (signal: ${signal})`;
          this._logProcess(processId, `Process failed: Exit code ${code}, Signal ${signal}`);
        }
        
        processInfo.updateTime = Date.now();
        processInfo.endTime = Date.now();
        activeProcesses.set(processId, processInfo);
      }
    });

    // Handle process error
    childProcess.on('error', (error) => {
      const processInfo = activeProcesses.get(processId);
      if (processInfo) {
        processInfo.state = processStates.ERROR;
        processInfo.error = error.message;
        processInfo.updateTime = Date.now();
        activeProcesses.set(processId, processInfo);
      }
      this._logProcess(processId, `Process error: ${error.message}`);
    });
  }

  /**
   * Clean up after a process
   * @param {string} processId - Process ID
   * @param {string} processType - Type of process
   */
  async _cleanupProcess(processId, processType) {
    this._logProcess(processId, 'Running process cleanup');
    
    // Process-specific cleanup tasks
    switch (processType) {
      case 'disk-imaging':
        // Cleanup temp files, verify checksums, etc.
        this._logProcess(processId, 'Verifying disk image integrity');
        this._logProcess(processId, 'Cleaning up temporary files');
        break;
        
      case 'network-capture':
        // Convert capture to final format, compress output, etc.
        this._logProcess(processId, 'Finalizing network capture file');
        this._logProcess(processId, 'Generating capture summary');
        break;
        
      case 'memory-dump':
        // Verify memory dump, clean up temp artifacts
        this._logProcess(processId, 'Verifying memory dump integrity');
        break;
        
      case 'log-analysis':
        // Finalize reports, clean up temp files
        this._logProcess(processId, 'Finalizing analysis reports');
        break;
        
      case 'malware-scan':
        // Generate final report, clean up quarantine area if needed
        this._logProcess(processId, 'Generating malware scan report');
        break;
    }
    
    this._logProcess(processId, 'Cleanup completed');
  }

  /**
   * Add a log entry for a process
   * @param {string} processId - Process ID
   * @param {string} message - Log message
   */
  _logProcess(processId, message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    
    // Add to in-memory logs
    if (!processLogs.has(processId)) {
      processLogs.set(processId, []);
    }
    const logs = processLogs.get(processId);
    logs.push(logEntry);
    
    // Cap log size to prevent memory issues
    if (logs.length > 1000) {
      logs.shift(); // Remove oldest entry
    }
    
    processLogs.set(processId, logs);
    
    // Log to system logger too
    this.logger.debug(`[Process ${processId}] ${message}`);
  }
}

/**
 * Workflow Manager Class
 * Manages high-level workflow states and transitions
 */
class WorkflowManager {
  constructor() {
    this.logger = require('../utils/logger')('workflow-manager');
  }

  /**
   * Create a new workflow
   * @param {string} workflowType - Type of workflow to create
   * @param {object} parameters - Workflow parameters
   * @returns {string} Workflow ID
   */
  createWorkflow(workflowType, parameters) {
    try {
      // Generate workflow ID
      const workflowId = `${workflowType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Define workflow steps based on type
      let workflowDefinition;
      switch (workflowType) {
        case 'incident-response':
          workflowDefinition = this._createIncidentResponseWorkflow(parameters);
          break;
        case 'evidence-collection':
          workflowDefinition = this._createEvidenceCollectionWorkflow(parameters);
          break;
        case 'malware-investigation':
          workflowDefinition = this._createMalwareInvestigationWorkflow(parameters);
          break;
        default:
          throw new Error(`Unknown workflow type: ${workflowType}`);
      }
      
      // Initialize workflow state
      const workflowState = {
        id: workflowId,
        type: workflowType,
        parameters,
        definition: workflowDefinition,
        currentStep: 0,
        state: 'created',
        processes: [],
        startTime: Date.now(),
        updateTime: Date.now(),
        logs: []
      };
      
      workflowStates.set(workflowId, workflowState);
      this._logWorkflow(workflowId, `Workflow created: ${workflowType}`);
      
      return workflowId;
    } catch (error) {
      this.logger.error('Failed to create workflow', { error: error.message, workflowType });
      throw error;
    }
  }

  /**
   * Start a workflow
   * @param {string} workflowId - Workflow ID
   * @returns {boolean} Success status
   */
  async startWorkflow(workflowId) {
    try {
      const workflow = workflowStates.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      if (workflow.state !== 'created') {
        throw new Error(`Workflow ${workflowId} is already started or completed`);
      }
      
      // Update workflow state
      workflow.state = 'running';
      workflow.updateTime = Date.now();
      workflowStates.set(workflowId, workflow);
      
      this._logWorkflow(workflowId, 'Workflow execution started');
      
      // Start the first step
      await this._executeWorkflowStep(workflowId);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to start workflow ${workflowId}`, { error: error.message });
      return false;
    }
  }

  /**
   * Stop a workflow
   * @param {string} workflowId - Workflow ID
   * @returns {boolean} Success status
   */
  async stopWorkflow(workflowId) {
    try {
      const workflow = workflowStates.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      if (workflow.state === 'completed' || workflow.state === 'failed') {
        throw new Error(`Workflow ${workflowId} is already stopped`);
      }
      
      // Update workflow state
      workflow.state = 'stopping';
      workflow.updateTime = Date.now();
      workflowStates.set(workflowId, workflow);
      
      this._logWorkflow(workflowId, 'Workflow stopping initiated');
      
      // Stop all running processes
      const processManager = new ProcessManager();
      for (const processId of workflow.processes) {
        try {
          await processManager.stopProcess(processId);
        } catch (stopError) {
          this._logWorkflow(workflowId, `Error stopping process ${processId}: ${stopError.message}`);
        }
      }
      
      // Update final state
      workflow.state = 'stopped';
      workflow.updateTime = Date.now();
      workflow.endTime = Date.now();
      workflowStates.set(workflowId, workflow);
      
      this._logWorkflow(workflowId, 'Workflow stopped');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to stop workflow ${workflowId}`, { error: error.message });
      return false;
    }
  }

  /**
   * Get workflow status
   * @param {string} workflowId - Workflow ID
   * @returns {object|null} Workflow status
   */
  getWorkflowStatus(workflowId) {
    const workflow = workflowStates.get(workflowId);
    if (!workflow) {
      return null;
    }
    
    // Calculate overall progress
    let progress = 0;
    if (workflow.definition && workflow.definition.steps.length > 0) {
      if (workflow.currentStep >= workflow.definition.steps.length) {
        progress = 100;
      } else {
        const stepsCompleted = workflow.currentStep / workflow.definition.steps.length;
        progress = Math.round(stepsCompleted * 100);
      }
    }
    
    return {
      id: workflow.id,
      type: workflow.type,
      state: workflow.state,
      currentStep: workflow.currentStep,
      totalSteps: workflow.definition ? workflow.definition.steps.length : 0,
      progress,
      startTime: workflow.startTime,
      runtime: workflow.endTime ? 
        (workflow.endTime - workflow.startTime) : 
        (Date.now() - workflow.startTime),
      processes: workflow.processes,
      logs: workflow.logs
    };
  }

  /**
   * Get all workflows
   * @returns {Array} List of workflows
   */
  getAllWorkflows() {
    const workflows = [];
    for (const [workflowId, workflow] of workflowStates.entries()) {
      workflows.push({
        id: workflowId,
        type: workflow.type,
        state: workflow.state,
        progress: this._calculateWorkflowProgress(workflow),
        startTime: workflow.startTime,
        processCount: workflow.processes.length
      });
    }
    return workflows;
  }

  /**
   * Execute current workflow step
   * @param {string} workflowId - Workflow ID
   * @private
   */
  async _executeWorkflowStep(workflowId) {
    const workflow = workflowStates.get(workflowId);
    if (!workflow || workflow.state !== 'running') {
      return;
    }
    
    const steps = workflow.definition.steps;
    if (workflow.currentStep >= steps.length) {
      // Workflow completed
      workflow.state = 'completed';
      workflow.updateTime = Date.now();
      workflow.endTime = Date.now();
      workflowStates.set(workflowId, workflow);
      
      this._logWorkflow(workflowId, 'Workflow completed successfully');
      return;
    }
    
    const currentStep = steps[workflow.currentStep];
    this._logWorkflow(workflowId, `Executing workflow step ${workflow.currentStep + 1}/${steps.length}: ${currentStep.name}`);
    
    try {
      // Execute step based on type
      switch (currentStep.type) {
        case 'process':
          await this._executeProcessStep(workflowId, currentStep);
          break;
        case 'decision':
          await this._executeDecisionStep(workflowId, currentStep);
          break;
        case 'delay':
          await this._executeDelayStep(workflowId, currentStep);
          break;
        case 'parallel':
          await this._executeParallelStep(workflowId, currentStep);
          break;
        default:
          throw new Error(`Unknown step type: ${currentStep.type}`);
      }
      
      // Move to next step
      workflow.currentStep += 1;
      workflow.updateTime = Date.now();
      workflowStates.set(workflowId, workflow);
      
      // Execute next step
      setImmediate(() => this._executeWorkflowStep(workflowId));
    } catch (error) {
      this._logWorkflow(workflowId, `Step execution failed: ${error.message}`);
      
      // Mark workflow as failed
      workflow.state = 'failed';
      workflow.error = error.message;
      workflow.updateTime = Date.now();
      workflow.endTime = Date.now();
      workflowStates.set(workflowId, workflow);
    }
  }

  /**
   * Execute a process step
   * @param {string} workflowId - Workflow ID
   * @param {object} step - Step definition
   * @private
   */
  async _executeProcessStep(workflowId, step) {
    const workflow = workflowStates.get(workflowId);
    
    this._logWorkflow(workflowId, `Starting process: ${step.processType}`);
    
    const processManager = new ProcessManager();
    const processId = await processManager.startProcess(step.processType, step.parameters);
    
    // Add process to workflow
    workflow.processes.push(processId);
    workflowStates.set(workflowId, workflow);
    
    this._logWorkflow(workflowId, `Process started with ID: ${processId}`);
    
    // Wait for process completion
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const processStatus = processManager.getProcessStatus(processId);
        
        if (!processStatus.exists) {
          clearInterval(checkInterval);
          reject(new Error(`Process ${processId} no longer exists`));
          return;
        }
        
        if (processStatus.state === processStates.COMPLETED) {
          clearInterval(checkInterval);
          this._logWorkflow(workflowId, `Process ${processId} completed successfully`);
          resolve();
        } else if (processStatus.state === processStates.ERROR) {
          clearInterval(checkInterval);
          reject(new Error(`Process ${processId} failed: ${processStatus.error || 'Unknown error'}`));
        }
        
        // Check if workflow is still running
        const currentWorkflow = workflowStates.get(workflowId);
        if (currentWorkflow.state !== 'running') {
          clearInterval(checkInterval);
          reject(new Error('Workflow execution was interrupted'));
        }
      }, 1000);
    });
  }

  /**
   * Execute a decision step
   * @param {string} workflowId - Workflow ID
   * @param {object} step - Step definition
   * @private
   */
  async _executeDecisionStep(workflowId, step) {
    const workflow = workflowStates.get(workflowId);
    
    this._logWorkflow(workflowId, `Evaluating decision: ${step.condition}`);
    
    // In a real system, this would evaluate the condition against workflow state
    // For this example, we'll choose the first branch
    
    const branch = step.branches[0];
    this._logWorkflow(workflowId, `Taking branch: ${branch.name}`);
    
    // Modify workflow steps
    if (branch.action === 'skip') {
      workflow.currentStep += branch.skipCount || 1;
      this._logWorkflow(workflowId, `Skipping ${branch.skipCount || 1} steps`);
    } else if (branch.action === 'execute') {
      // Execute the next step in the branch
      workflow.currentStep += 1;
    }
      workflowStates.set(workflowId, workflow);
      }
      /**
       * Execute a delay step
       * @param {string} workflowId - Workflow ID
       *    