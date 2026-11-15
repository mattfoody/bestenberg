# Client editing

Bestenberg has two modes, chosen by WordPress role:

| Role | Mode | Can do |
|---|---|---|
| Administrator | Design | Everything |
| Editor | Client | Change text, images and links |

In client mode there is no inserter, no styling and no Generate. Clients click a text to
rewrite it, or select an image or button and change it in the panel on the right.

## Deciding what clients may change

Select a component in design mode. **Client editing → People who edit content can**:

- **Change text, images and links** (default).
- **Also add, reorder and remove items inside**: for groups of repeated things, such as
  team members, FAQ entries or pricing plans. Clients then get Duplicate, Move and Delete
  for the items directly inside. Available on containers and lists.
- **Change nothing here**: locks the component and everything inside it, for example legal
  text.

## Checking it

**Client view** in the bar switches the editor to what an Editor sees, without logging out.

## What it is not

Client mode prevents accidents. It is not a security boundary: an Editor can still open the
page in the WordPress block editor. If a person must not change a page at all, do not give
them a role that can edit it.

## First use

Each mode shows a short introduction once per person.
