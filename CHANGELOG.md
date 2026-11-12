# Changelog

Releases of the Real World App testbed. Each version is tagged (`v1.0.0`) and published as the
image `ghcr.io/malisek-samuel/realworld-testbed:<version>`; the QA repository
([qa-showcase](https://github.com/malisek-samuel/qa-showcase)) pins the version it tests.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- User roles. An account is a user or an admin. The seed data has one admin, `admin` / `admin`,
  whose side menu shows an Admin badge.

### Security

- Sign-up and profile updates reject a `role`, so users can't make themselves admins.

## [1.0.0] - 2026-11-12

First testbed release, based on Cypress's Real World App at upstream commit `0729f68`.

### Added

- `GET /health`: database record counts and file size, process memory, active fault switches;
  503 when the database can't be read.
- `GET /metrics`: Prometheus metrics — request duration by route template, process memory,
  event-loop lag, garbage collection, records per collection, fault switch counters.
- `/testing/faults` (development and test only): added latency with jitter, an error rate with a
  chosen status, and a capped memory leak. Affected responses carry an `X-Fault-Injected` header.
- `yarn start:testbed`: the app as the test image runs it — seeded data, built frontend, API in
  test mode without coverage instrumentation or runtime type-checking.
- A Docker test image, published on every version tag.

### Removed

- The upstream GitHub workflows (Cypress Cloud recording, issue triage, the flake-demo branch).
