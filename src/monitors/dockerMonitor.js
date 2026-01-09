const Docker = require('dockerode');
const logger = require('../utils/logger');
const config = require('../config/config');

class DockerMonitor {
    constructor() {
        this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
        this.cachedData = {
            containers: null,
            lastUpdate: null,
        };
    }

    // Get all running containers
    async getContainers() {
        try {
            const containers = await this.docker.listContainers({ all: true });

            const containerDetails = await Promise.all(
                containers.map(async (container) => {
                    try {
                        const containerObj = this.docker.getContainer(container.Id);
                        const stats = await containerObj.stats({ stream: false });
                        const inspect = await containerObj.inspect();

                        // Calculate CPU percentage
                        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage -
                            stats.precpu_stats.cpu_usage.total_usage;
                        const systemDelta = stats.cpu_stats.system_cpu_usage -
                            stats.precpu_stats.system_cpu_usage;
                        const cpuPercent = systemDelta > 0
                            ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100
                            : 0;

                        // Calculate memory usage
                        const memoryUsage = stats.memory_stats.usage || 0;
                        const memoryLimit = stats.memory_stats.limit || 0;
                        const memoryPercent = memoryLimit > 0
                            ? (memoryUsage / memoryLimit) * 100
                            : 0;

                        // Find which application this container belongs to
                        const application = this.findApplicationForContainer(container.Names[0]);

                        return {
                            id: container.Id.substring(0, 12),
                            name: container.Names[0].replace('/', ''),
                            image: container.Image,
                            state: container.State,
                            status: container.Status,
                            created: container.Created,
                            application: application || 'unknown',
                            stats: {
                                cpuPercent: cpuPercent.toFixed(2),
                                memoryUsage: memoryUsage,
                                memoryLimit: memoryLimit,
                                memoryPercent: memoryPercent.toFixed(2),
                                networkRx: stats.networks?.eth0?.rx_bytes || 0,
                                networkTx: stats.networks?.eth0?.tx_bytes || 0,
                            },
                            ports: container.Ports.map((p) => ({
                                private: p.PrivatePort,
                                public: p.PublicPort,
                                type: p.Type,
                            })),
                            mounts: inspect.Mounts.map((m) => ({
                                type: m.Type,
                                source: m.Source,
                                destination: m.Destination,
                            })),
                        };
                    } catch (error) {
                        logger.warn(`Error getting stats for container ${container.Names[0]}:`, error.message);
                        return {
                            id: container.Id.substring(0, 12),
                            name: container.Names[0].replace('/', ''),
                            image: container.Image,
                            state: container.State,
                            status: container.Status,
                            error: 'Could not fetch detailed stats',
                        };
                    }
                })
            );

            // Cache the data
            this.cachedData = {
                containers: containerDetails,
                lastUpdate: Date.now(),
            };

            return containerDetails;
        } catch (error) {
            logger.error('Error getting containers:', error);
            throw error;
        }
    }

    // Find which application a container belongs to
    findApplicationForContainer(containerName) {
        const cleanName = containerName.replace('/', '');

        for (const app of config.applications) {
            if (app.containers.some(c => cleanName.includes(c) || c.includes(cleanName))) {
                return app.name;
            }
            // Also check database container
            if (app.database && cleanName.includes(app.database.container)) {
                return app.name;
            }
        }

        return null;
    }

    // Get containers for a specific application
    async getContainersByApplication(appName) {
        try {
            const allContainers = await this.getContainers();
            return allContainers.filter((c) => c.application === appName);
        } catch (error) {
            logger.error(`Error getting containers for application ${appName}:`, error);
            throw error;
        }
    }

    // Get container by name
    async getContainerByName(name) {
        try {
            const containers = await this.getContainers();
            return containers.find((c) => c.name === name || c.name.includes(name));
        } catch (error) {
            logger.error(`Error getting container ${name}:`, error);
            throw error;
        }
    }

    // Check Docker daemon health
    async checkDockerHealth() {
        try {
            const info = await this.docker.info();
            return {
                healthy: true,
                containers: info.Containers,
                containersRunning: info.ContainersRunning,
                containersPaused: info.ContainersPaused,
                containersStopped: info.ContainersStopped,
                images: info.Images,
                serverVersion: info.ServerVersion,
                operatingSystem: info.OperatingSystem,
                architecture: info.Architecture,
            };
        } catch (error) {
            logger.error('Error checking Docker health:', error);
            return {
                healthy: false,
                error: error.message,
            };
        }
    }

    // Get cached data if available and fresh
    getCachedContainers(maxAge = 10000) {
        if (
            this.cachedData.lastUpdate &&
            Date.now() - this.cachedData.lastUpdate < maxAge
        ) {
            return this.cachedData.containers;
        }
        return null;
    }
}

module.exports = new DockerMonitor();
