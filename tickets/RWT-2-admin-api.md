# RWT-2 · Admin API: users and statistics

|            |               |
| ---------- | ------------- |
| Epic       | Admin console |
| Status     | To do         |
| Depends on | RWT-1         |

## Why

An admin needs to see who uses the app and how much it is used. Today the only user list is the
payee picker, which hides the signed-in user and returns password hashes.

## What

Admin-only endpoints under `/admin`:

- **`GET /admin/users`**: every user, newest first, paginated like `/transactions`
  (`page`, `limit`; the response is `{ pageData, results }`). Each result has `id`, `username`,
  `firstName`, `lastName`, `email`, `phoneNumber`, `avatar`, `role`, `balance`, `createdAt` and
  `transactionCount` (sent and received). Never the password hash.
- `q` narrows the list to users whose username, first name, last name or email contains it,
  ignoring case.
- **`GET /admin/stats`**: `users` (`total`, `admins`), `transactions` (`total`, `payments`,
  `requests`, `pendingRequests`) and `volume`: the amount of all completed transactions, in cents.

Access: 401 without a session, 403 `{ "error": "Forbidden" }` for a signed-in user who isn't an
admin.

## Acceptance criteria

- [ ] Both endpoints answer 401 without a session and 403 for a seed user who isn't an admin.
- [ ] As `admin`, `GET /admin/users` lists every user with the fields above and no `password`.
- [ ] `limit=2` returns 2 users, and `pageData.totalPages` is the number of users divided by 2,
      rounded up.
- [ ] `q=bradtke` finds Kristian Bradtke (`Arvilla_Hegmann`); a `q` that matches nobody returns
      an empty list.
- [ ] `transactionCount` of a user equals the number of transactions they sent or received.
- [ ] `GET /admin/stats` numbers match the database, and `volume` counts completed transactions
      only.

## Out of scope

- Changing users: RWT-3.
- The page that shows this: RWT-4.
