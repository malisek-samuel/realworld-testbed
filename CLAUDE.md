# CLAUDE.md

This file guides Claude Code (and anyone else) working in this repository.

`realworld-testbed` is [Cypress's Real World App](https://github.com/cypress-io/cypress-realworld-app) (MIT), a payments demo in the style of Venmo — React 18 + Vite frontend, Express API, lowdb (one JSON file) as the database — kept as its own repository, not a GitHub fork (commits made in a fork don't count toward the owner's contributions, and forks are left out of repository search). The `upstream` remote points at cypress-io for updates; `origin` is `github.com/malisek-samuel/realworld-testbed`.

It is the **system under test of [qa-showcase](https://github.com/malisek-samuel/qa-showcase)** (locally `../qa-showcase`), the QA repository of a LinkedIn video series on test types: API, E2E, user content ("customer messages"), Playwright UI, load and stress, long-run (soak) and AI-agent changelog testing. This repo holds the product and its testability hooks; the tests, load scripts, monitor, agents and reports live in qa-showcase, which pins a released version of this app. Features get added here on purpose, some with planted bugs, so tests and agents have something real to find.

The expert panel (`supercode` skill) lives in qa-showcase. To work on the app with it, start Claude Code in `../qa-showcase` and add this folder (`claude --add-dir ../realworld-testbed`, or `/add-dir`).

## Running

Node 22 comes from nvm; non-interactive shells don't load it:

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22
yarn dev               # development: frontend :3000 (Vite), API :3001, reseeds, restarts the API on backend edits
yarn build:testbed     # build the frontend into build/
yarn start:testbed     # as the test image runs it: reseeds, serves build/ on :3000, API on :3001 in NODE_ENV=test
yarn test:unit:ci      # Vitest, ~10 s
yarn types             # tsc --noEmit
docker build -t realworld-testbed . && docker run --rm -p 3000:3000 -p 3001:3001 realworld-testbed
```

Seed users: any `username` in `data/database-seed.json`, password `s3cret`. The app and the unit tests rewrite `data/database.json`, which upstream tracks: `git checkout data/database.json` before a commit. The Cypress binary isn't installed (`CYPRESS_INSTALL_BINARY=0`; `npx cypress install` adds it) — the series uses Playwright.

**Use `start:testbed` (or the image) for anything that measures performance.** `yarn dev` runs the API under `nyc` coverage instrumentation and ts-node's runtime type-checking; `start:testbed` runs it with neither (`TS_NODE_TRANSPILE_ONLY=true`; the types are checked by `yarn types` in CI). Measured on 2026-11-12, the API alone at rest after 100 requests: type-checking 608 MB RSS / 471 MB heap, ready in 2.8 s; transpile-only 212 MB / 87 MB, ready in 1.1 s; the whole `start:testbed` API 170 MB / 71 MB. Type-checking, not `nyc`, was most of the difference.

## Releases

1. Add the change under a new version in `CHANGELOG.md` (Keep a Changelog), written as a product changelog: what changed for a user of the app.
2. Commit, tag `vX.Y.Z`, push the tag: `.github/workflows/release-image.yml` publishes `ghcr.io/malisek-samuel/realworld-testbed:X.Y.Z` (and `latest`).
3. In qa-showcase, bump `APP_VERSION`.

**Planted bugs** are never named anywhere the agents can read — not in a commit message, the changelog, a code comment or a file name. The answer key stays outside both repositories (local file or private gist) until its episode is published.

`.github/workflows/ci.yml` runs `yarn types`, the unit tests and a build-and-start of the image on every push to `main` and every PR. The four upstream workflows (Cypress Cloud recording, issue triage, the flake-demo branch) were removed: they need secrets and branches this repo doesn't have.

## Testbed additions

Everything here is ours; the rest is upstream. Upstream files carry only these edits: `backend/app.ts` (two imports and two mount lines, marked "testbed"), `backend/database.ts` (`databaseFile` exported), `package.json` (`prom-client` 15.1.3 exact; the `build:testbed` / `start:testbed` scripts), `yarn.lock`, a header on `README.md`. Ours: `backend/ops-routes.ts`, `backend/fault-routes.ts`, `src/__tests__/ops.test.ts`, `Dockerfile`, `.dockerignore`, `.github/workflows/`, `CHANGELOG.md`, this file.

### Health, metrics and fault switches (v1.0.0, 2026-11-12)

`backend/ops-routes.ts` and `backend/fault-routes.ts`, tests in `src/__tests__/ops.test.ts` (11 tests; each was seen to fail on the code broken the way it guards against, 2026-11-12: raw paths as route labels, `/health` or `/testData` not exempt, switches on in production, the leak ignoring its cap or not released, `/health` hiding a database failure, validation skipping the ranges, injected faults not counted).

**`GET /health`** — always mounted, no login. Returns 200 with `status: "ok"`, `uptimeSeconds`, `database` (`fileBytes`, `records` per collection), `memory` (`rssBytes`, `heapUsedBytes`) and `faults` (`active`, `leakedBytes`); 503 with `status: "fail"` and the reason when the database can't be read. Fault switches are _reported_, never failed on: a monitor has to catch their symptoms itself. Cheap enough to poll every second: the data is counted in memory and the file only stat'ed.

**`GET /metrics`** — Prometheus text format, always mounted, no login:

- `http_request_duration_seconds{method,route,status_code}` — `route` is the route template (`/transactions/:transactionId`), never the raw path, so a load test with thousands of IDs stays one series per endpoint. Requests no route matched — 404s, static files and **injected errors** — are `route="other"`.
- process metrics from `prom-client`: `process_resident_memory_bytes`, `nodejs_heap_size_used_bytes`, `nodejs_external_memory_bytes`, `nodejs_eventloop_lag_seconds`, `nodejs_gc_duration_seconds`, …
- `rwa_db_records{collection}`, `rwa_db_file_bytes` — the data's growth over a long run;
- `rwa_fault_active{fault}`, `rwa_fault_leaked_bytes`, `rwa_fault_injected_total{fault}`.

Both are mounted before the request logger: polling them doesn't flood the log.

**`/testing/faults`** — only when `NODE_ENV` is `development` or `test`, like upstream's `/testData` (a test checks that production mode gives 404). `GET` shows the settings with `active` and `leakedBytes`; `PUT` changes only the settings in the body (all or nothing: one invalid value → 400 with `errors`, nothing changed); `DELETE` turns everything off and releases the leaked memory.

| Setting           | Range   | Default | Effect                                                                                         |
| ----------------- | ------- | ------- | ---------------------------------------------------------------------------------------------- |
| `latencyMs`       | 0–30000 | 0       | delay added to every affected request                                                          |
| `latencyJitterMs` | 0–30000 | 0       | plus a random 0…jitter ms                                                                      |
| `errorRate`       | 0–1     | 0       | share of requests answered with `errorStatus` and `{"error":"Injected fault","fault":"error"}` |
| `errorStatus`     | 500–599 | 500     | status of injected errors                                                                      |
| `leakMbPerMinute` | 0–1024  | 0       | memory retained each second (filled buffers: resident and external memory, not the JS heap)    |
| `leakCapMb`       | 1–4096  | 512     | the leak stops growing here                                                                    |

Faults hit login and every business route; never `/health`, `/metrics`, `/testing` or `/testData` (by mount order, and by `EXEMPT_PREFIXES` in case the order changes). Every affected response carries `X-Fault-Injected: latency`, `error` or `latency,error` — evidence per request for a test or an agent.

Measured under `yarn dev` (2026-11-12): `errorRate` 0.5 failed 23 of 40 logins, all 23 marked; `latencyMs` 300 + jitter 100 → a login took 360 ms while `/health` took under 1 ms; `leakMbPerMinute` 1020 with cap 100 → 51 MB at 3 s, 100 MB from 6 s, RSS +99 MB. After `DELETE`, `leakedBytes` and `nodejs_external_memory_bytes` drop at the next garbage collection; **RSS lags** and comes down only after a major GC (631 → 533 MB in that run), so a soak monitor should watch external memory for this leak.

Example (there's no `curl` on the workstation; `node -e` with `fetch` works):

```bash
curl -X PUT localhost:3001/testing/faults -H 'Content-Type: application/json' -d '{"errorRate":0.05,"latencyMs":200}'
curl localhost:3001/health
curl -X DELETE localhost:3001/testing/faults
```

## Decisions

- **2026-11-12** — two repositories: this app (`realworld-testbed`) and the QA work (`qa-showcase`), which pins a released image. This one is a plain repository, not a GitHub fork. The QA repo is in Python.
- **2026-11-12** — Playwright, not Cypress, for the series' browser tests; the upstream Cypress suites stay as they are.
- **2026-11-12** — fault switches only in `development` / `test`; `/health` reports them but doesn't fail on them; `prom-client` pinned exactly. The image runs in `test` mode, so it is for local runs and CI only.
- **2026-11-12** — load, stress and soak tests run locally (or on a machine the user owns), never against a hosted demo.
- **Open** — the image and both workflows haven't run yet: Docker isn't installed on the workstation, and the GitHub repository doesn't exist yet. The commands the image runs (`build:testbed`, `start:testbed`) were checked natively.

## Conventions

- Upstream style: one Express router per file in `backend/`, data access through `backend/database.ts`, Prettier `printWidth` 100, `// @vitest-environment node` for backend tests.
- Our additions live in our own files, each starting with a "Testbed addition" comment; upstream files get the smallest diff that works.
- A new test counts only after it was seen to fail on the broken feature.
- Commits: `git -c user.name=malisek-samuel -c user.email=204904171+malisek-samuel@users.noreply.github.com commit …` (no global git identity on the workstation). Commit and push only when asked.
