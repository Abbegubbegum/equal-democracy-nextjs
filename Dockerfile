# syntax=docker.io/docker/dockerfile:1

FROM node:20-alpine
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat

RUN adduser -D -s /bin/sh -u 1001 app
USER app


WORKDIR /app
COPY package.json package-lock.json ./

RUN npm ci

COPY --chown=app:app . /app

EXPOSE 3000