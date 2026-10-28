# TECH-15: All-in-One-Image — Fastify serviert API + WS + das Web-Build.
# Kein npm-Workspaces-Setup: jedes Paket hat eigenen Lockfile und wird
# separat installiert (@raccoons/contracts wird per file:-Dep aufgeloest).

FROM node:24-slim AS build
WORKDIR /repo

# Zuerst nur Manifeste, damit npm ci gecacht werden kann.
COPY contracts/package.json contracts/package-lock.json contracts/
COPY apps/server/package.json apps/server/package-lock.json apps/server/
COPY apps/web/package.json apps/web/package-lock.json apps/web/
RUN cd contracts && npm ci && cd ../apps/server && npm ci && cd ../apps/web && npm ci

COPY . .
RUN npm --prefix contracts run build \
    && npm --prefix apps/web run build \
    && npm --prefix apps/server run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0

# Produktions-Abhaengigkeiten (contracts zuerst — file:-Dep des Servers
# verlinkt auf ../contracts).
COPY contracts/package.json contracts/package-lock.json contracts/
COPY apps/server/package.json apps/server/package-lock.json apps/server/
RUN cd contracts && npm ci --omit=dev && cd ../apps/server && npm ci --omit=dev

COPY --from=build /repo/contracts/dist contracts/dist
COPY --from=build /repo/apps/server/dist apps/server/dist
COPY --from=build /repo/apps/server/seeds apps/server/seeds
COPY --from=build /repo/apps/server/migrations apps/server/migrations
COPY --from=build /repo/apps/web/dist apps/web/dist

# STATIC_DIR zeigt auf das Web-Build; DATABASE_URL/ADMIN_TOKEN kommen aus
# der Plattform-Umgebung (siehe README „Deployment").
ENV STATIC_DIR=/app/apps/web/dist DATABASE_ALLOW_REMOTE=true

CMD ["node", "apps/server/dist/main.js"]
