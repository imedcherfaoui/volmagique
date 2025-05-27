# ---------- build stage ----------
    FROM node:20-slim AS build
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci --omit=dev
    COPY . .
    
    # ---------- run stage ----------
    FROM node:20-slim
    WORKDIR /app
    COPY --from=build /app /app
    ENV NODE_ENV=production
    CMD ["node", "entrypoint.js"]
    