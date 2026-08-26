import { describe, expect, it } from 'vitest';
import { compile } from './compiler';
import { RoseWindLanguageService } from './language-service';
import { convertToV02 } from './migration';
import { WhitespaceNormalizer } from './whitespace-normalizer';

const readable = `/* whitespace inside this comment stays */
class(Pet) {
    pub(name:text);
    priv(age:num);

    create(name:text, age:num) {
        self.name = name;
        self.age = age;
    }

    pub(speak()->void) {
        print("Hi, I am " + self.name + "!");
    }
}

let(myDog:Pet = new(Pet, "Buddy", 3));
myDog.speak();
`;

describe('RoseWind v0.2 whitespace-independent grammar', () => {
  const service = new RoseWindLanguageService();

  it('compiles readable, minified, and split-keyword source identically', () => {
    const normalizer = new WhitespaceNormalizer();
    const compact = normalizer.normalize(readable).source;
    const splitKeyword = compact.replace('let(', 'l e t(').replace('class(', 'c l a s s(');
    const results = [readable, compact, splitKeyword].map((source) => compile(source));

    expect(results.every((result) => result.ok)).toBe(true);
    expect(results.map((result) => result.javascript)).toEqual([
      results[0]!.javascript, results[0]!.javascript, results[0]!.javascript,
    ]);
  });

  it('supports every punctuation-first control-flow form', () => {
    const result = compile(`let(total:num=0);
loop(item:range(1,4)){total=total+item;}
if(total==6){print("six");}
match(total){case(6){print("matched");}default{print("other");}}
`);
    expect(result.diagnostics).toEqual([]);
    expect(result.javascript).toContain('for (const item of');
    expect(result.javascript).toContain('const __match0');
  });

  it('maps type diagnostics back to the original spaced document', () => {
    const source = '\n    l e t(score:num="high");';
    const diagnostic = compile(source).diagnostics.find((item) => item.code === 'RW3013');
    expect(diagnostic?.line).toBe(2);
    expect(diagnostic?.column).toBeGreaterThan(4);
    expect(source.slice(diagnostic!.start, diagnostic!.end)).toContain('"high"');
  });

  it('preserves literal/comment whitespace and migrates line comments', () => {
    const source = '// old comment\nlet label: text = "two words";';
    const converted = convertToV02(source);
    expect(converted).toContain('/* old comment */');
    expect(converted).toContain('let(label:text="two words");');
    expect(new WhitespaceNormalizer().normalize(converted).source).toContain('"two words"');
  });

  it('accepts v0.1 for one release and offers a whole-document migration', () => {
    const legacy = 'class Pet { pub text name; create(text name) { self.name = name; } }';
    expect(compile(legacy).diagnostics).toEqual([]);
    const analysis = service.analyze(legacy);
    expect(analysis.diagnostics.some((item) => item.code === 'RW2101')).toBe(true);
    const action = analysis.diagnostics.find((item) => item.code === 'RW2101')!.actions[0]!;
    const migrated = service.applyEdits(legacy, action.edits);
    expect(migrated).toContain('class(Pet)');
    expect(service.analyze(migrated).result.ok).toBe(true);
  });

  it('minifies v0.2 without changing compiled behavior', () => {
    const minified = service.applyEdits(readable, service.minify(readable));
    expect(minified).not.toContain('\n');
    expect(compile(minified).javascript).toBe(compile(readable).javascript);
  });
});
