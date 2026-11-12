# RWT-6 · Split a bill: split details page

|            |              |
| ---------- | ------------ |
| Epic       | Split a bill |
| Status     | To do        |
| Depends on | RWT-5        |

## Why

After splitting a bill, the creator wants to see at a glance who has paid and how much is still
missing. A participant wants to see what the request belongs to.

## What

- **`/splits/:splitId`** shows the split: description, who created it and when, the total, the
  creator's own share, and a progress bar of collected against requested.
- Then one row per participant: avatar, name, amount and status: **Paid**, **Pending** or
  **Declined**. Each row links to its request.
- A request that belongs to a split shows "Part of a split" with a link to the split on its
  transaction page.
- A split the user may not see shows "You don't have access to this split"; an unknown one shows
  "Split not found".

Every element a test needs has a `data-test` attribute (`split-...`).

## Acceptance criteria

- [ ] The page shows the amounts from `GET /splits/:splitId`, formatted as dollars.
- [ ] After a participant accepts, their row says Paid and the progress bar grows.
- [ ] A declined request shows Declined and doesn't count as collected.
- [ ] The transaction page of a split request links to the split; other transactions don't.
- [ ] A user outside the split sees the no-access message; a made-up ID shows "Split not found".

## Out of scope

- Creating a split from the app: RWT-7.
