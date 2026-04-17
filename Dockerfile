FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./
COPY package-lock.json* ./

RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install --no-audit --no-fund; \
    fi

COPY . .

RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4173

COPY package.json ./
COPY package-lock.json* ./

RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev --no-audit --no-fund; \
    fi

COPY server.mjs server-origin.mjs server-ws-auth.mjs server-ws-frame.mjs ./
COPY --from=build /app/dist ./dist

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "const h=process.env.HEALTHCHECK_HOST||'127.0.0.1';const p=process.env.PORT||4173;fetch(`http://${h}:${p}/api/meta`).then((res)=>process.exit(res.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["node", "server.mjs"]
