# Tickets

The backlog for features built on top of the Real World App. One file per ticket, named by its ID.
A ticket is closed by the pull request that implements it: the PR sets the ticket's status to
**Done**, and its description links the ticket.

| ID                                   | Title                            | Epic          | Status |
| ------------------------------------ | -------------------------------- | ------------- | ------ |
| [RWT-1](RWT-1-user-roles.md)         | User roles                       | Admin console | Done   |
| [RWT-2](RWT-2-admin-api.md)          | Admin API: users and statistics  | Admin console | Done   |
| [RWT-3](RWT-3-account-suspension.md) | Suspend and reactivate accounts  | Admin console | Done   |
| [RWT-4](RWT-4-admin-console-ui.md)   | Admin console page               | Admin console | Done   |
| [RWT-5](RWT-5-split-api.md)          | Split a bill: API                | Split a bill  | Done   |
| [RWT-6](RWT-6-split-detail-page.md)  | Split a bill: split details page | Split a bill  | Done   |
| [RWT-7](RWT-7-split-create-flow.md)  | Split a bill: creating a split   | Split a bill  | To do  |

## Epics

**Admin console.** The app has no staff accounts: nobody can see the user base, and a misbehaving
account can't be stopped. The epic adds roles, an admin-only API, account suspension and an admin
page.

**Split a bill.** Sharing a cost today means sending one request per person and doing the
arithmetic by hand. The epic lets a user request money from several people in one step, split
equally or by custom amounts, and follow who has paid.

## Writing a ticket

- **Why**: the problem, from the user's side.
- **What**: the behavior that will exist when the ticket is done.
- **Acceptance criteria**: checks a reviewer or a test can run, each pass or fail.
- **Out of scope**: what a reader might expect but won't get.
