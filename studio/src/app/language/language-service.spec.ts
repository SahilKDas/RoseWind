import { describe, expect, it } from 'vitest';
import { RoseWindLanguageService } from './language-service';

const petProgram = `class Pet {
    pub text name;
    priv num age;

    create(text name, num age) {
        self.name = name;
        self.age = age;
    }

    pub speak() -> void {
        let greeting: text = "Hello";
        print(greeting + self.name);
    }
}

let myDog: Pet = new Pet("Buddy", 3);
myDog.speak();
`;

describe('RoseWind language service', () => {
  const service = new RoseWindLanguageService();

  it('returns document symbols with class members and local declarations', () => {
    const symbols = service.symbols(petProgram);
    const pet = symbols.find((item) => item.name === 'Pet');
    expect(pet?.kind).toBe('class');
    expect(pet?.children.map((item) => item.name)).toEqual(['name', 'age', 'create', 'speak']);
    expect(pet?.children.find((item) => item.name === 'speak')?.children.some((item) => item.name === 'greeting')).toBe(true);
  });

  it('explains built-ins and user-defined symbols on hover', () => {
    const printHover = service.hover(petProgram, petProgram.indexOf('print') + 2);
    expect(printHover?.signature).toContain('print(');
    expect(printHover?.description).toContain('output panel');

    const fieldUse = petProgram.lastIndexOf('self.name') + 'self.'.length + 1;
    const fieldHover = service.hover(petProgram, fieldUse);
    expect(fieldHover?.kind).toBe('field');
    expect(fieldHover?.signature).toContain('text name');
  });

  it('resolves method uses to their definitions', () => {
    const use = petProgram.lastIndexOf('speak');
    const definition = service.definition(petProgram, use + 2);
    expect(definition).not.toBeNull();
    expect(petProgram.slice(definition!.selectionRange.from, definition!.selectionRange.to)).toBe('speak');
    expect(definition!.selectionRange.from).toBeLessThan(use);
  });

  it('ranks scoped and member completions ahead of global suggestions', () => {
    const localPosition = petProgram.indexOf('print(greeting') + 'print(greet'.length;
    const local = service.completions(petProgram, localPosition);
    expect(local.find((item) => item.label === 'greeting')!.boost)
      .toBeGreaterThan(local.find((item) => item.label === 'print')!.boost);

    const selfPosition = petProgram.indexOf('self.name') + 'self.'.length;
    const members = service.completions(petProgram, selfPosition);
    expect(members.map((item) => item.label)).toEqual(expect.arrayContaining(['name', 'age', 'speak']));
  });

  it('provides and applies a missing-semicolon quick fix', () => {
    const source = 'let score: num = 42';
    const analysis = service.analyze(source);
    const diagnostic = analysis.diagnostics.find((item) => item.code === 'RW2014')!;
    expect(diagnostic.explanation).toContain('semicolon');
    expect(diagnostic.documentationKey).toBe('diagnostics.rw2014');
    const fixed = service.applyEdits(source, diagnostic.actions[0]!.edits);
    expect(fixed).toBe('let score: num = 42;');
    expect(service.analyze(fixed).result.ok).toBe(true);
  });

  it('offers an unambiguous spelling repair for an unknown name', () => {
    const source = 'let score: num = 42; print(scroe);';
    const diagnostic = service.analyze(source).diagnostics.find((item) => item.code === 'RW3006')!;
    expect(diagnostic.actions[0]?.title).toContain('score');
    const fixed = service.applyEdits(source, diagnostic.actions[0]!.edits);
    expect(fixed).toContain('print(score)');
    expect(service.analyze(fixed).result.ok).toBe(true);
  });

  it('formats documents idempotently while ignoring braces in text', () => {
    const source = 'class Demo {\ncreate() {\nprint("{");\n}\n}\n';
    const first = service.applyEdits(source, service.format(source));
    expect(first).toBe('class(Demo) {\n    create() {\n        print("{");\n    }\n}\n');
    expect(service.format(first)).toEqual([]);
  });

  it('recovers safely from malformed and partially typed source', () => {
    const samples = ['', 'class', 'class Pet { pub', 'let value:', 'match (value) { case'];
    for (const source of samples) {
      expect(() => service.analyze(source)).not.toThrow();
      expect(() => service.completions(source, source.length)).not.toThrow();
      expect(() => service.hover(source, source.length)).not.toThrow();
    }
  });
});
