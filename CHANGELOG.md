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
- Admin console at `/admin`, in the side menu of admins: statistics, and a table of users with
  search, a status filter and pages, where an admin suspends or reactivates a user after
  confirming. Other users who open the page are told they don't have access.
- Split a bill, API: `POST /splits` requests money from up to 10 people at once, split equally (to
  the cent, leftover cents to the first payers, the creator first) or by custom amounts that must
  add up to the total; you can include your own share or not. Each person gets an ordinary
  request. `GET /splits/:splitId` shows how much has been collected, is outstanding or was
  declined, to the creator and the participants.
- Split page at `/splits/:splitId`: the total, the creator's share, a progress bar of what has been
  collected, and each person's request marked Paid, Pending or Declined. A request that belongs to
  a split links to it from its transaction page.

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
