# ---- Build stage: compile the React dashboard ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime stage: API + built dashboard only ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000 DATABASE_FILE=/data/service-desk.db
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/client/dist ./client/dist
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 4000
HEALTHCHECK CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "--no-warnings", "server/src/index.js"]
