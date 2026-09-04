FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/admin

COPY admin/package.json admin/package-lock.json ./
RUN npm ci

COPY admin/ ./
COPY prisma/ /workspace/prisma/

RUN npm run build

ENV HOST=0.0.0.0
ENV PORT=3001
ENV NODE_ENV=production
ENV TRUST_PROXY=true
ENV PUBLIC_GAME_URL=https://minimystics.com

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.prisma && node dist/app.js"]
