# RWT-8 · The health check names the release

|            |      |
| ---------- | ---- |
| Epic       | —    |
| Status     | Done |
| Depends on | —    |

## Why

The QA repository pins one release of this app and runs its suites against it. Nothing tells it
which release is actually running: a build from a working tree, or an older image, answers
`/health` the same way, and the tests then report on code they weren't written for.

## What

- `GET /health` returns `version`: the release the image was built for (`1.1.0`), or `dev` for any
  other build (a working tree, a local image built without a version).
- The release workflow builds the image with its version (`APP_VERSION`, from the tag).
- A container started with `APP_VERSION` set reports that value.

## Acceptance criteria

- [x] `/health` answers `"version": "dev"` when `APP_VERSION` isn't set.
- [x] `/health` answers the value of `APP_VERSION` when it is set.
- [x] An image built with `--build-arg APP_VERSION=1.2.3` reports `"version": "1.2.3"`; one built
      without it reports `"dev"`.
- [x] The release workflow passes the tag's version to the build.

## Out of scope

- Version in `/metrics` (a build-info series).
- Telling which commit a `dev` build came from.
