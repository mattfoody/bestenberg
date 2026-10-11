import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blockComment, compact, parseGrammar, serializeAttributes } from './index';

const repoFile = (path: string) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

describe('serializeAttributes', () => {
  it('escapes anything that could end or confuse an HTML comment', () => {
    expect(serializeAttributes({ a: '--> <b> & "q"' })).toBe(
      '{"a":"\\u002d\\u002d\\u003e \\u003cb\\u003e \\u0026 \\u0022q\\u0022"}',
    );
    expect(JSON.parse(serializeAttributes({ a: '--> <b> & "q"' }))).toEqual({
      a: '--> <b> & "q"',
    });
  });
});

describe('blockComment', () => {
  it('writes core blocks without the namespace and self-closes empty blocks', () => {
    expect(blockComment('core/paragraph', {}, '<p>x</p>')).toBe(
      '<!-- wp:paragraph -->\n<p>x</p>\n<!-- /wp:paragraph -->',
    );
    expect(blockComment('bestenberg/spacer', { bbId: 'a' }, '')).toBe(
      '<!-- wp:bestenberg/spacer {"bbId":"a"} /-->',
    );
  });

  it('drops undefined attributes', () => {
    expect(blockComment('core/heading', { level: undefined }, '<h2>x</h2>')).toBe(
      '<!-- wp:heading -->\n<h2>x</h2>\n<!-- /wp:heading -->',
    );
    expect(compact({ a: 1, b: undefined })).toEqual({ a: 1 });
  });
});

describe('parseGrammar', () => {
  it('parses nested blocks with inner content slots and offsets', () => {
    const source =
      '<!-- wp:quote -->\n<blockquote><!-- wp:paragraph -->\n<p>a</p>\n<!-- /wp:paragraph --><cite>c</cite></blockquote>\n<!-- /wp:quote -->';
    const [quote] = parseGrammar(source);
    expect(quote!.blockName).toBe('core/quote');
    expect(quote!.innerContent).toEqual(['\n<blockquote>', null, '<cite>c</cite></blockquote>\n']);
    expect(quote!.innerHTML).toBe('\n<blockquote><cite>c</cite></blockquote>\n');
    expect(quote!.innerBlocks[0]!.innerHTML).toBe('\n<p>a</p>\n');
    expect(source.slice(quote!.start, quote!.end)).toBe(source);
    const inner = quote!.innerBlocks[0]!;
    expect(source.slice(inner.start, inner.end)).toBe(
      '<!-- wp:paragraph -->\n<p>a</p>\n<!-- /wp:paragraph -->',
    );
  });

  it('parses void blocks, namespaces and attributes', () => {
    const [block] = parseGrammar('<!-- wp:acme/thing {"a":[1,{"b":"}"}]} /-->');
    expect(block).toMatchObject({ blockName: 'acme/thing', attrs: { a: [1, { b: '}' }] } });
    expect(block!.innerContent).toEqual([]);
  });

  it('keeps freeform HTML between blocks', () => {
    const blocks = parseGrammar('<p>before</p><!-- wp:separator /-->after');
    expect(blocks.map((b) => [b.blockName, b.innerHTML])).toEqual([
      [null, '<p>before</p>'],
      ['core/separator', ''],
      [null, 'after'],
    ]);
  });

  it('marks unparseable attribute JSON with null attrs', () => {
    expect(
      parseGrammar('<!-- wp:paragraph {"a": } -->\n<p>x</p>\n<!-- /wp:paragraph -->')[0]!.attrs,
    ).toBeNull();
  });

  it('closes unclosed blocks at the end of the document', () => {
    const [group] = parseGrammar('<!-- wp:group --><div><!-- wp:paragraph --><p>x</p>');
    expect(group!.blockName).toBe('core/group');
    expect(group!.innerBlocks[0]!.innerHTML).toBe('<p>x</p>');
  });

  it('parses the theme templates and the demo page fixture', () => {
    for (const file of [
      'wp/theme/templates/index.html',
      'wp/theme/templates/404.html',
      'wp/theme/parts/header.html',
      'wp/plugin/tests/fixtures/demo-page.html',
    ]) {
      const source = repoFile(file);
      const blocks = parseGrammar(source).filter((b) => b.blockName !== null);
      expect(blocks.length > 0, file).toBe(true);
      for (const block of blocks) {
        const markup = source.slice(block.start, block.end);
        expect(markup.startsWith('<!-- wp:'), file).toBe(true);
        expect(/-->$/.test(markup), file).toBe(true);
      }
    }
  });
});
