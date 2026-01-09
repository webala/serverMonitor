const si = require('systeminformation');
const logger = require('../utils/logger');

class SystemMonitor {
    constructor() {
        this.cachedData = {
            memory: null,
            cpu: null,
            disk: null,
            system: null,
            lastUpdate: null,
        };
    }

    // Get memory usage information
    async getMemoryUsage() {
        try {
            const mem = await si.mem();
            return {
                total: mem.total,
                free: mem.free,
                used: mem.used,
                active: mem.active,
                available: mem.available,
                usedPercentage: ((mem.used / mem.total) * 100).toFixed(2),
                freePercentage: ((mem.free / mem.total) * 100).toFixed(2),
                swapTotal: mem.swaptotal,
                swapUsed: mem.swapused,
                swapFree: mem.swapfree,
            };
        } catch (error) {
            logger.error('Error getting memory usage:', error);
            throw error;
        }
    }

    // Get CPU usage information
    async getCpuUsage() {
        try {
            const [currentLoad, cpuInfo] = await Promise.all([
                si.currentLoad(),
                si.cpu(),
            ]);

            return {
                manufacturer: cpuInfo.manufacturer,
                brand: cpuInfo.brand,
                cores: cpuInfo.cores,
                physicalCores: cpuInfo.physicalCores,
                speed: cpuInfo.speed,
                currentLoad: currentLoad.currentLoad.toFixed(2),
                currentLoadUser: currentLoad.currentLoadUser.toFixed(2),
                currentLoadSystem: currentLoad.currentLoadSystem.toFixed(2),
                currentLoadIdle: currentLoad.currentLoadIdle.toFixed(2),
                coresLoad: currentLoad.cpus.map((cpu) => ({
                    load: cpu.load.toFixed(2),
                    loadUser: cpu.loadUser.toFixed(2),
                    loadSystem: cpu.loadSystem.toFixed(2),
                })),
            };
        } catch (error) {
            logger.error('Error getting CPU usage:', error);
            throw error;
        }
    }

    // Get disk usage information
    async getDiskUsage() {
        try {
            const fsSize = await si.fsSize();
            return fsSize.map((disk) => ({
                filesystem: disk.fs,
                type: disk.type,
                size: disk.size,
                used: disk.used,
                available: disk.available,
                usedPercentage: disk.use.toFixed(2),
                mount: disk.mount,
            }));
        } catch (error) {
            logger.error('Error getting disk usage:', error);
            throw error;
        }
    }

    // Get system information
    async getSystemInfo() {
        try {
            const [osInfo, time, versions] = await Promise.all([
                si.osInfo(),
                si.time(),
                si.versions(),
            ]);

            return {
                platform: osInfo.platform,
                distro: osInfo.distro,
                release: osInfo.release,
                kernel: osInfo.kernel,
                arch: osInfo.arch,
                hostname: osInfo.hostname,
                uptime: time.uptime,
                timezone: time.timezone,
                nodeVersion: versions.node,
                npmVersion: versions.npm,
            };
        } catch (error) {
            logger.error('Error getting system info:', error);
            throw error;
        }
    }

    // Get all system metrics at once
    async getAllMetrics() {
        try {
            const [memory, cpu, disk, system] = await Promise.all([
                this.getMemoryUsage(),
                this.getCpuUsage(),
                this.getDiskUsage(),
                this.getSystemInfo(),
            ]);

            const metrics = {
                timestamp: new Date().toISOString(),
                memory,
                cpu,
                disk,
                system,
            };

            // Cache the data
            this.cachedData = {
                ...metrics,
                lastUpdate: Date.now(),
            };

            return metrics;
        } catch (error) {
            logger.error('Error getting all metrics:', error);
            throw error;
        }
    }

    // Get cached data if available and fresh
    getCachedMetrics(maxAge = 5000) {
        if (
            this.cachedData.lastUpdate &&
            Date.now() - this.cachedData.lastUpdate < maxAge
        ) {
            return this.cachedData;
        }
        return null;
    }
}

module.exports = new SystemMonitor();
