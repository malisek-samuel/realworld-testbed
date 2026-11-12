# Test image of the Real World App testbed: frontend on 3000, API on 3001.
# It runs with NODE_ENV=test, so /testData and the fault switches (/testing/faults) exist:
# for local runs and CI only, never a public deployment.
FROM node:22-bookworm-slim

ENV CYPRESS_INSTALL_BINARY=0 \
    HUSKY=0

RUN mkdir /app && chown node:node /app
WORKDIR /app
USER node

COPY --chown=node:node package.json yarn.lock ./
COPY --chown=node:node patches ./patches
RUN yarn install --frozen-lockfile --network-timeout 600000 && yarn cache clean

COPY --chown=node:node . .
RUN yarn build:testbed

EXPOSE 3000 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# Seeds the data, then serves the built frontend and the API (without coverage instrumentation).
CMD ["yarn", "start:testbed"]
