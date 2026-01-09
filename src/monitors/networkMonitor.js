const si = require('systeminformation');
const logger = require('../utils/logger');

class NetworkMonitor {
    constructor() {
        this.previousStats = {};
        this.cachedData = {
            stats: null,
            lastUpdate: null,
        };
    }

    // Get network interface statistics
    async getNetworkStats() {
        try {
            const [networkStats, networkInterfaces, connections] = await Promise.all([
                si.networkStats(),
                si.networkInterfaces(),
                si.networkConnections(),
            ]);

            const stats = networkStats.map((iface) => {
                const ifaceInfo = networkInterfaces.find((i) => i.iface === iface.iface);

                // Calculate speed if we have previous stats
                let rxSpeed = 0;
                let txSpeed = 0;

                if (this.previousStats[iface.iface]) {
                    const timeDiff = (Date.now() - this.previousStats[iface.iface].timestamp) / 1000;
                    rxSpeed = (iface.rx_bytes - this.previousStats[iface.iface].rx_bytes) / timeDiff;
                    txSpeed = (iface.tx_bytes - this.previousStats[iface.iface].tx_bytes) / timeDiff;
                }

                // Store current stats for next calculation
                this.previousStats[iface.iface] = {
                    rx_bytes: iface.rx_bytes,
                    tx_bytes: iface.tx_bytes,
                    timestamp: Date.now(),
                };

                return {
                    interface: iface.iface,
                    operstate: iface.operstate,
                    rxBytes: iface.rx_bytes,
                    txBytes: iface.tx_bytes,
                    rxSec: iface.rx_sec,
                    txSec: iface.tx_sec,
                    rxSpeed: Math.round(rxSpeed),
                    txSpeed: Math.round(txSpeed),
                    rxErrors: iface.rx_errors,
                    txErrors: iface.tx_errors,
                    rxDropped: iface.rx_dropped,
                    txDropped: iface.tx_dropped,
                    ip4: ifaceInfo?.ip4 || 'N/A',
                    ip6: ifaceInfo?.ip6 || 'N/A',
                    mac: ifaceInfo?.mac || 'N/A',
                };
            });

            // Count active connections
            const activeConnections = {
                total: connections.length,
                established: connections.filter((c) => c.state === 'ESTABLISHED').length,
                listening: connections.filter((c) => c.state === 'LISTEN').length,
                timeWait: connections.filter((c) => c.state === 'TIME_WAIT').length,
            };

            const result = {
                timestamp: new Date().toISOString(),
                interfaces: stats,
                connections: activeConnections,
            };

            // Cache the data
            this.cachedData = {
                stats: result,
                lastUpdate: Date.now(),
            };

            return result;
        } catch (error) {
            logger.error('Error getting network stats:', error);
            throw error;
        }
    }

    // Get total network traffic across all interfaces
    async getTotalTraffic() {
        try {
            const stats = await this.getNetworkStats();

            const total = stats.interfaces.reduce(
                (acc, iface) => {
                    acc.rxBytes += iface.rxBytes;
                    acc.txBytes += iface.txBytes;
                    acc.rxSpeed += iface.rxSpeed;
                    acc.txSpeed += iface.txSpeed;
                    return acc;
                },
                { rxBytes: 0, txBytes: 0, rxSpeed: 0, txSpeed: 0 }
            );

            return {
                timestamp: stats.timestamp,
                totalRxBytes: total.rxBytes,
                totalTxBytes: total.txBytes,
                totalRxSpeed: total.rxSpeed,
                totalTxSpeed: total.txSpeed,
                connections: stats.connections,
            };
        } catch (error) {
            logger.error('Error getting total traffic:', error);
            throw error;
        }
    }

    // Get cached data if available and fresh
    getCachedStats(maxAge = 5000) {
        if (
            this.cachedData.lastUpdate &&
            Date.now() - this.cachedData.lastUpdate < maxAge
        ) {
            return this.cachedData.stats;
        }
        return null;
    }
}

module.exports = new NetworkMonitor();
