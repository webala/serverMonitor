# Server Monitor

A comprehensive Node.js microservice for monitoring server resources, Docker containers, and automating database backups for multiple applications on the same server.

## Features

- 🖥️ **System Monitoring**: Real-time CPU, memory, disk, and network usage
- 🐳 **Docker Integration**: Monitor all containers with per-application grouping
- 💾 **Automated Backups**: Scheduled database backups (PostgreSQL, MySQL, MongoDB)
- 📱 **Multi-Application Support**: Monitor multiple applications with separate configurations
- 🌐 **REST API**: Easy-to-consume endpoints for all metrics
- 📊 **Web Dashboard**: Beautiful real-time dashboard with auto-refresh
- 🔐 **API Authentication**: Secure endpoints with API key authentication
- 📝 **Logging**: Comprehensive logging with rotation

## Prerequisites

- Node.js 18+ or Docker
- Access to Docker socket (`/var/run/docker.sock`)
- Running Docker containers to monitor

## Quick Start

### Using Docker (Recommended)

1. **Clone and configure**:
```bash
cd /path/to/serverMonitor
cp .env.example .env
```

2. **Edit `.env` file**:
```bash
nano .env
# Set your API_KEY and other preferences
```

3. **Configure applications** in `config/applications.json`:
```json
{
  "applications": [
    {
      "name": "my-app",
      "description": "My Django/React Application",
      "containers": ["django-backend", "react-frontend", "nginx"],
      "database": {
        "type": "postgresql",
        "container": "postgres-main",
        "database": "myapp_db",
        "username": "postgres",
        "password": "your-password",
        "backupSchedule": "0 2 * * *",
        "retentionDays": 7
      }
    }
  ]
}
```

4. **Start the service**:
```bash
docker-compose up -d
```

5. **Access the dashboard**:
- Dashboard: http://your-server:3000
- API: http://your-server:3000/api

### Using Node.js Directly

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
nano .env
```

3. **Configure applications**:
```bash
nano config/applications.json
```

4. **Start the service**:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_KEY` | API authentication key | `your-secure-api-key-here` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `BACKUP_DIR` | Backup storage directory | `./backups` |
| `DEFAULT_BACKUP_SCHEDULE` | Default cron schedule | `0 2 * * *` (2 AM daily) |
| `DEFAULT_RETENTION_DAYS` | Default backup retention | `7` |
| `LOG_LEVEL` | Logging level | `info` |

### Application Configuration

Edit `config/applications.json` to define your applications:

```json
{
  "applications": [
    {
      "name": "app-name",
      "description": "Application description",
      "containers": ["container1", "container2"],
      "database": {
        "type": "postgresql|mysql|mongodb",
        "container": "db-container-name",
        "database": "database-name",
        "username": "db-username",
        "password": "db-password",
        "backupSchedule": "0 2 * * *",
        "retentionDays": 7
      }
    }
  ]
}
```

**Cron Schedule Examples**:
- `0 2 * * *` - Daily at 2:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 0,12 * * *` - Twice daily (midnight and noon)
- `0 2 * * 0` - Weekly on Sunday at 2:00 AM

## API Documentation

All API endpoints require the `X-API-Key` header with your configured API key.

### Monitoring Endpoints

#### System Metrics
```bash
# Get all system metrics
GET /api/system

# Get memory usage
GET /api/memory

# Get CPU usage
GET /api/cpu

# Get disk usage
GET /api/disk

# Get network statistics
GET /api/network
```

#### Application Monitoring
```bash
# List all applications
GET /api/applications

# Get specific application metrics
GET /api/applications/:appName

# Get containers for application
GET /api/applications/:appName/containers
```

#### Docker Monitoring
```bash
# Get all containers
GET /api/docker/containers

# Get Docker health
GET /api/docker/health
```

### Backup Endpoints

```bash
# Create backup for specific application
POST /api/backup/create/:appName

# Create backups for all applications
POST /api/backup/create-all

# List all backups
GET /api/backup/list

# List backups for specific application
GET /api/backup/list/:appName

# Get backup status
GET /api/backup/status
GET /api/backup/status/:appName

# Restore from backup
POST /api/backup/restore/:appName/:filename

# Delete backup
DELETE /api/backup/:appName/:filename
```

### Example API Calls

```bash
# Using curl
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/system

# Create manual backup
curl -X POST -H "X-API-Key: your-api-key" http://localhost:3000/api/backup/create/my-app

# List backups
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/backup/list
```

## Dashboard

Access the web dashboard at `http://your-server:3000`. You'll be prompted for the API key.

The dashboard displays:
- Real-time system metrics (CPU, memory, disk, network)
- Docker container status
- Per-application metrics and container details
- Backup status and history
- Auto-refreshes every 30 seconds

## Deployment on Ubuntu Server

1. **SSH into your Contabo server**:
```bash
ssh user@your-server-ip
```

2. **Clone the repository**:
```bash
cd /opt
git clone <your-repo-url> server-monitor
cd server-monitor
```

3. **Configure the service**:
```bash
cp .env.example .env
nano .env  # Set your API_KEY and preferences

nano config/applications.json  # Configure your applications
```

4. **Start with Docker Compose**:
```bash
docker-compose up -d
```

5. **Check logs**:
```bash
docker-compose logs -f
```

6. **Access the dashboard**:
```
http://your-server-ip:3000
```

### Optional: Setup Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name monitor.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Adding New Applications

To monitor a new application:

1. **Edit `config/applications.json`**:
```json
{
  "applications": [
    // ... existing apps ...
    {
      "name": "new-app",
      "description": "New Application",
      "containers": ["new-container-1", "new-container-2"],
      "database": {
        "type": "postgresql",
        "container": "new-db-container",
        "database": "new_db",
        "username": "postgres",
        "password": "password",
        "backupSchedule": "0 3 * * *",
        "retentionDays": 14
      }
    }
  ]
}
```

2. **Restart the service**:
```bash
docker-compose restart
```

The new application will be automatically monitored and backed up according to its schedule.

## Backup Management

### Backup Location
Backups are stored in `./backups/{application-name}/` by default.

### Manual Backup
```bash
curl -X POST -H "X-API-Key: your-key" http://localhost:3000/api/backup/create/app-name
```

### Restore Backup
```bash
curl -X POST -H "X-API-Key: your-key" \
  http://localhost:3000/api/backup/restore/app-name/backup-filename.sql.gz
```

### Backup Retention
Old backups are automatically deleted based on the `retentionDays` setting for each application.

## Troubleshooting

### Cannot connect to Docker
- Ensure Docker socket is mounted: `-v /var/run/docker.sock:/var/run/docker.sock`
- Check Docker socket permissions

### Backup fails
- Verify database container name is correct
- Check database credentials in `applications.json`
- Ensure database client tools are installed (included in Docker image)

### API returns 401 Unauthorized
- Verify `X-API-Key` header is set correctly
- Check API_KEY in `.env` file

### Dashboard not loading
- Check browser console for errors
- Verify API_KEY is correct when prompted
- Ensure the service is running: `docker-compose ps`

## Logs

Logs are stored in `./logs/`:
- `combined.log` - All logs
- `error.log` - Error logs only

View logs:
```bash
# Docker
docker-compose logs -f

# Direct
tail -f logs/combined.log
```

## Security Considerations

1. **Change the default API key** in production
2. **Use HTTPS** with a reverse proxy (Nginx/Caddy)
3. **Restrict access** to the monitoring port using firewall rules
4. **Secure database credentials** in `applications.json`
5. **Regular backup testing** - verify backups can be restored

## License

MIT

## Support

For issues and questions, please open an issue on the repository.
