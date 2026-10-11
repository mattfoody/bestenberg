import type { ParsedBlock } from './types';

/**
 * Block comment delimiter grammar. Mirrors @wordpress/blocks `serialize`
 * (comment format, attribute escaping) and
 * @wordpress/block-serialization-default-parser (tokenizer and tree building),
 * so markup round-trips with WordPress itself.
 */

/** Same token as WordPress' default parser. */
const TOKEN =
  /<!--\s+(\/)?wp:([a-z][a-z0-9_-]*\/)?([a-z][a-z0-9_-]*)\s+({(?:(?=([^}]+|}+(?=})|(?!}\s+\/?-->)[^])*)\5|[^]*?)}\s+)?(\/)?-->/g;

/** JSON for a block comment, escaped so it can never close the comment. */
export function serializeAttributes(attributes: Record<string, unknown>): string {
  return JSON.stringify(attributes)
    .replace(/--/g, '\\u002d\\u002d')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\\"/g, '\\u0022');
}

/** Drops keys whose value is undefined. */
export function compact<T extends Record<string, unknown>>(record: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

/** `<!-- wp:name {attrs} -->\ncontent\n<!-- /wp:name -->`, self-closing when empty. */
export function blockComment(
  name: string,
  attributes: Record<string, unknown>,
  content: string,
): string {
  const attrs = compact(attributes);
  const serialized = Object.keys(attrs).length > 0 ? `${serializeAttributes(attrs)} ` : '';
  const short = name.startsWith('core/') ? name.slice(5) : name;
  if (!content) return `<!-- wp:${short} ${serialized}/-->`;
  return `<!-- wp:${short} ${serialized}-->\n${content}\n<!-- /wp:${short} -->`;
}

type Token =
  | { type: 'none' }
  | {
      type: 'opener' | 'closer' | 'void';
      name: string;
      attrs: Record<string, unknown> | null;
      start: number;
      length: number;
    };

interface Frame {
  block: ParsedBlock;
  tokenStart: number;
  tokenLength: number;
  prevOffset: number;
  leadingHtmlStart: number | null;
}

function parseJson(source: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(source);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function nextToken(document: string, offset: number): Token {
  TOKEN.lastIndex = offset;
  const match = TOKEN.exec(document);
  if (!match) return { type: 'none' };

  const [whole, closer, namespace, name, attrsJson, , voidSlash] = match;
  const attrs = attrsJson ? parseJson(attrsJson) : {};
  const common = {
    name: `${namespace ?? 'core/'}${name}`,
    attrs,
    start: match.index,
    length: whole.length,
  };
  if (voidSlash) return { type: 'void', ...common };
  if (closer) return { type: 'closer', ...common };
  return { type: 'opener', ...common };
}

function block(
  blockName: string | null,
  attrs: Record<string, unknown> | null,
  start: number,
  end: number,
  html = '',
): ParsedBlock {
  return {
    blockName,
    attrs,
    innerBlocks: [],
    innerHTML: html,
    innerContent: html ? [html] : [],
    start,
    end,
  };
}

/** Parses block markup into a tree (WordPress default-parser semantics). */
export function parseGrammar(document: string): ParsedBlock[] {
  const output: ParsedBlock[] = [];
  const stack: Frame[] = [];
  let offset = 0;

  const freeform = (start: number, end: number) => {
    if (end <= start) return;
    output.push(block(null, {}, start, end, document.slice(start, end)));
  };

  const addInnerBlock = (child: ParsedBlock, tokenStart: number, lastOffset: number) => {
    const parent = stack[stack.length - 1]!;
    parent.block.innerBlocks.push(child);
    const html = document.slice(parent.prevOffset, tokenStart);
    if (html) {
      parent.block.innerHTML += html;
      parent.block.innerContent.push(html);
    }
    parent.block.innerContent.push(null);
    parent.prevOffset = lastOffset;
  };

  const addBlockFromStack = (endOffset?: number) => {
    const frame = stack.pop()!;
    const end = endOffset ?? document.length;
    const html = document.slice(frame.prevOffset, end);
    if (html) {
      frame.block.innerHTML += html;
      frame.block.innerContent.push(html);
    }
    if (frame.leadingHtmlStart !== null) freeform(frame.leadingHtmlStart, frame.tokenStart);
    output.push(frame.block);
  };

  for (;;) {
    const token = nextToken(document, offset);
    const depth = stack.length;

    if (token.type === 'none') {
      if (depth === 0) {
        freeform(offset, document.length);
      } else {
        // Unclosed blocks: close everything with the rest of the document.
        while (stack.length > 1) {
          const frame = stack.pop()!;
          frame.block.end = document.length;
          const html = document.slice(frame.prevOffset);
          if (html) {
            frame.block.innerHTML += html;
            frame.block.innerContent.push(html);
          }
          const parent = stack[stack.length - 1]!;
          parent.block.innerBlocks.push(frame.block);
          parent.block.innerContent.push(null);
          parent.prevOffset = document.length;
        }
        stack[0]!.block.end = document.length;
        addBlockFromStack();
      }
      break;
    }

    const end = token.start + token.length;

    if (token.type === 'void') {
      const voidBlock = block(token.name, token.attrs, token.start, end);
      if (depth === 0) {
        freeform(offset, token.start);
        output.push(voidBlock);
      } else {
        addInnerBlock(voidBlock, token.start, end);
      }
      offset = end;
      continue;
    }

    if (token.type === 'opener') {
      stack.push({
        block: block(token.name, token.attrs, token.start, end),
        tokenStart: token.start,
        tokenLength: token.length,
        prevOffset: end,
        leadingHtmlStart: depth === 0 && token.start > offset ? offset : null,
      });
      offset = end;
      continue;
    }

    // Closer.
    if (depth === 0) {
      // Unexpected closer: treat the rest as freeform HTML.
      freeform(offset, document.length);
      break;
    }

    if (depth === 1) {
      stack[0]!.block.end = end;
      addBlockFromStack(token.start);
      offset = end;
      continue;
    }

    const frame = stack.pop()!;
    const html = document.slice(frame.prevOffset, token.start);
    if (html) {
      frame.block.innerHTML += html;
      frame.block.innerContent.push(html);
    }
    frame.block.end = end;
    addInnerBlock(frame.block, frame.tokenStart, end);
    offset = end;
  }

  return output;
}
