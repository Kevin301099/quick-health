# The API as a container, for hosts that bill by the CPU and memory actually used
# (Bunny Magic Containers, Google Cloud Run, Fly.io machines with auto-stop).
# Build from the rihla-uae-visa folder, because the API shares code with the web app:
#   docker build -f backend/Dockerfile -t rihla-api .

FROM node:22-slim AS build
WORKDIR /app
COPY backend/package.json backend/package-lock.json backend/
RUN cd backend && npm ci --no-audit --no-fund
COPY src/domain src/domain
COPY src/lib src/lib
COPY backend backend
RUN cd backend && npm run build

# The bundle needs no node_modules, so the final image is the Node runtime plus about 1 MB of code.
FROM node:22-slim
ENV NODE_ENV=production PORT=8080 NODE_OPTIONS=--enable-source-maps
WORKDIR /app
COPY --from=build /app/backend/dist/server ./
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
