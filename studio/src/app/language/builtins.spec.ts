import { describe, expect, it } from 'vitest';
import { compile } from './compiler';

describe('RoseWind typed standard-library constructors', () => {
  it('compiles extended JSON values and casts', () => {
    const result = compile(`let(tags:set<text>=set(["typed", "web"]));
let(requestId:id=id());
let(raw:bytes=bytes([1, 2, 3]));
let(price:decimal=decimal("19.99"));
let(created:date=date("2026-08-20"));
let(answer:num=num("42"));
print(str(len(tags)));
`);

    expect(result.diagnostics).toEqual([]);
    expect(result.javascript).toContain('decimal');
    expect(result.javascript).toContain('bytes');
  });
});