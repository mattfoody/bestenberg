# Getting started

## Requirements

WordPress 7.1 or newer, PHP 8.1 or newer. WooCommerce is optional.

## Install

1. **Plugins → Add New → Upload**: `bestenberg-x.y.z.zip`, then activate.
2. **Appearance → Themes → Add New → Upload**: `bestenberg-theme-x.y.z.zip`, then activate.
   The theme's header, footer and templates are made of Bestenberg components, so they can
   be edited like any page. Bestenberg also works with other block themes; you then edit
   pages only.
3. Click **Enable auto-updates** for both. Updates come from the Bestenberg update server
   and appear under Dashboard → Updates like any other.
4. Optional: **Bestenberg → License** to enter a license key.

## Open the editor

**Bestenberg** in the admin menu opens the editor. Pages and posts also get an
**Edit with Bestenberg** link in their lists.

On an empty site choose **Add demo pages**: four pages for a fictional bakery (home, about,
bread box, contact). They are ordinary pages; restyle, rewrite or delete them. Running it
again never overwrites your changes. From the command line:

```bash
wp eval '\Bestenberg\Demo\Importer::run();' --user=admin
```

## The screen

- **Bar**: page list (pages, posts, templates, header and footer), preview size, undo/redo,
  Generate, Save.
- **Structure** (left): the page as a tree. Drag to reorder. **Add** inserts sections,
  components or live site data.
- **Canvas** (middle): the real page with the site's theme. Click to select, click selected
  text again (or double-click) to type.
- **Settings** (right): what can be changed about the selection.

Nothing is public until you choose **Save**.

## Shortcuts

| Keys | Action |
|---|---|
| Ctrl/Cmd + S | Save |
| Ctrl/Cmd + Z, Shift + Ctrl/Cmd + Z | Undo, redo |
| Ctrl/Cmd + D | Duplicate the selection |
| Delete | Remove the selection |
| Escape | Stop typing / clear the selection |

## Leaving Bestenberg

Everything is stored as WordPress blocks. If the plugin is deactivated, text, images and
buttons remain regular core blocks; Bestenberg's layout blocks (section, grid, …) need the
plugin to render.
