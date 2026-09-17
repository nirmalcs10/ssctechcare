# Multi-stage Dockerfile for Computer Service Center Management System

# Stage 1: Build the client
FROM node:20-alpine AS build

WORKDIR /app

# Copy root and client packages
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd client && npm install

# Copy application source
COPY . .

# Build frontend production bundle
RUN cd client && npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Install build dependencies for better-sqlite3 native bindings
RUN apk add --no-cache python3 make g++

# Copy root package files and install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy server code and database directory
COPY server ./server

# Copy built frontend from build stage
COPY --from=build /app/client/dist ./client/dist

# Expose server port
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start the application
CMD ["npm", "start"]
