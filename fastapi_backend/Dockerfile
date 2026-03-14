FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (gcc for builds, libgl1/libglib for mediapipe/OpenCV face detection)
# mongodb-database-tools provides mongodump/mongorestore for scheduled backups
# Downloaded directly to avoid Debian Trixie GPG/SHA1 rejection of MongoDB apt repo
RUN apt-get update && apt-get install -y \
    gcc \
    libgl1 \
    libglib2.0-0 \
    curl \
    && curl -fSL https://fastdl.mongodb.org/tools/db/mongodb-database-tools-debian12-x86_64-100.10.0.deb -o /tmp/mongo-tools.deb \
    && dpkg -i /tmp/mongo-tools.deb \
    && rm /tmp/mongo-tools.deb \
    && apt-get purge -y curl \
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
