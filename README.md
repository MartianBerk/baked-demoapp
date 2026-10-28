# baked-demoapp

Small React/TypeScript client for [baked-auth](../baked-auth) and [baked-user](../baked-user). You can register, sign in, then create and edit the profile document for each app in the baked-user catalog.

The browser only talks to this app. The Vite dev server (and nginx in Docker) proxy `/auth` to baked-auth and `/user` to baked-user. That keeps CORS out of the way when the UI is served from a different origin than the APIs.

## Requirements

- Node 20+
- baked-auth and baked-user already running

## Setup

```bash
cp .env.example .env
npm install
```

`.env` is only used by the Vite proxy. Defaults match local `poetry run` ports: baked-auth on `8000`, baked-user on `8001`. If those services are running in Docker instead, point at the published ports:

```bash
AUTH_UPSTREAM=http://127.0.0.1:8010
USER_UPSTREAM=http://127.0.0.1:8020
```

## Run

```bash
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Docker

```bash
docker compose up --build
```

The container listens on [http://127.0.0.1:8030](http://127.0.0.1:8030). It reaches the API containers through the host (`host.docker.internal`), defaulting to baked-auth `:8010` and baked-user `:8020`. Override with `AUTH_UPSTREAM` and `USER_UPSTREAM` if those ports differ.

## Talking to the APIs from Docker

A static React app runs in the browser, not inside the container, so Docker service names like `http://baked-auth:8000` would not work as frontend URLs. This app avoids that by proxying from nginx.

That still needs the API ports reachable from the demo container. Same-host compose (this machine, or the existing self-hosted runner) is the intended setup. If baked-auth / baked-user live on another host, set the upstream env vars to those URLs.

baked-auth currently publishes `8010:8010` while its process listens on `8000`. If the demo container cannot reach auth, try `AUTH_UPSTREAM=http://host.docker.internal:8000` (or fix that port mapping in baked-auth to `8010:8000`).
