const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

const config = require('./config/config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const authenticate = require('./middleware/auth');
const scheduler = require('./services/scheduler');

// Import routes
const monitoringRoutes = require('./routes/monitoring');
const backupRoutes = require('./routes/backup');

// Initialize Express app
const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(compression()); // Compress responses
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });
    next();
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Serve static files (dashboard)
app.use(express.static(path.join(__dirname, '../public')));

// API routes (with authentication)
app.use('/api', authenticate);
app.use('/api', monitoringRoutes);
app.use('/api/backup', backupRoutes);

// Root endpoint
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'Server Monitor API',
        version: '1.0.0',
        endpoints: {
            monitoring: {
                system: 'GET /api/system',
                memory: 'GET /api/memory',
                cpu: 'GET /api/cpu',
                disk: 'GET /api/disk',
                network: 'GET /api/network',
                applications: 'GET /api/applications',
                applicationDetails: 'GET /api/applications/:appName',
                dockerContainers: 'GET /api/docker/containers',
                dockerHealth: 'GET /api/docker/health',
            },
            backup: {
                createBackup: 'POST /api/backup/create/:appName',
                createAllBackups: 'POST /api/backup/create-all',
                listBackups: 'GET /api/backup/list',
                listAppBackups: 'GET /api/backup/list/:appName',
                backupStatus: 'GET /api/backup/status',
                appBackupStatus: 'GET /api/backup/status/:appName',
                restoreBackup: 'POST /api/backup/restore/:appName/:filename',
                deleteBackup: 'DELETE /api/backup/:appName/:filename',
            },
        },
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
    });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;

app.listen(PORT, () => {
    logger.info(`Server Monitor started on port ${PORT}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Monitoring ${config.applications.length} application(s)`);

    // Initialize scheduled tasks
    scheduler.init();

    logger.info('Server is ready to accept requests');
    console.log(`\n🚀 Server Monitor running at http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔧 API: http://localhost:${PORT}/api`);
    console.log(`🔑 API Key required in X-API-Key header\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    scheduler.stopAll();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    scheduler.stopAll();
    process.exit(0);
});

module.exports = app;
