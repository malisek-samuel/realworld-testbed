# Changelog

Releases of the Real World App testbed. Each version is tagged (`v1.0.0`) and published as the
image `ghcr.io/malisek-samuel/realworld-testbed:<version>`; the QA repository
([qa-showcase](https://github.com/malisek-samuel/qa-showcase)) pins the version it tests.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- User roles. An account is a user or an admin. The seed data has one admin, `admin` / `admin`,
  whose side menu shows an Admin badge.
- Admin API, for admins only: `GET /admin/users` lists every user with their transaction count,
  newest first, with search and pages; `GET /admin/stats` counts users, transactions and pending
  requests, and adds up the volume of completed transactions.
- Account suspension: an admin can suspend a user and reactivate them
  (`PATCH /admin/users/:userId`). A suspended user can't sign in, is signed out of open sessions,
  disappears from the people you can pay, and can't receive payments or requests. Admins can't be
  suspended.

### Security

- Sign-up and profile updates reject a `role` or a `status`, so users can't make themselves admins
  or lift a suspension.

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
