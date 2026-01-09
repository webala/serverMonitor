require('dotenv').config();
const fs = require('fs');
const path = require('path');

const config = {
  // Server Configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: process.env.API_KEY || 'default-insecure-key',

  // Monitoring Intervals (milliseconds)
  intervals: {
    system: parseInt(process.env.SYSTEM_MONITOR_INTERVAL) || 5000,
    network: parseInt(process.env.NETWORK_MONITOR_INTERVAL) || 5000,
    docker: parseInt(process.env.DOCKER_MONITOR_INTERVAL) || 10000,
  },

  // Backup Configuration
  backup: {
    dir: process.env.BACKUP_DIR || './backups',
    defaultSchedule: process.env.DEFAULT_BACKUP_SCHEDULE || '0 2 * * *',
    defaultRetentionDays: parseInt(process.env.DEFAULT_RETENTION_DAYS) || 7,
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },

  // Load applications configuration
  applications: [],
};

// Load applications from config file
const loadApplications = () => {
  try {
    const configPath = path.join(__dirname, '../../config/applications.json');
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      const appConfig = JSON.parse(data);
      config.applications = appConfig.applications || [];
      console.log(`Loaded ${config.applications.length} application(s) from configuration`);
    } else {
      console.warn('No applications.json found. Please create config/applications.json');
    }
  } catch (error) {
    console.error('Error loading applications configuration:', error.message);
  }
};

// Initialize configuration
loadApplications();

module.exports = config;
