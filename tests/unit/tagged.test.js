import { describe, expect, it } from 'vitest';
import { collectIds, escapeText, parseTagged, sameIds, stripTags, unescapeText } from '../../src/lib/tagged.js';

describe('RF-06 codifica a tag numerati della formattazione', () => {
  it('analizza tag annidati e autochiudenti', () => {
    const tree = parseTagged('Ciao <1>bel <2>mondo</2></1><3/>!');
    expect(collectIds(tree)).toEqual([1, 2, 3]);
    expect(tree[0]).toEqual({ type: 'text', text: 'Ciao ' });
    expect(tree[1].children[1].children[0].text).toBe('mondo');
  });

  it('rifiuta stringhe mal formate', () => {
    expect(parseTagged('<1>aperto')).toBeNull();
    expect(parseTagged('<1>a</2>')).toBeNull();
    expect(parseTagged('a</1>')).toBeNull();
  });

  it('esegue escape e unescape in modo simmetrico', () => {
    const s = 'a < b && c > d';
    expect(unescapeText(escapeText(s))).toBe(s);
    expect(parseTagged(escapeText(s))[0].text).toBe(s);
  });

  it('rimuove i tag mantenendo il testo', () => {
    expect(stripTags('<1>x</1> &amp; <2/>y')).toBe('x & y');
  });

  it("confronta insiemi di id indipendentemente dall'ordine", () => {
    expect(sameIds([2, 1], [1, 2])).toBe(true);
    expect(sameIds([1], [1, 1])).toBe(false);
  });
});
