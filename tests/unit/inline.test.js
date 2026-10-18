import { describe, expect, it } from 'vitest';
import { domInlineToMarkdown, inlineToHtml, parseInline, plainInline } from '../../src/lib/inline.js';

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
