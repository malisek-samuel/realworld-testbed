# RWT-4 · Admin console page

|            |               |
| ---------- | ------------- |
| Epic       | Admin console |
| Status     | Done          |
| Depends on | RWT-3         |

## Why

The admin API is only usable with an HTTP client. Admins need a page.

## What

- An **Admin** item in the side menu, for admins only, opens `/admin`.
- The page shows four statistics: users (and how many are suspended), transactions, pending
  requests and volume.
- Below them, a table of users: name and avatar (admins marked with an Admin chip), username,
  email, balance, number of transactions and status. It has a search field, a status filter (all,
  active, suspended) and pages of 10.
- Each user who isn't an admin has a **Suspend** or **Reactivate** button. It asks for
  confirmation, naming the user; after the change a message confirms it and the table and
  statistics reload.
- A user who isn't an admin and opens `/admin` sees "You don't have access to this page", and the
  page requests no admin data.

Every control has a `data-test` attribute (`admin-...`), like the rest of the app.

## Acceptance criteria

- [x] `admin` sees the Admin menu item; other users don't.
- [x] `/admin` shows the statistics and the users from the API.
- [x] Typing in the search field narrows the table; the status filter shows only the matching
      users.
- [x] Suspending a user asks for confirmation; confirming changes their status chip to
      Suspended, and the suspended count goes up by one.
- [x] Reactivating does the reverse.
- [x] Admin rows have no Suspend button.
- [x] A user who isn't an admin sees the no-access message at `/admin`.

## Out of scope

- Editing users' details or roles.
- A page for one user's transactions.
