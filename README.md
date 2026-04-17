# Selenwright UI

Operator console for [Selenwright](https://github.com/aqa-alex/selenwright) — a browser automation grid with native Selenium WebDriver and Playwright WebSocket support. Dense, readable interface for monitoring live sessions, watching VNC, tailing logs, browsing artefacts (videos, logs, downloads), and managing browser inventory.

![Sessions page — light theme](docs/sessions-light.png)

## Documentation

**Full docs: https://aqa-alex.github.io/selenwright-ui/latest/**

The site covers quick start, every page in the UI (Sessions, VNC, Logs, Videos, Browsers, Configuration, System, Settings), authentication and RBAC, reverse-proxy deployment, the full list of `SELENWRIGHT_*` environment variables, and the FAQ. That is where to look for anything beyond "get it running".

## Quick start

Run the combined stack from the parent [`selenwright`](https://github.com/aqa-alex/selenwright) repo:

```bash
git clone https://github.com/aqa-alex/selenwright.git
cd selenwright
docker compose up -d
```

Open http://localhost:4173 and sign in (default `admin` user from `selenwright/config/users.htpasswd`).

See the [Quick Start Guide](https://aqa-alex.github.io/selenwright-ui/latest/#_quick_start_guide) for the details and `docker-compose.yml` walkthrough.

## Local development

```bash
npm install
npm run dev
```

Vite serves on `http://127.0.0.1:4173`, the API proxy on `:4174`. Point at a real upstream with `SELENWRIGHT_TARGET=...`, or run against the built-in fixture dataset with `DEMO_MODE=true`.

See the [Running Locally](https://aqa-alex.github.io/selenwright-ui/latest/#_running_locally) section of the docs for dev scripts, env vars, and the test gate.

## License

Apache 2.0 — see [LICENSE](LICENSE).
