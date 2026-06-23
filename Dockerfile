FROM node:22-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-openpyxl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY public ./public
COPY server ./server
COPY scripts ./scripts
COPY vendor ./vendor
COPY docs ./docs
COPY README.md ./

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3100
ENV DATA_DIR=/app/data

RUN mkdir -p /app/data/uploads /app/data/imports /app/data/attachments

EXPOSE 3100

CMD ["node", "server/server.js"]
