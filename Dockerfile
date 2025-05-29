# Dockerfile (at project root)

FROM node:20-slim

# Install dependencies
WORKDIR /app
COPY 01-scraper-local/package*.json ./
RUN npm ci --production

# Copy the rest of your backend code
COPY 01-scraper-local/ .

# Expose port and run
ENV PORT=8080
EXPOSE 8080
CMD ["node", "entrypoint.js"]
