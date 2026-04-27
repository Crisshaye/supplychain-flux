# SupplyChain Flux - production image
# Single-stage build that installs deps, builds the React client, and serves
# everything from one Node process. Default port 7860 (Hugging Face Spaces);
# any host that sets the PORT env var (Koyeb, Render, Fly) will override.

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
RUN cd client && npm install --no-audit --no-fund && npm run build && cd ..

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=7860
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/engine.js ./engine.js
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/client/dist ./client/dist
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:${PORT}/healthz || exit 1
CMD ["node", "server.js"]
