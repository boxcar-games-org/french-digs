FROM node:22-alpine

WORKDIR /app

# The build/ folder is pre-built locally and committed to the repo
COPY build/ build/
COPY package.json .

ENV NODE_ENV=production
ENV PORT=3000
ENV ORIGIN=https://www.boxcar-games.com

EXPOSE 3000

CMD ["node", "build/index.js"]