import { describe, expect, it } from 'vitest';
import { compile } from './compiler';
import { RoseWindLanguageService } from './language-service';
import { WhitespaceNormalizer } from './whitespace-normalizer';

const readable = `/* whitespace inside this comment stays */
class(Pet) {
    name: text;
    priv(age: num);

    create(name: text, age: num) {
        self.name = name;
        self.age = age;
    }

    speak() {
        print("Hi, I am " + self.name + "!");
    }
}

let(myDog = new(Pet, "Buddy", 3));
myDog.speak();
`;

describe('RoseWind v0.3 beginner grammar', () => {
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

  it('supports beginner defaults and advanced explicit forms together', () => {
    const result = compile(`class(Counter){
value:num;
priv(secret:num);
show(){print(self.value);}
pub(double()->num){return(self.value*2);}
}
let(counter=new(Counter));`);
    expect(result.diagnostics).toEqual([]);
    const counter = result.program.declarations[0];
    expect(counter.kind).toBe('ClassDeclaration');
    if (counter.kind !== 'ClassDeclaration') return;
    expect(counter.members.find((member) => member.name === 'value')?.access).toBe('pub');
    const show = counter.members.find((member) => member.name === 'show');
    expect(show?.kind).toBe('MethodDeclaration');
    if (show?.kind === 'MethodDeclaration') expect(show.returnType.name).toBe('void');
  });

  it('maps type diagnostics back to the original spaced document', () => {
    const source = '\n    l e t(score:num="high");';
    const diagnostic = compile(source).diagnostics.find((item) => item.code === 'RW3013');
    expect(diagnostic?.line).toBe(2);
    expect(diagnostic?.column).toBeGreaterThan(4);
    expect(source.slice(diagnostic!.start, diagnostic!.end)).toContain('"high"');
  });

  it('rejects every removed v0.1 boundary form', () => {
    const removed = [
      'class Pet {}',
      'let score: num = 5;',
      'class(Pet){pub text name;}',
      'class(Pet){create(text name){}}',
      'class(Pet){}let(pet=new Pet());',
      'loop item in range(0,3){}',
      'return value;',
      'match(value){case 1 => {}}',
    ];
    for (const source of removed) expect(compile(source).ok, source).toBe(false);
  });

  it('rejects line comments and preserves whitespace in literals and block comments', () => {
    const source = '// old comment\nlet(label="two words");';
    const result = compile(source);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((item) => item.code === 'RW2209')).toBe(true);
    expect(new WhitespaceNormalizer().normalize('/* two words */let(label="two words");').source)
      .toContain('"two words"');
  });

  it('minifies without changing compiled behavior', () => {
    const minified = service.applyEdits(readable, service.minify(readable));
    expect(minified).not.toContain('\n');
    expect(compile(minified).javascript).toBe(compile(readable).javascript);
  });
});