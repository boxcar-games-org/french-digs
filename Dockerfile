FROM denoland/deno:alpine

WORKDIR /app

# The build/ folder is pre-built locally and committed to the repo
COPY build/ build/

ENV NODE_ENV=production
ENV PORT=3000
ENV ORIGIN=https://www.boxcar-games.com

EXPOSE 3000

# Run the SvelteKit build output using Deno's Node-compatibility layer
CMD ["run", "-A", "build/index.js"]