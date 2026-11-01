# Next.js only. Convex runs separately (see the README), and the browser talks to it directly.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
# NEXT_PUBLIC_ values are compiled into the browser bundle, so they must exist at build
# time. They are public by design. CLERK_SECRET_KEY is deliberately not a build argument.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CONVEX_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL
RUN test -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" && test -n "$NEXT_PUBLIC_CONVEX_URL" \
  || (echo "Set the NEXT_PUBLIC_ values in .env.local. See the README." && exit 1)
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
