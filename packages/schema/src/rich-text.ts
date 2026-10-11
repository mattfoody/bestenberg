/**
 * Rich text and URL safety (SCHEMA.md §3). Rich text allows only
 * `strong`, `em`, `a`, `br` and `span.bb-*`; everything else is dropped or
 * escaped. The output is canonical: sanitizing it again returns it unchanged.
 * PHP counterpart: Bestenberg\Content\RichText.
 */

const SAFE_SCHEMES = ['http', 'https', 'mailto', 'tel'];
const LINK_TARGETS = ['_blank', '_self'];
const LINK_RELS = ['noopener', 'noreferrer', 'nofollow', 'ugc', 'sponsored'];

/** Elements whose content is dropped together with the element. */
const DROP_WITH_CONTENT = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'template',
  'textarea',
  'title',
  'noscript',
  'svg',
  'math',
  'select',
];

const ENTITY = /^&(?:#\d{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/;
const TAG =
  /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/;
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  colon: ':',
  tab: '\t',
  newline: '\n',
  sol: '/',
};

/** Decodes numeric and common named entities (for checking attribute values). */
export function decodeEntities(value: string): string {
  return value.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);?/g, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Escapes a value for a double-quoted HTML attribute. */
export function escapeAttribute(value: string): string {
  return value
    .replace(/&(?!(?:#\d{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});)/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * True for http(s), mailto and tel URLs and for relative URLs. Rejects
 * `javascript:`, `data:` and anything that hides a scheme behind entities,
 * whitespace or control characters.
 */
export function isSafeUrl(url: string): boolean {
  const decoded = decodeEntities(url)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000- \u007f-\u009f]/g, '')
    .trim();
  if (decoded === '' || /[<>"]/.test(decoded)) return false;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(decoded);
  return scheme === null || SAFE_SCHEMES.includes(scheme[1]!.toLowerCase());
}

function parseAttributes(source: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1]!.toLowerCase();
    if (!out.has(name)) out.set(name, match[2] ?? match[3] ?? match[4] ?? '');
  }
  return out;
}

/** Allowed attributes for an allowed tag, or null if the tag must be dropped. */
function allowedAttributes(tag: string, attributes: Map<string, string>): string | null {
  switch (tag) {
    case 'strong':
    case 'em':
    case 'br':
      return '';
    case 'span': {
      const classes = decodeEntities(attributes.get('class') ?? '')
        .split(/\s+/)
        .filter((name) => /^bb-[a-z0-9-]+$/.test(name));
      return classes.length > 0 ? ` class="${classes.join(' ')}"` : null;
    }
    case 'a': {
      let out = '';
      const href = attributes.get('href');
      if (href !== undefined && isSafeUrl(href)) {
        out += ` href="${escapeAttribute(decodeEntities(href).trim())}"`;
      }
      const target = attributes.get('target');
      if (target !== undefined && LINK_TARGETS.includes(target)) out += ` target="${target}"`;
      const rel = (attributes.get('rel') ?? '')
        .toLowerCase()
        .split(/\s+/)
        .filter((token, index, all) => LINK_RELS.includes(token) && all.indexOf(token) === index);
      if (rel.length > 0) out += ` rel="${rel.join(' ')}"`;
      return out;
    }
    default:
      return null;
  }
}

/** Sanitizes inline rich text. Idempotent. */
export function sanitizeRichText(html: string): string {
  let out = '';
  const open: string[] = [];
  let i = 0;

  while (i < html.length) {
    const char = html[i]!;

    if (char === '<') {
      const rest = html.slice(i);

      if (rest.startsWith('<!--')) {
        const end = rest.indexOf('-->', 4);
        i += end === -1 ? rest.length : end + 3;
        continue;
      }

      const tag = TAG.exec(rest);
      if (!tag) {
        out += '&lt;';
        i += 1;
        continue;
      }
      i += tag[0].length;

      const closing = tag[1] === '/';
      const name = tag[2]!.toLowerCase();

      if (!closing && DROP_WITH_CONTENT.includes(name)) {
        const close = new RegExp(`</${name}\\s*>`, 'i').exec(html.slice(i));
        i = close ? i + close.index + close[0].length : html.length;
        continue;
      }

      if (closing) {
        const index = open.lastIndexOf(name);
        if (index !== -1) {
          while (open.length > index) out += `</${open.pop()}>`;
        }
        continue;
      }

      const attributes = allowedAttributes(name, parseAttributes(tag[3] ?? ''));
      if (attributes === null) continue;
      if (name === 'br') {
        out += '<br>';
      } else {
        out += `<${name}${attributes}>`;
        open.push(name);
      }
      continue;
    }

    if (char === '>') {
      out += '&gt;';
      i += 1;
      continue;
    }

    if (char === '&') {
      const entity = ENTITY.exec(html.slice(i));
      out += entity ? entity[0] : '&amp;';
      i += entity ? entity[0].length : 1;
      continue;
    }

    const next = html.slice(i).search(/[<>&]/);
    const end = next === -1 ? html.length : i + next;
    out += html.slice(i, end);
    i = end;
  }

  while (open.length > 0) out += `</${open.pop()}>`;
  return out;
}

/** True when `html` is already canonical, safe rich text. */
export function isSafeRichText(html: string): boolean {
  return sanitizeRichText(html) === html;
}
