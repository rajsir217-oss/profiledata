FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (gcc for builds, libgl1/libglib for mediapipe/OpenCV face detection)
# mongodb-database-tools provides mongodump/mongorestore for scheduled backups
RUN apt-get update && apt-get install -y \
    gcc \
    libgl1 \
    libglib2.0-0 \
    wget \
    gnupg \
    && wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" > /etc/apt/sources.list.d/mongodb-org-7.0.list \
    && apt-get update && apt-get install -y mongodb-database-tools \
    && apt-get purge -y wget gnupg \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy application code
COPY . .

# Create uploads and backups directories
RUN mkdir -p uploads backups

# Expose port
EXPOSE 8080

# Start with gunicorn using full main.py with MongoDB support
# Use 1 worker for Socket.IO (in-memory sessions require single process)
CMD exec gunicorn main:socket_app \
    --bind 0.0.0.0:8080 \
    --workers 1 \
    --worker-class uvicorn.workers.UvicornWorker \
    --timeout 300 \
    --access-logfile - \
    --error-logfile - \
    --log-level info
