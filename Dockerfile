# Multi-stage Dockerfile for Computer Service Center Management System

# Stage 1: Build the React client
FROM node:20-slim AS build

WORKDIR /app/client

# Install frontend dependencies
COPY client/package*.json ./
RUN npm install

# Copy frontend source and build production bundle
COPY client/ ./
RUN npm run build

# Stage 2: Production runtime
FROM node:20-slim AS production

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy root dependencies and install production modules
COPY package*.json ./
RUN npm install --omit=dev

# Copy server code
COPY server ./server

# Copy built frontend from build stage
COPY --from=build /app/client/dist ./client/dist

# Ensure database directory exists
RUN mkdir -p /app/server/data

# Expose server port
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start the application
CMD ["npm", "start"]
