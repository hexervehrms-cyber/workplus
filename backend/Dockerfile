# WorkPlus API — production image
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5000
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
