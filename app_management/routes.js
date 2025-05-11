/**
 * routes.js
 * REST API endpoints for simulation management and process control
 * Part of the /app_management/ module
 */

const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

// Import controllers
const ProcessManager = require('../controllers/process_manager');
const WorkflowManager = require('../controllers/workflow_manager');
const AuthController = require('../controllers/auth_controller');

// Import config
const config = require('./config.json');

// Initialize managers
const processManager = new ProcessManager();
const workflowManager = new WorkflowManager();

// Middleware for API authentication
const authenticateAPI = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    // Validate API key
    if (!apiKey || apiKey !== config.apiKeys.mainApiKey) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized: Invalid API key' 
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      error: 'Authentication error' 
    });
  }
};

// Middleware for role-based access control
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    try {
      const userRole = req.headers['x-user-role'] || 'guest';
      const roleConfig = config.userRoles[userRole];
      
      if (!roleConfig || !roleConfig.permissions.includes(requiredPermission)) {
        return res.status(403).json({ 
          success: false, 
          error: 'Forbidden: Insufficient permissions' 
        });
      }
      
      next();
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: 'Permission check error' 
      });
    }
  };
};

// Middleware for request rate limiting
const rateLimit = (req, res, next) => {
  const userRole = req.headers['x-user-role'] || 'guest';
  const roleConfig = config.userRoles[userRole];
  
  // Implement basic rate limiting
  // In a production environment, use a more robust solution like redis-based rate limiter
  const clientIp = req.ip;
  const requestsPerMinuteLimit = roleConfig?.rateLimits?.requestsPerMinute || 30;
  
  // Check rate limit (placeholder implementation)
  // This would be replaced with proper tracking in production
  if (Math.random() > 0.99) { // Simulated 1% chance of hitting rate limit for demo
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.'
    });
  }
  
  next();
};

// Middleware to log API requests
const logRequest = (req, res, next) => {
  const start = Date.now();
  
  // Log when the request completes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    console[logLevel]({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userRole: req.headers['x-user-role'] || 'guest',
      ip: req.ip
    });
  });
  
  next();
};

// Apply common middleware to all routes
router.use(logRequest);
router.use(authenticateAPI);
router.use(rateLimit);

// Health check endpoint (no auth required)
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    version: config.systemConfig.version,
    timestamp: new Date().toISOString()
  });
});

// System status endpoint
router.get('/status', checkPermission('read'), (req, res) => {
  try {
    const activeProcesses = processManager.getAllProcesses();
    const activeWorkflows = workflowManager.getAllWorkflows();
    
    // Get system resource usage
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.status(200).json({
      success: true,
      status: {
        uptime: process.uptime(),
        processCount: activeProcesses.length,
        workflowCount: activeWorkflows.length,
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB'
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get system status'
    });
  }
});

/**
 * Process Management Routes
 */

// List all processes
router.get('/processes', checkPermission('read'), (req, res) => {
  try {
    const processes = processManager.getAllProcesses();
    res.status(200).json({
      success: true,
      count: processes.length,
      processes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve processes'
    });
  }
});

// Get process details
router.get('/processes/:id', checkPermission('read'), (req, res) => {
  try {
    const processId = req.params.id;
    const processInfo = processManager.getProcessStatus(processId);
    
    if (!processInfo.exists) {
      return res.status(404).json({
        success: false,
        error: `Process ${processId} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      process: processInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve process details'
    });
  }
});

// Start a new process
router.post('/processes', [
  checkPermission('write'),
  check('processType').notEmpty().withMessage('Process type is required'),
  check('parameters').isObject().withMessage('Process parameters must be an object')
], async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  
  try {
    const { processType, parameters } = req.body;
    
    // Add audit info
    const auditInfo = {
      userId: req.headers['x-user-id'] || 'anonymous',
      userRole: req.headers['x-user-role'] || 'guest',
      timestamp: new Date().toISOString()
    };
    
    const processId = await processManager.startProcess(processType, parameters, auditInfo);
    
    res.status(201).json({
      success: true,
      message: 'Process started successfully',
      processId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start process'
    });
  }
});

// Stop a process
router.post('/processes/:id/stop', checkPermission('write'), async (req, res) => {
  try {
    const processId = req.params.id;
    const success = await processManager.stopProcess(processId);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: `Failed to stop process ${processId}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Process ${processId} stopped successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to stop process'
    });
  }
});

// Pause a process
router.post('/processes/:id/pause', checkPermission('write'), async (req, res) => {
  try {
    const processId = req.params.id;
    const success = await processManager.pauseProcess(processId);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: `Failed to pause process ${processId}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Process ${processId} paused successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to pause process'
    });
  }
});

// Resume a process
router.post('/processes/:id/resume', checkPermission('write'), async (req, res) => {
  try {
    const processId = req.params.id;
    const success = await processManager.resumeProcess(processId);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: `Failed to resume process ${processId}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Process ${processId} resumed successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resume process'
    });
  }
});

