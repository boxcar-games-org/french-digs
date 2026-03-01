# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --production

# Production Stage
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
# Update this to match your specific domain requirements if needed
ENV ORIGIN=https://www.boxcar-games.com

EXPOSE 3000

CMD [ "node", "build" ]