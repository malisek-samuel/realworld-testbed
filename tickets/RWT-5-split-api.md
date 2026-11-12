# RWT-5 · Split a bill: API

|            |              |
| ---------- | ------------ |
| Epic       | Split a bill |
| Status     | To do        |
| Depends on | RWT-3        |

## Why

To share a $90 dinner between three people, a user has to send two requests by hand and work out
the amounts. Odd totals don't divide evenly, and it's easy to get the cents wrong.

## What

**`POST /splits`** creates one payment request per participant, in one step:

```json
{
  "description": "Dinner at Luigi's",
  "total": "90.00",
  "mode": "equal",
  "includeSelf": true,
  "participants": [{ "userId": "GjWovtg2hr" }, { "userId": "_XblMqbuoP" }]
}
```

- `total` is in dollars, more than 0, with at most two decimals.
- `includeSelf`: whether the creator pays a share too (their share isn't requested from anyone).
- **`equal`**: the total is divided into whole cents among everybody who pays. Cents left over go
  one each to the first people in order, the creator first. $100 between three is $33.34 for the
  creator and $33.33 for each participant.
- **`custom`**: every participant has an `amount`, and with `includeSelf` the creator gives
  `selfAmount`. They must add up to the total exactly; otherwise 422 says by how much they're off.
- 1 to 10 participants, at least two payers in all (creator included). No duplicates, not the
  creator, every participant must exist and be active. Every share must be at least $0.01.
- All or nothing: if anything is invalid, nothing is created (422 with `errors`).
- Each request is an ordinary request transaction (the participant accepts or declines it as
  usual and gets the usual notification), with `splitId` pointing to the split.
- 201 with `{ split }`, the summary below.

**`GET /splits/:splitId`**: the summary: `id`, `description`, `mode`, `createdAt`, `creator`
(`id`, `name`, `avatar`), `total`, `selfShare`, and `participants`, each with `userId`, `name`,
`avatar`, `amount`, `transactionId` and `requestStatus`, plus totals: `collected` (accepted),
`outstanding` (pending), `declined`. All amounts in cents. Only the creator and the participants
can read it (403); an unknown ID is 404.

Splits are a new collection, `splits`, counted by `/health` and `/metrics` and readable at
`/testData/splits`.

## Acceptance criteria

- [ ] $100 split equally between the creator and two participants: requests of 3333 and 3333
      cents, `selfShare` 3334.
- [ ] $0.05 split equally between five payers: 1 cent each. $0.04 between five: 422.
- [ ] Custom amounts that add up: created as given. Amounts $0.01 short of the total: 422, no
      transactions created.
- [ ] Duplicate participant, the creator as a participant, an unknown user, a suspended user, 11
      participants: 422, nothing created.
- [ ] Each participant gets a pending request with `splitId` and a "requested" notification.
- [ ] Accepting one request moves it from `outstanding` to `collected` in the summary.
- [ ] A user outside the split gets 403; an unknown ID 404; no session 401.
- [ ] Amounts are exact for totals such as 33.33, 0.10 and 1234.56 (no floating-point drift).

## Out of scope

- The pages: RWT-6 and RWT-7.
- Reminders, editing or cancelling a split.
