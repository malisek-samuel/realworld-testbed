# RWT-1 · User roles

|            |               |
| ---------- | ------------- |
| Epic       | Admin console |
| Status     | Done          |
| Depends on | —             |

## Why

Every account in the app is the same kind of account. The admin console needs to know who is
staff, and that must be something users can't grant themselves.

## What

- Every user has a `role`: `user` or `admin`. New accounts are `user`.
- The seed data has one admin, username `admin`, password `admin`, with a bank account so the
  first-login onboarding doesn't appear.
- The signed-in user's role is part of the user object that `POST /login` and `GET /checkAuth`
  return.
- The role can't be set through the API: `POST /users` (sign-up) and `PATCH /users/:userId` reject
  a body that contains `role`.
- The side menu shows an **Admin** badge under an admin's username.

## Acceptance criteria

- [x] Signing in as `admin` / `admin` succeeds and the returned user has `"role": "admin"`.
- [x] Every other seed user, and every newly signed-up user, has `"role": "user"`.
- [x] `POST /users` with `"role": "admin"` answers 422 and creates no user.
- [x] `PATCH /users/:userId` with `"role": "admin"` answers 422 and the role doesn't change.
- [x] The side menu of `admin` shows the Admin badge (`data-test="sidenav-admin-badge"`); other
      users' side menus don't.

## Out of scope

- Anything an admin can do: RWT-2 to RWT-4.
- Changing a user's role from the app. Roles are set in the data.
