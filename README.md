# Selenwright UI

Readable, dense operator console for Selenwright browser sessions and artifacts.

The UI is a Vite-built Vue + TypeScript app served by `server.mjs`.

## Run locally

```bash
npm run dev
```

The app serves on `http://localhost:4173`.

By default it will try a lightweight proxy connection to `http://localhost:4444` for `/status`, `/logs/?json`, and `/video/?json`. Override the target if needed:

```bash
SELENWRIGHT_TARGET=http://localhost:4444 npm run dev
```

The local server also proxies `/api/vnc/<session-id>` as a WebSocket endpoint so the Vue noVNC viewer entry in `vnc.html` can watch live sessions with `vnc: true`.

If the target is unavailable, the UI falls back to an embedded demo dataset so layout and navigation remain fully usable.

## Docker

Build image:

```bash
docker build -t selenwright-ui:latest .
```

Run container:

```bash
docker run --rm -p 4173:4173 \
  -e SELENWRIGHT_TARGET=http://host.docker.internal:4444 \
  selenwright-ui:latest
```

The container listens on `0.0.0.0:4173`.

## Docker Compose

Run prebuilt image:

```bash
docker compose -f docker-compose.yml up
```

Build and run locally:

```bash
bash build.sh
```

## Checks

```bash
npm run build
npm run check
```

## CI / Release / Docker Push

- CI scripts are in `ci/`:
  - `ci/test.sh` — install deps + `npm run build` + `npm run check`
  - `ci/build.sh` — test + docker build validation
  - `ci/docker-push.sh <tag>` — push image to Docker Hub (`$GITHUB_REPOSITORY`)
- GitHub Actions workflows:
  - `.github/workflows/test.yml` — pull request checks
  - `.github/workflows/build.yml` — push to `main`, publish `latest`
  - `.github/workflows/release.yml` — on release, publish release tag and `latest-release`

Required GitHub secrets for image publishing:

- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`

## Structure

- `index.html` bootstraps the app and applies theme + density preferences before paint.
- `server.mjs` serves the static app and proxies lightweight API requests.
- `src/app/` contains the main console shell and Vue pages.
- `src/vnc/` contains the separate Vue noVNC viewer entry.
- `src/data/` contains typed data adapters and normalization.
- `codex-skills/` contains project-local skill definitions for future agent work.
