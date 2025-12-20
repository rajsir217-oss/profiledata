# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use legacy-peer-deps for React 19 compatibility)
RUN npm ci --legacy-peer-deps

# Copy app source
COPY . .

# Build the app
RUN npm run build

# Stage 2: Production with nginx
FROM nginx:alpine

# Copy custom nginx config with proper cache headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Fix file permissions so nginx can read all files (including config.js)
RUN chmod -R 644 /usr/share/nginx/html/*.js /usr/share/nginx/html/*.html /usr/share/nginx/html/*.json 2>/dev/null || true && \
    chmod -R 755 /usr/share/nginx/html/static 2>/dev/null || true && \
    find /usr/share/nginx/html -type d -exec chmod 755 {} \;

# Expose port
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
