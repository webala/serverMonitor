const logger = require('../utils/logger');

// Authentication middleware
const authenticate = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const config = require('../config/config');

    if (!apiKey || apiKey !== config.apiKey) {
        logger.warn(`Unauthorized access attempt from ${req.ip}`);
        return res.status(401).json({
            success: false,
            error: 'Unauthorized. Please provide a valid API key in X-API-Key header.',
        });
    }

    next();
};

module.exports = authenticate;
