# Node 18 on Alpine
FROM node:18-alpine

# Runtime packages. chromium path on Alpine is chromium-browser
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ttf-freefont \
    ca-certificates \
    dumb-init \
    libc6-compat \
    python3 \
    make \
    g++ \
    build-base \
    redis

ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_DISABLE_DEV_SHM_USAGE=true \
    SKIP_PUPPETEER_INSTALL=1 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false

WORKDIR /usr/src/app

# Install deps with scripts enabled and optional deps included
# so sharp can fetch the correct musl binary
COPY package*.json ./
RUN npm ci --omit=dev --include=optional \
 && npm cache clean --force

# App files
COPY --chown=node:node . .

# Belt and suspenders cleanup
RUN rm -rf /root/.cache/puppeteer /usr/src/app/.cache/puppeteer

USER node
EXPOSE 3000
ENTRYPOINT ["dumb-init","--"]
# Make sure your app reads process.env.PORT
CMD ["sh","-c","node apps/${APP_NAME:-api}/index.js"]