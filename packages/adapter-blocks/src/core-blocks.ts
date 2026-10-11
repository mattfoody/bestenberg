import { decodeEntities, escapeAttribute } from '@bestenberg/schema';
import { compact } from './grammar';
import type { ParsedBlock } from './types';

/**
 * The core blocks Bestenberg stores content in. `save` reproduces the block's
 * WordPress `save()` output for the attributes Bestenberg uses (verified in a
 * real editor by tests/e2e/adapter.spec.ts); `extract` reads attributes back
 * from saved HTML and returns null for HTML it does not recognise, so the
 * block is preserved verbatim instead of being misread.
 */
export interface CoreBlockSpec {
  save(
    attributes: Record<string, unknown>,
    inner: string,
  ): {
    comment: Record<string, unknown>;
    html: string;
  };
  extract(parsed: ParsedBlock): Record<string, unknown> | null;
  /** Element that receives utility classes at render time (default: first tag). */
  styleTarget?: string;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const optStr = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

/** Attribute map of a start tag's attribute source, values decoded. */
export function tagAttributes(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of source.matchAll(
    /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
  )) {
    const name = match[1]!.toLowerCase();
    if (!(name in out)) out[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return out;
}

const attr = (name: string, value: string | undefined): string =>
  value === undefined ? '' : ` ${name}="${escapeAttribute(value)}"`;

/** Comment attributes shared by all core blocks Bestenberg writes. */
const meta = (attributes: Record<string, unknown>) => ({ bestenberg: attributes.bestenberg });

const wrapped = (tag: string) => new RegExp(`^<${tag}(?:\\s[^>]*)?>([\\s\\S]*)</${tag}>$`, 'i');

export const CORE_BLOCKS: Record<string, CoreBlockSpec> = {
  'core/heading': {
    save(a) {
      const level = typeof a.level === 'number' ? a.level : 2;
      return {
        comment: { level: level === 2 ? undefined : level, ...meta(a) },
        html: `<h${level} class="wp-block-heading">${str(a.content)}</h${level}>`,
      };
    },
    extract(p) {
      const match = /^<h([1-6])(?:\s[^>]*)?>([\s\S]*)<\/h\1>$/i.exec(p.innerHTML.trim());
      if (!match) return null;
      return {
        ...p.attrs,
        level: typeof p.attrs?.level === 'number' ? p.attrs.level : 2,
        content: match[2],
      };
    },
  },

  'core/paragraph': {
    save: (a) => ({ comment: meta(a), html: `<p>${str(a.content)}</p>` }),
    extract(p) {
      const match = wrapped('p').exec(p.innerHTML.trim());
      return match ? { ...p.attrs, content: match[1] } : null;
    },
  },

  'core/list': {
    save(a, inner) {
      const tag = a.ordered === true ? 'ol' : 'ul';
      return {
        comment: { ordered: a.ordered === true ? true : undefined, ...meta(a) },
        html: `<${tag} class="wp-block-list">${inner}</${tag}>`,
      };
    },
    extract(p) {
      if (!/^<(ul|ol)\b/i.test(p.innerHTML.trim())) return null;
      return { ...p.attrs, ordered: p.attrs?.ordered === true };
    },
  },

  'core/list-item': {
    save: (a, inner) => ({ comment: meta(a), html: `<li>${str(a.content)}${inner}</li>` }),
    extract(p) {
      const first = typeof p.innerContent[0] === 'string' ? p.innerContent[0] : '';
      const open = /^\s*<li(?:\s[^>]*)?>/i.exec(first);
      if (!open) return null;
      let content = first.slice(open[0].length);
      if (p.innerBlocks.length === 0) {
        const close = /<\/li>\s*$/i.exec(content);
        if (!close) return null;
        content = content.slice(0, close.index);
      }
      return { ...p.attrs, content };
    },
  },

  'core/buttons': {
    save: (a, inner) => ({
      comment: meta(a),
      html: `<div class="wp-block-buttons">${inner}</div>`,
    }),
    extract: (p) => (/^<div\b/i.test(p.innerHTML.trim()) ? { ...p.attrs } : null),
  },

  'core/button': {
    styleTarget: '.wp-block-button__link',
    save(a) {
      const className = optStr(a.className);
      const wrapper = ['wp-block-button', ...(className ? [className] : [])].join(' ');
      const link =
        `<a class="wp-block-button__link wp-element-button"` +
        `${attr('href', optStr(a.url))}${attr('target', optStr(a.linkTarget))}${attr('rel', optStr(a.rel))}>` +
        `${str(a.text)}</a>`;
      return {
        comment: { className, ...meta(a) },
        html: `<div class="${escapeAttribute(wrapper)}">${link}</div>`,
      };
    },
    extract(p) {
      const html = p.innerHTML.trim();
      const link = /<a\b([^>]*)>([\s\S]*)<\/a>/i.exec(html);
      if (!/^<div\b/i.test(html) || !link) return null;
      const at = tagAttributes(link[1] ?? '');
      return compact({
        ...p.attrs,
        text: link[2],
        url: at.href,
        linkTarget: at.target,
        rel: at.rel,
      });
    },
  },

  'core/image': {
    styleTarget: 'img',
    save(a) {
      const id = typeof a.id === 'number' ? a.id : undefined;
      const img =
        `<img src="${escapeAttribute(str(a.url))}" alt="${escapeAttribute(str(a.alt))}"` +
        `${id === undefined ? '' : ` class="wp-image-${id}"`}/>`;
      return {
        comment: { id, ...meta(a) },
        html: `<figure class="wp-block-image">${img}</figure>`,
      };
    },
    extract(p) {
      const html = p.innerHTML.trim();
      const img = /<img\b([^>]*?)\/?>/i.exec(html);
      if (!/^<figure\b/i.test(html) || !img) return null;
      const at = tagAttributes(img[1] ?? '');
      return { ...p.attrs, url: at.src ?? '', alt: at.alt ?? '' };
    },
  },

  'core/separator': {
    save: (a) => ({
      comment: meta(a),
      html: '<hr class="wp-block-separator has-alpha-channel-opacity"/>',
    }),
    extract: (p) => (/^<hr\b/i.test(p.innerHTML.trim()) ? { ...p.attrs } : null),
  },

  'core/quote': {
    save(a, inner) {
      const citation = optStr(a.citation);
      return {
        comment: meta(a),
        html:
          `<blockquote class="wp-block-quote">${inner}` +
          `${citation === undefined ? '' : `<cite>${citation}</cite>`}</blockquote>`,
      };
    },
    extract(p) {
      if (!/^<blockquote\b/i.test(p.innerHTML.trim())) return null;
      const cite = /<cite(?:\s[^>]*)?>([\s\S]*?)<\/cite>/i.exec(p.innerHTML);
      return compact({ ...p.attrs, citation: cite?.[1] });
    },
  },
};
