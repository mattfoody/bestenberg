import { describe, expect, it } from 'vitest';
import {
  decodeEntities,
  escapeAttribute,
  isSafeRichText,
  isSafeUrl,
  sanitizeRichText,
} from './index';

describe('sanitizeRichText', () => {
  it.each([
    ['plain text', 'plain text'],
    ['<strong>bold</strong> and <em>it</em>', '<strong>bold</strong> and <em>it</em>'],
    ['<STRONG>Up</STRONG>', '<strong>Up</strong>'],
    ['line<br/>break<br />x<br>', 'line<br>break<br>x<br>'],
    ['<span class="bb-hl foo">x</span>', '<span class="bb-hl">x</span>'],
    ['<span class="foo">x</span>', 'x'],
    [
      '<a href="/p" target="_blank" rel="noopener evil" onclick="x()">l</a>',
      '<a href="/p" target="_blank" rel="noopener">l</a>',
    ],
    ['<a href="https://x.test/?a=1&amp;b=2">l</a>', '<a href="https://x.test/?a=1&amp;b=2">l</a>'],
    ['<a href="https://x.test/?a=1&b=2">l</a>', '<a href="https://x.test/?a=1&amp;b=2">l</a>'],
    ['Tom & Jerry &amp; &nbsp; &#169; &#xA9;', 'Tom &amp; Jerry &amp; &nbsp; &#169; &#xA9;'],
    ['1 < 2 > 0', '1 &lt; 2 &gt; 0'],
    ['"quoted" \'single\'', '"quoted" \'single\''],
    ['<strong><em>x</strong>y</em>', '<strong><em>x</em></strong>y'],
    ['<strong>unclosed', '<strong>unclosed</strong>'],
    ['stray</em> close', 'stray close'],
    ['<p>para</p><div>div</div>', 'paradiv'],
    ['a<!-- comment -->b', 'ab'],
  ])('%s', (input, expected) => {
    expect(sanitizeRichText(input)).toBe(expected);
  });

  it.each([
    '<script>alert(1)</script>',
    '<SCRIPT SRC=//x.test/x.js></SCRIPT>',
    '<img src=x onerror=alert(1)>',
    '<svg/onload=alert(1)>',
    '<svg><script>alert(1)</script></svg>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href="java&#115;cript:alert(1)">x</a>',
    '<a href="java&#x73;cript:alert(1)">x</a>',
    '<a href="javascript&colon;alert(1)">x</a>',
    '<a href=" &#14; javascript:alert(1)">x</a>',
    '<a href="jav\tascript:alert(1)">x</a>',
    '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
    '<a href="vbscript:msgbox(1)">x</a>',
    '<span class="bb-x" onmouseover="alert(1)" style="x:expression(alert(1))">x</span>',
    '<scr<script>ipt>alert(1)</script>',
    '<<script>alert(1)//<</script>',
    '<a href="/ok" onclick="alert(1)">x</a>',
    '<style>*{background:url(javascript:alert(1))}</style>',
    '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
    '<a href="x" "onfocus"=alert(1) autofocus>x</a>',
    '"><img src=x onerror=alert(1)>',
  ])('neutralizes %s', (payload) => {
    const out = sanitizeRichText(payload);
    expect(out).not.toMatch(/<(?!\/?(strong|em|a|br|span)\b)/i);
    expect(out).not.toMatch(/\son[a-z]+\s*=/i);
    expect(out).not.toMatch(/javascript:|vbscript:|data:/i);
    expect(out).not.toMatch(/style=/i);
    expect(sanitizeRichText(out)).toBe(out);
  });

  it('is idempotent on tricky input', () => {
    const samples = [
      '<a href="/a&amp;b">x</a><br><span class="bb-a bb-b">y</span>',
      '&&amp;&lt;<<>><strong>',
      '<a>no href</a> <em><strong>nest</strong></em>',
      'end with &',
    ];
    for (const sample of samples) {
      const once = sanitizeRichText(sample);
      expect(sanitizeRichText(once)).toBe(once);
      expect(isSafeRichText(once)).toBe(true);
    }
  });

  it('flags non-canonical input', () => {
    expect(isSafeRichText('Tom & Jerry')).toBe(false);
    expect(isSafeRichText('Tom &amp; Jerry')).toBe(true);
  });
});

describe('isSafeUrl', () => {
  it.each([
    'https://example.com/a?b=1',
    'http://example.com',
    'mailto:a@example.com',
    'tel:+385123',
    '/relative/path',
    './x',
    '../x',
    '#anchor',
    '?q=1',
    'page.html',
    '//cdn.example.com/x.png',
  ])('allows %s', (url) => {
    expect(isSafeUrl(url)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'java\nscript:alert(1)',
    'java&#115;cript:alert(1)',
    'javascript&colon;alert(1)',
    'data:text/html,x',
    'vbscript:x',
    'file:///etc/passwd',
    '',
    '   ',
    '/x"onmouseover="alert(1)',
    '/<script>',
  ])('rejects %j', (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });
});

describe('entity helpers', () => {
  it('decodes numeric and common named entities', () => {
    expect(decodeEntities('&lt;a&gt; &amp; &#65;&#x42; &quot;&unknown;')).toBe(
      '<a> & AB "&unknown;',
    );
  });

  it('escapes attribute values without double-escaping entities', () => {
    expect(escapeAttribute('a "b" <c> & &amp; &#1;')).toBe(
      'a &quot;b&quot; &lt;c&gt; &amp; &amp; &#1;',
    );
  });
});
