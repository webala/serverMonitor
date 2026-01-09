const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config/config');
const dockerMonitor = require('../monitors/dockerMonitor');

const execAsync = promisify(exec);

class BackupService {
    constructor() {
        this.backupDir = config.backup.dir;
        this.ensureBackupDir();
    }

    // Ensure backup directory exists
    async ensureBackupDir() {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
            logger.info(`Backup directory ensured at ${this.backupDir}`);
        } catch (error) {
            logger.error('Error creating backup directory:', error);
        }
    }

    // Create backup for a specific application
    async createBackup(appName) {
        try {
            const app = config.applications.find((a) => a.name === appName);

            if (!app) {
                throw new Error(`Application ${appName} not found in configuration`);
            }

            if (!app.database) {
                throw new Error(`No database configured for application ${appName}`);
            }

            logger.info(`Starting backup for application: ${appName}`);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const appBackupDir = path.join(this.backupDir, appName);
            await fs.mkdir(appBackupDir, { recursive: true });

            let backupFile;
            let backupCommand;

            switch (app.database.type.toLowerCase()) {
                case 'postgresql':
                    backupFile = path.join(appBackupDir, `backup-${timestamp}.sql.gz`);
                    backupCommand = this.getPostgreSQLBackupCommand(app, backupFile);
                    break;

                case 'mysql':
                    backupFile = path.join(appBackupDir, `backup-${timestamp}.sql.gz`);
                    backupCommand = this.getMySQLBackupCommand(app, backupFile);
                    break;

                case 'mongodb':
                    backupFile = path.join(appBackupDir, `backup-${timestamp}.archive.gz`);
                    backupCommand = this.getMongoDBBackupCommand(app, backupFile);
                    break;

                default:
                    throw new Error(`Unsupported database type: ${app.database.type}`);
            }

            // Execute backup command
            logger.info(`Executing backup command for ${appName}`);
            const { stdout, stderr } = await execAsync(backupCommand);

            if (stderr && !stderr.includes('Warning')) {
                logger.warn(`Backup stderr for ${appName}:`, stderr);
            }

            // Verify backup file was created
            const stats = await fs.stat(backupFile);

            if (stats.size === 0) {
                throw new Error('Backup file is empty');
            }

            logger.info(`Backup completed for ${appName}: ${backupFile} (${stats.size} bytes)`);

            // Clean up old backups
            await this.cleanupOldBackups(appName, app.database.retentionDays || config.backup.defaultRetentionDays);

            return {
                success: true,
                application: appName,
                file: backupFile,
                size: stats.size,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            logger.error(`Error creating backup for ${appName}:`, error);
            throw error;
        }
    }

    // Get PostgreSQL backup command
    getPostgreSQLBackupCommand(app, backupFile) {
        const { container, database, username, password } = app.database;
        return `docker exec ${container} pg_dump -U ${username} ${database} | gzip > ${backupFile}`;
    }

    // Get MySQL backup command
    getMySQLBackupCommand(app, backupFile) {
        const { container, database, username, password } = app.database;
        return `docker exec ${container} mysqldump -u ${username} -p${password} ${database} | gzip > ${backupFile}`;
    }

    // Get MongoDB backup command
    getMongoDBBackupCommand(app, backupFile) {
        const { container, database } = app.database;
        return `docker exec ${container} mongodump --db ${database} --archive | gzip > ${backupFile}`;
    }

    // Create backups for all applications
    async createAllBackups() {
        const results = [];

        for (const app of config.applications) {
            if (app.database) {
                try {
                    const result = await this.createBackup(app.name);
                    results.push(result);
                } catch (error) {
                    results.push({
                        success: false,
                        application: app.name,
                        error: error.message,
                    });
                }
            }
        }

        return results;
    }

    // List all backups
    async listBackups(appName = null) {
        try {
            const backups = [];

            if (appName) {
                // List backups for specific application
                const appBackupDir = path.join(this.backupDir, appName);
                try {
                    const files = await fs.readdir(appBackupDir);
                    for (const file of files) {
                        const filePath = path.join(appBackupDir, file);
                        const stats = await fs.stat(filePath);
                        backups.push({
                            application: appName,
                            filename: file,
                            path: filePath,
                            size: stats.size,
                            created: stats.birthtime,
                        });
                    }
                } catch (error) {
                    // Directory doesn't exist or is empty
                    return [];
                }
            } else {
                // List backups for all applications
                const apps = await fs.readdir(this.backupDir);

                for (const app of apps) {
                    const appBackupDir = path.join(this.backupDir, app);
                    const stat = await fs.stat(appBackupDir);

                    if (stat.isDirectory()) {
                        const files = await fs.readdir(appBackupDir);
                        for (const file of files) {
                            const filePath = path.join(appBackupDir, file);
                            const stats = await fs.stat(filePath);
                            backups.push({
                                application: app,
                                filename: file,
                                path: filePath,
                                size: stats.size,
                                created: stats.birthtime,
                            });
                        }
                    }
                }
            }

            return backups.sort((a, b) => b.created - a.created);
        } catch (error) {
            logger.error('Error listing backups:', error);
            return [];
        }
    }

    // Clean up old backups based on retention policy
    async cleanupOldBackups(appName, retentionDays) {
        try {
            const backups = await this.listBackups(appName);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            let deletedCount = 0;

            for (const backup of backups) {
                if (backup.created < cutoffDate) {
                    await fs.unlink(backup.path);
                    logger.info(`Deleted old backup: ${backup.filename}`);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                logger.info(`Cleaned up ${deletedCount} old backup(s) for ${appName}`);
            }

            return deletedCount;
        } catch (error) {
            logger.error(`Error cleaning up old backups for ${appName}:`, error);
            throw error;
        }
    }

    // Delete a specific backup
    async deleteBackup(appName, filename) {
        try {
            const backupPath = path.join(this.backupDir, appName, filename);
            await fs.unlink(backupPath);
            logger.info(`Deleted backup: ${backupPath}`);
            return true;
        } catch (error) {
            logger.error(`Error deleting backup ${filename}:`, error);
            throw error;
        }
    }

    // Restore from backup
    async restoreBackup(appName, filename) {
        try {
            const app = config.applications.find((a) => a.name === appName);

            if (!app) {
                throw new Error(`Application ${appName} not found in configuration`);
            }

            const backupPath = path.join(this.backupDir, appName, filename);

            // Verify backup file exists
            await fs.access(backupPath);

            logger.info(`Starting restore for ${appName} from ${filename}`);

            let restoreCommand;

            switch (app.database.type.toLowerCase()) {
                case 'postgresql':
                    restoreCommand = `gunzip < ${backupPath} | docker exec -i ${app.database.container} psql -U ${app.database.username} ${app.database.database}`;
                    break;

                case 'mysql':
                    restoreCommand = `gunzip < ${backupPath} | docker exec -i ${app.database.container} mysql -u ${app.database.username} -p${app.database.password} ${app.database.database}`;
                    break;

                case 'mongodb':
                    restoreCommand = `gunzip < ${backupPath} | docker exec -i ${app.database.container} mongorestore --archive --db ${app.database.database}`;
                    break;

                default:
                    throw new Error(`Unsupported database type: ${app.database.type}`);
            }

            const { stdout, stderr } = await execAsync(restoreCommand);

            logger.info(`Restore completed for ${appName} from ${filename}`);

            return {
                success: true,
                application: appName,
                backup: filename,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            logger.error(`Error restoring backup for ${appName}:`, error);
            throw error;
        }
    }
}

module.exports = new BackupService();
