# AuditForge worker (recon). Imagen mínima; se despliega en un servidor DEDICADO y AISLADO
# (sin socket de Docker, sin privilegios, con firewall de salida). Ver README del repo §3 y §13.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

# Integración con Claude-BugHunter (Sachin Sharma / Claude-BugHunter; MIT + CC BY 4.0).
# Fíjalo a un commit que HAYAS REVISADO: pasa --build-arg PACK_COMMIT=<sha> para instalar `cbh`.
# Sin PACK_COMMIT, el worker funciona con su recon pasivo interno (sin el pack).
ARG PACK_REPO=https://github.com/elementalsouls/Claude-BugHunter
ARG PACK_COMMIT=
RUN if [ -n "$PACK_COMMIT" ]; then \
      apt-get update && apt-get install -y --no-install-recommends git python3 python3-pip pipx ca-certificates && \
      rm -rf /var/lib/apt/lists/* && \
      git clone "$PACK_REPO" /opt/claude-bughunter && \
      git -C /opt/claude-bughunter checkout "$PACK_COMMIT" && \
      PIPX_HOME=/opt/pipx PIPX_BIN_DIR=/usr/local/bin pipx install /opt/claude-bughunter ; \
    fi

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY scripts ./scripts
RUN chmod +x scripts/*.sh

# Activa el pack poniendo ENGAGEMENT_CMD=/app/scripts/engagement.sh en el entorno del worker
# (solo cuando PACK_COMMIT esté instalado). Sin ella, el worker usa su recon interno.
USER node
CMD ["node", "dist/index.js"]
