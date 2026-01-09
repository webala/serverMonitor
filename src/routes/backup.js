const express = require('express');
const router = express.Router();
const backupService = require('../services/backupService');
const scheduler = require('../services/scheduler');
const logger = require('../utils/logger');

// Create backup for specific application
router.post('/create/:appName', async (req, res, next) => {
    try {
        const { appName } = req.params;
        logger.info(`Manual backup requested for ${appName}`);

        const result = await backupService.createBackup(appName);

        res.json({
            success: true,
            message: `Backup created successfully for ${appName}`,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

// Create backups for all applications
router.post('/create-all', async (req, res, next) => {
    try {
        logger.info('Manual backup requested for all applications');

        const results = await backupService.createAllBackups();

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        res.json({
            success: true,
            message: `Backup completed: ${successCount} succeeded, ${failCount} failed`,
            data: results,
        });
    } catch (error) {
        next(error);
    }
});

// List all backups
router.get('/list', async (req, res, next) => {
    try {
        const backups = await backupService.listBackups();

        res.json({
            success: true,
            data: backups,
        });
    } catch (error) {
        next(error);
    }
});

// List backups for specific application
router.get('/list/:appName', async (req, res, next) => {
    try {
        const { appName } = req.params;
        const backups = await backupService.listBackups(appName);

        res.json({
            success: true,
            data: backups,
        });
    } catch (error) {
        next(error);
    }
});

// Get backup status for all applications
router.get('/status', async (req, res, next) => {
    try {
        const config = require('../config/config');
        const backups = await backupService.listBackups();

        const status = config.applications.map((app) => {
            const appBackups = backups.filter((b) => b.application === app.name);
            const latestBackup = appBackups.length > 0 ? appBackups[0] : null;

            return {
                application: app.name,
                hasDatabase: !!app.database,
                backupSchedule: app.database?.backupSchedule,
                totalBackups: appBackups.length,
                latestBackup: latestBackup
                    ? {
                        filename: latestBackup.filename,
                        size: latestBackup.size,
                        created: latestBackup.created,
                    }
                    : null,
            };
        });

        // Get scheduled jobs
        const jobs = scheduler.getJobs();

        res.json({
            success: true,
            data: {
                applications: status,
                scheduledJobs: jobs,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get backup status for specific application
router.get('/status/:appName', async (req, res, next) => {
    try {
        const { appName } = req.params;
        const backups = await backupService.listBackups(appName);
        const config = require('../config/config');

        const app = config.applications.find((a) => a.name === appName);
        if (!app) {
            return res.status(404).json({
                success: false,
                error: `Application ${appName} not found`,
            });
        }

        const latestBackup = backups.length > 0 ? backups[0] : null;

        res.json({
            success: true,
            data: {
                application: appName,
                hasDatabase: !!app.database,
                backupSchedule: app.database?.backupSchedule,
                retentionDays: app.database?.retentionDays,
                totalBackups: backups.length,
                latestBackup: latestBackup
                    ? {
                        filename: latestBackup.filename,
                        size: latestBackup.size,
                        created: latestBackup.created,
                    }
                    : null,
                allBackups: backups,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Restore from backup
router.post('/restore/:appName/:filename', async (req, res, next) => {
    try {
        const { appName, filename } = req.params;
        logger.info(`Restore requested for ${appName} from ${filename}`);

        const result = await backupService.restoreBackup(appName, filename);

        res.json({
            success: true,
            message: `Database restored successfully for ${appName}`,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

// Delete specific backup
router.delete('/:appName/:filename', async (req, res, next) => {
    try {
        const { appName, filename } = req.params;
        logger.info(`Delete backup requested: ${appName}/${filename}`);

        await backupService.deleteBackup(appName, filename);

        res.json({
            success: true,
            message: `Backup deleted successfully: ${filename}`,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
