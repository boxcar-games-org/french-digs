# Build Stage
FROM denoland/deno:2.4.0 AS builder

WORKDIR /app

# Copy deno config files first for layer caching
COPY deno.json deno.lock ./

# Cache dependencies
RUN deno install --allow-scripts

# Copy source
COPY . .

# Build the SvelteKit app
RUN deno task build

# Production Stage
FROM denoland/deno:2.4.0

WORKDIR /app

# Copy built output and deps
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY deno.json .

ENV NODE_ENV=production
ENV PORT=3000
ENV ORIGIN=https://www.boxcar-games.com

EXPOSE 3000

CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "build/index.js"]