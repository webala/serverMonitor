FROM node:18-alpine

# Install required system dependencies
RUN apk add --no-cache \
    postgresql-client \
    mysql-client \
    mongodb-tools \
    util-linux

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/logs /app/backups

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/index.js"]
