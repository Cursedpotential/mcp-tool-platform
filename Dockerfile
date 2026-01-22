FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache git curl

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
# Build server application only (skipping broken client build for now)
RUN pnpm run build:server

# Clean up dev dependencies (optional, but good for production)
# RUN pnpm prune --prod

# Expose port
EXPOSE 3000

# Start application
CMD ["pnpm", "start"]