// Get process logs
router.get('/processes/:id/logs', checkPermission('read'), (req, res) => {
  try {
    const processId = req.params.id;
    const processInfo = processManager.getProcessStatus(processId);
    
    if (!processInfo.exists) {
      return res.status(404).json({
        success: false,
        error: `Process ${processId} not found`
      });
    }
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    // Get logs with pagination
    const logs = processInfo.logs.slice(startIndex, endIndex);
    
    res.status(200).json({
      success: true,
      process: {
        id: processId,
        type: processInfo.type,
        state: processInfo.state
      },
      pagination: {
        page,
        limit,
        totalLogs: processInfo.logs.length,
        totalPages: Math.ceil(processInfo.logs.length / limit)
      },
      logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve process logs'
    });
  }
});

/**
 * Workflow Management Routes
 */

// List all workflows
router.get('/workflows', checkPermission('read'), (req, res) => {
  try {
    const workflows = workflowManager.getAllWorkflows();
    res.status(200).json({
      success: true,
      count: workflows.length,
      workflows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve workflows'
    });
  }
});

// Get workflow details
router.get('/workflows/:id', checkPermission('read'), (req, res) => {
  try {
    const workflowId = req.params.id;
    const workflowInfo = workflowManager.getWorkflowStatus(workflowId);
    
    if (!workflowInfo) {
      return res.status(404).json({
        success: false,
        error: `Workflow ${workflowId} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      workflow: workflowInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve workflow details'
    });
  }
});

// Create a new workflow
router.post('/workflows', [
  checkPermission('write'),
  check('workflowType').notEmpty().withMessage('Workflow type is required'),
  check('parameters').isObject().withMessage('Workflow parameters must be an object')
], (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  
  try {
    const { workflowType, parameters } = req.body;
    const workflowId = workflowManager.createWorkflow(workflowType, parameters);
    
    res.status(201).json({
      success: true,
      message: 'Workflow created successfully',
      workflowId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create workflow'
    });
  }
});

// Start a workflow
router.post('/workflows/:id/start', checkPermission('write'), async (req, res) => {
  try {
    const workflowId = req.params.id;
    const success = await workflowManager.startWorkflow(workflowId);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: `Failed to start workflow ${workflowId}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Workflow ${workflowId} started successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start workflow'
    });
  }
});

// Stop a workflow
router.post('/workflows/:id/stop', checkPermission('write'), async (req, res) => {
  try {
    const workflowId = req.params.id;
    const success = await workflowManager.stopWorkflow(workflowId);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: `Failed to stop workflow ${workflowId}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Workflow ${workflowId} stopped successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to stop workflow'
    });
  }
});

/**
 * Simulation Parameter Management Routes
 */

// Get simulation parameters
router.get('/simulation/parameters', checkPermission('read'), (req, res) => {
  try {
    // Read parameters from file or database
    const parametersPath = path.join(__dirname, '../data/simulation_parameters.json');
    
    if (!fs.existsSync(parametersPath)) {
      // Return default parameters if file doesn't exist
      return res.status(200).json({
        success: true,
        parameters: {
          simulationSpeed: 1.0,
          errorRate: 0.01,
          networkLatency: 100,
          randomSeed: 12345,
          simulateFailures: false
        }
      });
    }
    
    const parameters = JSON.parse(fs.readFileSync(parametersPath, 'utf8'));
    
    res.status(200).json({
      success: true,
      parameters
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve simulation parameters'
    });
  }
});

// Update simulation parameters
router.put('/simulation/parameters', [
  checkPermission('write'),
  check('parameters').isObject().withMessage('Parameters must be an object')
], (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  
  try {
    const { parameters } = req.body;
    const parametersPath = path.join(__dirname, '../data/simulation_parameters.json');
    
    // Validate parameters
    if (parameters.simulationSpeed !== undefined && (parameters.simulationSpeed < 0.1 || parameters.simulationSpeed > 10)) {
      return res.status(400).json({
        success: false,
        error: 'Simulation speed must be between 0.1 and 10'
      });
    }
    
    if (parameters.errorRate !== undefined && (parameters.errorRate < 0 || parameters.errorRate > 1)) {
      return res.status(400).json({
        success: false,
        error: 'Error rate must be between 0 and 1'
      });
    }
    
    if (parameters.networkLatency !== undefined && (parameters.networkLatency < 0 || parameters.networkLatency > 5000)) {
      return res.status(400).json({
        success: false,
        error: 'Network latency must be between 0 and 5000 ms'
      });
    }
    
    // Create directory if it doesn't exist
    const dir = path.dirname(parametersPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Read existing parameters or create default
    let existingParameters = {};
    if (fs.existsSync(parametersPath)) {
      existingParameters = JSON.parse(fs.readFileSync(parametersPath, 'utf8'));
    }
    
    // Merge parameters
    const updatedParameters = { ...existingParameters, ...parameters };
    
    // Write parameters to file
    fs.writeFileSync(parametersPath, JSON.stringify(updatedParameters, null, 2));
    
    // Broadcast parameter change to running simulations
    // Implementation would depend on the specific architecture
    
    res.status(200).json({
      success: true,
      message: 'Simulation parameters updated successfully',
      parameters: updatedParameters
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update simulation parameters'
    });
  }
});

// Reset simulation parameters to default
router.post('/simulation/parameters/reset', checkPermission('write'), (req, res) => {
  try {
    const defaultParameters = {
      simulationSpeed: 1.0,
      errorRate: 0.01,
      networkLatency: 100,
      randomSeed: Math.floor(Math.random() * 100000),
      simulateFailures: false
    };
    
    const parametersPath = path.join(__dirname, '../data/simulation_parameters.json');
    
    // Create directory if it doesn't exist
    const dir = path.dirname(parametersPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write default parameters to file
    fs.writeFileSync(parametersPath, JSON.stringify(defaultParameters, null, 2));
    
    // Broadcast parameter change to running simulations
    // Implementation would depend on the specific architecture
    
    res.status(200).json({
      success: true,
      message: 'Simulation parameters reset to default values',
      parameters: defaultParameters
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset simulation parameters'
    });
  }
});

/**
 * System Control Routes
 */

// Start all simulations
router.post('/simulation/start', checkPermission('manage_system'), async (req, res) => {
  try {
    // This would start all predefined/scheduled simulations
    // Implementation depends on specific system architecture
    
    res.status(200).json({
      success: true,
      message: 'All simulations started successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start simulations'
    });
  }
});

// Stop all simulations
router.post('/simulation/stop', checkPermission('manage_system'), async (req, res) => {
  try {
    // Stop all running processes and workflows
    const processes = processManager.getAllProcesses();
    const workflows = workflowManager.getAllWorkflows();
    
    // Stop workflows first
    for (const workflow of workflows) {
      if (['running', 'paused'].includes(workflow.state)) {
        await workflowManager.stopWorkflow(workflow.id);
      }
    }
    
    // Then stop individual processes
    for (const process of processes) {
      await processManager.stopProcess(process.id);
    }
    
    res.status(200).json({
      success: true,
      message: 'All simulations stopped successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to stop simulations'
    });
  }
});

// Reset system state
router.post('/simulation/reset', checkPermission('manage_system'), async (req, res) => {
  try {
    // Stop all processes and workflows
    const processes = processManager.getAllProcesses();
    const workflows = workflowManager.getAllWorkflows();
    
    // Stop workflows
    for (const workflow of workflows) {
      if (['running', 'paused'].includes(workflow.state)) {
        await workflowManager.stopWorkflow(workflow.id);
      }
    }
    
    // Stop processes
    for (const process of processes) {
      await processManager.stopProcess(process.id);
    }
    
    // Reset simulation parameters
    const defaultParameters = {
      simulationSpeed: 1.0,
      errorRate: 0.01,
      networkLatency: 100,
      randomSeed: Math.floor(Math.random() * 100000),
      simulateFailures: false
    };
    
    const parametersPath = path.join(__dirname, '../data/simulation_parameters.json');
    fs.writeFileSync(parametersPath, JSON.stringify(defaultParameters, null, 2));
    
    // Clear any temporary files or data
    // Implementation depends on specific system architecture
    
    res.status(200).json({
      success: true,
      message: 'System state reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset system state'
    });
  }
});

/**
 * Log Management Routes
 */

// Get system logs
router.get('/logs', checkPermission('read'), (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    
    // Filter parameters
    const level = req.query.level; // e.g., 'error', 'warn', 'info'
    const module = req.query.module; // e.g., 'process', 'workflow', 'auth'
    const startDate = req.query.startDate; // ISO date string
    const endDate = req.query.endDate; // ISO date string
    
    // Read logs from file or database
    // This is a simplified implementation
    const logsPath = path.join(__dirname, '../logs/system.log');
    
    let logs = [];
    if (fs.existsSync(logsPath)) {
      // In a real system, you would use a proper log parser or database query
      const logContent = fs.readFileSync(logsPath, 'utf8');
      logs = logContent.split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return { raw: line, timestamp: new Date().toISOString(), level: 'unknown' };
          }
        });
      
      // Apply filters
      if (level) {
        logs = logs.filter(log => log.level === level);
      }
      
      if (module) {
        logs = logs.filter(log => log.module === module);
      }
      
      if (startDate) {
        const startTimestamp = new Date(startDate).getTime();
        logs = logs.filter(log => {
          const logDate = new Date(log.timestamp).getTime();
          return logDate >= startTimestamp;
        });
      }
      
      if (endDate) {
        const endTimestamp = new Date(endDate).getTime();
        logs = logs.filter(log => {
          const logDate = new Date(log.timestamp).getTime();
          return logDate <= endTimestamp;
        });
      }
    }
    
    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedLogs = logs.slice(startIndex, endIndex);
    
    res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        totalLogs: logs.length,
        totalPages: Math.ceil(logs.length / limit)
      },
      logs: paginatedLogs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve system logs'
    });
  }
});

// Clear system logs
router.post('/logs/clear', checkPermission('manage_system'), (req, res) => {
  try {
    // Clear logs from file or database
    const logsPath = path.join(__dirname, '../logs/system.log');
    
    if (fs.existsSync(logsPath)) {
      fs.writeFileSync(logsPath, '');
    }
    
    res.status(200).json({
      success: true,
      message: 'System logs cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear system logs'
    });
  }
});

/**
 * User Management Routes
 */

// Get current user info
router.get('/user', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const userRole = req.headers['x-user-role'] || 'guest';
    
    // In a real application, you'd fetch user info from a database
    // This is a simplified implementation
    
    const roleConfig = config.userRoles[userRole] || {};
    
    res.status(200).json({
      success: true,
      user: {
        id: userId,
        role: userRole,
        permissions: roleConfig.permissions || [],
        rateLimits: roleConfig.rateLimits || { requestsPerMinute: 30 }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user info'
    });
  }
});

module.exports = router;