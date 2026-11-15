# Designing

## Building a page

**Add** has three tabs:

- **Sections**: ready-made heroes, feature grids, testimonials, pricing, calls to action.
  They are added below the section you are in.
- **Components**: section, container, stack, row, grid, card, spacer, heading, text, list,
  buttons, image, divider, quote. Only components that fit the current place are offered.
- **Site data**: live content from WordPress — site title, logo, menu, search, post title,
  content, featured image, post list — and from WooCommerce when it is active. These are
  WordPress blocks; Bestenberg places them, WordPress renders them.

## Styling

Every value comes from the site's design tokens: colours, font sizes, spacing, radii,
shadows, widths. There are no free pixel values, which is what keeps pages consistent and
lets the AI produce pages that match the site.

## Screen sizes

Preview **Mobile**, **Tablet** and **Desktop** in the bar. Styling is mobile-first:

- **Changes apply to all sizes** (default) sets the base value.
- **Changes apply to tablet and up / desktop only** sets an override for that size.

A setting that comes from a smaller size shows "from all sizes" or "from tablet and up";
**Reset** removes an override. Visibility has a switch per size.

## Text

Click selected text to type. The toolbar offers bold, italic and link. Pasted text is
cleaned to plain text.

## Templates, header and footer

Administrators see **Templates** and **Header and footer** in the page list. They are
edited like pages; post-related blocks (title, content, product price, …) are previewed
with a published example. Saving a template creates a customised copy in the database, as
in WordPress itself; delete that copy under Appearance → Editor to return to the theme's
version.

Direct links: `admin.php?page=bestenberg&template=bestenberg//single` and
`&part=bestenberg//footer`.

## Blocks from other plugins

Blocks Bestenberg does not know are kept exactly as they are and shown on the canvas. You
can move or delete them; edit their content in the WordPress editor.
