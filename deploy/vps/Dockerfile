# Compile TypeScript on the operator machine or CI before building this image.
FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY dist ./dist
COPY config ./config
USER node
CMD ["node", "dist/src/entrypoints/webhook.js"]
