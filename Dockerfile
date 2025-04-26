# Use Node.js LTS (Long Term Support) as base image
FROM node:20-slim

# Set working directory
WORKDIR /usr/src/app

# Install system dependencies for PDF processing
RUN apt-get update && apt-get install -y \
    poppler-utils \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Create upload and logs directories with proper permissions
RUN mkdir -p uploads logs \
    && chmod 777 uploads \
    && chmod 777 logs

# Expose the port the app runs on
EXPOSE 3000

# Create a non-root user to run the app
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /usr/src/app

# Switch to non-root user
USER appuser

# Command to run the application
CMD ["node", "src/index.js"]