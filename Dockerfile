FROM node:24.16.0-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:24.16.0-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /workspace/dist ./dist
COPY --chown=node:node server.mjs ./server.mjs
USER node
EXPOSE 8080
ENTRYPOINT ["node", "server.mjs"]
