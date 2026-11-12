# RWT-3 · Suspend and reactivate accounts

|            |               |
| ---------- | ------------- |
| Epic       | Admin console |
| Status     | To do         |
| Depends on | RWT-2         |

## Why

When an account is abused (spam requests, a stolen password), an admin has to be able to stop it
at once, and undo that later.

## What

- Every user has a `status`: `active` or `suspended`. New accounts are `active`.
- **`PATCH /admin/users/:userId`** with `{ "status": "suspended" }` or `{ "status": "active" }`
  changes it and answers 200 with the user as `GET /admin/users` shows them.
- A suspended user:
  - can't sign in (401);
  - is signed out of open sessions: their next request answers 401;
  - doesn't appear in `GET /users` or `GET /users/search`, so nobody can pick them as a payee;
  - can't receive a payment or a request: `POST /transactions` to them answers 422
    `{ "error": "Receiver account is suspended" }`, and no money moves.
- Reactivating (`"status": "active"`) undoes all of it.
- `GET /admin/users` gets a `status` filter (`active` or `suspended`) and shows each user's
  `status`; `GET /admin/stats` counts `users.suspended`.
- The status can't be set through `POST /users` or `PATCH /users/:userId` (422), like the role.

## Acceptance criteria

- [ ] Suspending a seed user answers 200 with `"status": "suspended"`.
- [ ] That user's sign-in answers 401, and a session opened before the suspension answers 401.
- [ ] They're missing from `GET /users` and `GET /users/search` for other users.
- [ ] A payment to them answers 422 and neither balance changes.
- [ ] After reactivation they can sign in, appear in the lists and receive payments again.
- [ ] Suspending an admin, including yourself, answers 422 and changes nothing.
- [ ] An unknown user ID answers 404; a status other than `active` or `suspended` answers 422.
- [ ] `GET /admin/users?status=suspended` lists only suspended users; `GET /admin/stats` counts
      them.

## Out of scope

- What happens to requests that were already pending when the account was suspended: they stay
  as they are.
- Telling the suspended user why. Sign-in fails like a wrong password.
