FROM node:22-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache git curl python3 make g++

# Copy package files first for caching
COPY package.json ./

# Install dependencies using npm (more reliable in CI)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build server application
RUN npm run build:server

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
