# syntax=docker/dockerfile:1.7
FROM --platform=linux/amd64 node:22-bookworm-slim AS base
ENV CI=true
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

FROM base AS deps
COPY src/destiny-product/package.json src/destiny-product/pnpm-lock.yaml src/destiny-product/pnpm-workspace.yaml src/destiny-product/.npmrc ./
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG GIT_SHA
ARG RELEASE_TAG
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG PRODUCTION_SUPABASE_REF
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY src/destiny-product/ ./
RUN test "$GIT_SHA" = "dffe81bfe0ff326988ada580c1316399d2ffc69c" \
 && test "$RELEASE_TAG" = "rebound-seo-v1.1.3" \
 && test "$PRODUCTION_SUPABASE_REF" = "etkksjebqgtkkdqznnxa" \
 && case "$NEXT_PUBLIC_SUPABASE_URL" in *"$PRODUCTION_SUPABASE_REF"*) ;; *) echo "refusing non-production Supabase URL" && exit 1;; esac \
 && case "$NEXT_PUBLIC_SUPABASE_URL" in *titjatewvcjiuhisoppp*) echo "refusing staging Supabase URL" && exit 1;; *) ;; esac \
 && test "$NEXT_PUBLIC_SITE_URL" = "https://app.reboundseo.com" \
 && pnpm run build \
 && mkdir -p .next/static \
 && printf '%s\n' "$GIT_SHA" > .next/static/build-sha.txt \
 && printf '%s\n' "$RELEASE_TAG" > .next/static/build-tag.txt \
 && printf '%s\n' "production" > .next/static/build-env.txt \
 && printf '%s\n' "$NEXT_PUBLIC_SITE_URL" > .next/static/build-site-url.txt

FROM base AS prod-deps
COPY src/destiny-product/package.json src/destiny-product/pnpm-lock.yaml src/destiny-product/pnpm-workspace.yaml src/destiny-product/.npmrc ./
RUN pnpm install --frozen-lockfile --prod

FROM node:22-bookworm-slim AS runtime
ARG GIT_SHA
ARG RELEASE_TAG
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DESTINY_BUILD_SHA=$GIT_SHA
ENV DESTINY_BUILD_TAG=$RELEASE_TAG
LABEL org.opencontainers.image.source="https://github.com/joseangelo510/destiny"
LABEL org.opencontainers.image.revision=$GIT_SHA
LABEL org.opencontainers.image.version=$RELEASE_TAG
WORKDIR /app
RUN groupadd -r app && useradd -r -g app -d /app app
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/next.config.ts ./next.config.ts
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["sh","-c","SHA=\"$(cat .next/static/build-sha.txt)\" && TAG=\"$(cat .next/static/build-tag.txt)\" && BUILD_ENV=\"$(cat .next/static/build-env.txt)\" && BUILD_SITE_URL=\"$(cat .next/static/build-site-url.txt)\" && test \"$SHA\" = \"dffe81bfe0ff326988ada580c1316399d2ffc69c\" && test \"$TAG\" = \"rebound-seo-v1.1.3\" && test \"$BUILD_ENV\" = \"production\" && test \"$BUILD_SITE_URL\" = \"https://app.reboundseo.com\" && test \"$SHA\" = \"$DESTINY_BUILD_SHA\" && echo \"DESTINY_BUILD_SHA=$SHA\" && echo \"DESTINY_BUILD_TAG=$TAG\" && echo \"DESTINY_BUILD_ENV=$BUILD_ENV\" && echo \"DESTINY_BUILD_SITE_URL=$BUILD_SITE_URL\" && echo \"FLY_IMAGE_REF=${FLY_IMAGE_REF:-unset}\" && exec node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
