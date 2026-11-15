# AI

**Generate** builds sections from a description, a screenshot, or both, using the site's own
components and tokens. The result is ordinary Bestenberg content: select and edit anything.

## Setup

Bestenberg uses the AI provider connected in WordPress (**Settings → Connectors**). Bring
your own key from any supported provider. Without a connected provider, Generate explains
what is missing.

## Using it

1. Choose **Generate**.
2. Describe the page or section ("landing page for a bakery with opening hours and a
   call to order online"), and optionally attach a PNG, JPEG or WebP screenshot to rebuild.
3. Choose whether to add below the selection or replace the page.
4. Review on the canvas: **Keep** or **Discard**. Nothing is saved until you save.

## What happens to the answer

The model's answer is never trusted as is. Bestenberg normalises it, snaps free values
(`24px`, `#1d4ed8`) to the nearest token, removes unsafe HTML, validates it against the
document schema and asks the model to repair it up to three times. If it still does not
validate, nothing is inserted.

## Privacy

Your description, and the screenshot if you attach one, are sent to the connected provider.
The screenshot is scaled down in the browser first. Page content is not sent unless it is
part of your description.

## For AI agents

The ability `bestenberg/get-design-system` returns the site's tokens and components, so an
agent can produce content that fits.

## Measuring quality

`pnpm eval` rebuilds fixture pages from screenshots and scores the result (visual and
structural similarity). CI runs it with built-in oracle and degraded providers; run a real
model with:

```bash
BESTENBERG_EVAL_API_KEY=… BESTENBERG_EVAL_MODEL=… node packages/ai/eval/run.mjs --provider=openai
```
