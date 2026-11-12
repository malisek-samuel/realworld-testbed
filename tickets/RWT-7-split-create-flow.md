# RWT-7 · Split a bill: creating a split

|            |              |
| ---------- | ------------ |
| Epic       | Split a bill |
| Status     | To do        |
| Depends on | RWT-6        |

## Why

The split API exists, but users can only create splits through an HTTP client.

## What

- A **Split** button next to **New** in the top bar opens `/splits/new`.
- The form asks for a description and a total, and lets the user pick up to 10 people with a
  search like the payment flow. Picked people show as chips that can be removed.
- An **Include me** switch (on by default) and an **Equal** / **Custom** choice.
- Equal: a preview lists everybody's share, computed the same way as the API, so the preview and
  the requests always match.
- Custom: an amount field for each person (and for the creator with Include me). A line shows how
  much is left to assign, or how much it's over.
- **Request** is enabled only when the split is valid. It creates the split, shows a message, and
  opens the split's page.
- An error from the API shows on the form, and nothing is lost.

Every control has a `data-test` attribute (`split-create-...`).

## Acceptance criteria

- [ ] The Split button opens the form.
- [ ] Total $100, two people, Include me, Equal: the preview shows $33.34 for the user and $33.33
      for each person.
- [ ] Custom amounts that don't add up keep Request disabled and show the difference.
- [ ] Submitting a valid split opens its page with the same amounts as the preview.
- [ ] Each person picked can be removed; nobody can be picked twice; the user can't pick
      themselves.

## Out of scope

- Splitting from an existing transaction.
- Saving a draft.
