const cron = require('node-cron');
const logger = require('../utils/logger');
const config = require('../config/config');
const backupService = require('./backupService');

class Scheduler {
    constructor() {
        this.jobs = [];
    }

    // Initialize all scheduled tasks
    init() {
        logger.info('Initializing scheduled tasks...');

        // Schedule backups for each application
        config.applications.forEach((app) => {
            if (app.database && app.database.backupSchedule) {
                this.scheduleBackup(app);
            }
        });

        logger.info(`Initialized ${this.jobs.length} scheduled task(s)`);
    }

    // Schedule backup for an application
    scheduleBackup(app) {
        const schedule = app.database.backupSchedule || config.backup.defaultSchedule;

        // Validate cron expression
        if (!cron.validate(schedule)) {
            logger.error(`Invalid cron schedule for ${app.name}: ${schedule}`);
            return;
        }

        const job = cron.schedule(schedule, async () => {
            logger.info(`Running scheduled backup for ${app.name}`);
            try {
                const result = await backupService.createBackup(app.name);
                logger.info(`Scheduled backup completed for ${app.name}:`, result);
            } catch (error) {
                logger.error(`Scheduled backup failed for ${app.name}:`, error);
            }
        });

        this.jobs.push({
            application: app.name,
            type: 'backup',
            schedule: schedule,
            job: job,
        });

        logger.info(`Scheduled backup for ${app.name} with cron: ${schedule}`);
    }

    // Stop all scheduled tasks
    stopAll() {
        logger.info('Stopping all scheduled tasks...');
        this.jobs.forEach((job) => {
            job.job.stop();
        });
        this.jobs = [];
    }

    // Get list of all scheduled jobs
    getJobs() {
        return this.jobs.map((job) => ({
            application: job.application,
            type: job.type,
            schedule: job.schedule,
        }));
    }
}

module.exports = new Scheduler();
