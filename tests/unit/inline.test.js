import { describe, expect, it } from 'vitest';
import {
  domInlineToMarkdown,
  inlineToHtml,
  inlineToTagged,
  parseInline,
  plainInline,
  taggedToInline,
} from '../../src/lib/inline.js';

describe('RF-05 formattazione in linea', () => {
  it('riconosce grassetto, corsivo, codice e link', () => {
    const runs = parseInline('a **b** *c* `d` [e](http://x)');
    expect(runs).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' ' },
      { text: 'c', italic: true },
      { text: ' ' },
      { text: 'd', code: true },
      { text: ' ' },
      { text: 'e', link: 'http://x' },
    ]);
  });

  it('produce testo semplice e HTML', () => {
    expect(plainInline('**a** [b](u)')).toBe('a b');
    expect(inlineToHtml('**a** <x>')).toBe('<strong>a</strong> &lt;x&gt;');
  });

  it('converte HTML in Markdown in linea', () => {
    const div = document.createElement('div');
    div.innerHTML = 'Ciao <strong>mondo </strong><em>bello</em> <a href="http://e.it">link</a>';
    expect(domInlineToMarkdown(div)).toBe('Ciao **mondo** *bello* [link](http://e.it)');
  });
});

describe('RF-05 formattazione in linea come tag per DeepL', () => {
  it('trasforma grassetto, corsivo e link in tag e il codice in tag vuoti', () => {
    const { segment, map } = inlineToTagged('a **b** *c* `x<y` [**e** f](http://u) ![g](i.png) & h');
    expect(segment).toBe('a <1>b</1> <2>c</2> <3/> <4><5>e</5> f</4> <6/> &amp; h');
    expect(map[2]).toEqual({ raw: '`x<y`' });
  });

  it('ricostruisce il Markdown dalla traduzione, anche con i tag spostati', () => {
    const src = 'the **red** [house](http://u) `code`';
    const { map } = inlineToTagged(src);
    expect(taggedToInline('la <2>casa</2> <1>rossa </1><3/>', map)).toBe('la [casa](http://u) **rossa** `code`');
  });

  it('senza tag coerenti restituisce il testo semplice', () => {
    const { map } = inlineToTagged('a **b**');
    expect(taggedToInline('x <2>y</2> &amp;', map)).toBe('x y &');
  });
});
