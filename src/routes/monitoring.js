const express = require('express');
const router = express.Router();
const systemMonitor = require('../monitors/systemMonitor');
const networkMonitor = require('../monitors/networkMonitor');
const dockerMonitor = require('../monitors/dockerMonitor');
const config = require('../config/config');
const logger = require('../utils/logger');

// Get all system metrics
router.get('/system', async (req, res, next) => {
    try {
        const metrics = await systemMonitor.getAllMetrics();
        res.json({
            success: true,
            data: metrics,
        });
    } catch (error) {
        next(error);
    }
});

// Get memory usage
router.get('/memory', async (req, res, next) => {
    try {
        const memory = await systemMonitor.getMemoryUsage();
        res.json({
            success: true,
            data: memory,
        });
    } catch (error) {
        next(error);
    }
});

// Get CPU usage
router.get('/cpu', async (req, res, next) => {
    try {
        const cpu = await systemMonitor.getCpuUsage();
        res.json({
            success: true,
            data: cpu,
        });
    } catch (error) {
        next(error);
    }
});

// Get disk usage
router.get('/disk', async (req, res, next) => {
    try {
        const disk = await systemMonitor.getDiskUsage();
        res.json({
            success: true,
            data: disk,
        });
    } catch (error) {
        next(error);
    }
});

// Get network statistics
router.get('/network', async (req, res, next) => {
    try {
        const network = await networkMonitor.getNetworkStats();
        res.json({
            success: true,
            data: network,
        });
    } catch (error) {
        next(error);
    }
});

// Get total network traffic
router.get('/network/total', async (req, res, next) => {
    try {
        const traffic = await networkMonitor.getTotalTraffic();
        res.json({
            success: true,
            data: traffic,
        });
    } catch (error) {
        next(error);
    }
});

// Get all applications
router.get('/applications', async (req, res, next) => {
    try {
        const applications = config.applications.map((app) => ({
            name: app.name,
            description: app.description,
            containers: app.containers,
            hasDatabase: !!app.database,
            databaseType: app.database?.type,
        }));

        res.json({
            success: true,
            data: applications,
        });
    } catch (error) {
        next(error);
    }
});

// Get specific application metrics
router.get('/applications/:appName', async (req, res, next) => {
    try {
        const { appName } = req.params;

        const app = config.applications.find((a) => a.name === appName);
        if (!app) {
            return res.status(404).json({
                success: false,
                error: `Application ${appName} not found`,
            });
        }

        const containers = await dockerMonitor.getContainersByApplication(appName);

        // Calculate total resource usage for this application
        const totalCpu = containers.reduce((sum, c) => sum + parseFloat(c.stats?.cpuPercent || 0), 0);
        const totalMemory = containers.reduce((sum, c) => sum + parseInt(c.stats?.memoryUsage || 0), 0);

        res.json({
            success: true,
            data: {
                name: app.name,
                description: app.description,
                containers: containers,
                summary: {
                    totalContainers: containers.length,
                    runningContainers: containers.filter((c) => c.state === 'running').length,
                    totalCpuPercent: totalCpu.toFixed(2),
                    totalMemoryUsage: totalMemory,
                },
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get containers for specific application
router.get('/applications/:appName/containers', async (req, res, next) => {
    try {
        const { appName } = req.params;
        const containers = await dockerMonitor.getContainersByApplication(appName);

        res.json({
            success: true,
            data: containers,
        });
    } catch (error) {
        next(error);
    }
});

// Get all Docker containers
router.get('/docker/containers', async (req, res, next) => {
    try {
        const containers = await dockerMonitor.getContainers();
        res.json({
            success: true,
            data: containers,
        });
    } catch (error) {
        next(error);
    }
});

// Get Docker health
router.get('/docker/health', async (req, res, next) => {
    try {
        const health = await dockerMonitor.checkDockerHealth();
        res.json({
            success: true,
            data: health,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
