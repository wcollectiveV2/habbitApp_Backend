FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build TypeScript
RUN npm run build 2>/dev/null || npx tsc --skipLibCheck 2>/dev/null || true

EXPOSE 3001

# Run with ts-node for development
CMD ["npx", "ts-node", "--transpile-only", "api/index.ts"]
