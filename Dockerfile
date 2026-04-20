FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package.json package-lock.json* ./
RUN npm ci --production

# Copy the pre-built output
COPY build/ build/

ENV NODE_ENV=production
ENV PORT=3000
ENV ORIGIN=https://www.boxcar-games.com

EXPOSE 3000

# Run the SvelteKit build output with Node
CMD ["node", "build/index.js"]