FROM node:24-slim

WORKDIR /app

# Install PostgreSQL client libraries
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 8080

# Run the application
CMD ["npm", "start"]
