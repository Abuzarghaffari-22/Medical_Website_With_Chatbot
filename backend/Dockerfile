FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS production

LABEL maintainer="your-team@example.com"
LABEL description="Medical Clinic API — Node.js + Express"
LABEL version="1.0.0"

WORKDIR /app

# Non-root user for security
RUN addgroup -g 1001 -S appgroup \
    && adduser  -u 1001 -S appuser -G appgroup

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source (owned by appuser)
COPY --chown=appuser:appgroup . .

# Create logs directory
RUN mkdir -p logs && chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000

# Health check using the built-in /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "\
    require('http').get('http://localhost:5000/health', (r) => { \
      process.exit(r.statusCode === 200 ? 0 : 1); \
    }).on('error', () => process.exit(1));"

CMD ["node", "server.js"]