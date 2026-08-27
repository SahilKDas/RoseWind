import { describe, expect, it } from 'vitest';
import { compile } from './compiler';
import { examples } from '../content/examples';
import { beginnerLessons } from '../content/beginner-lessons';

const petProgram = `class(Pet) {
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

describe('RoseWind compiler', () => {
  it('compiles the beginner Pet example to executable JavaScript', async () => {
    const result = compile(petProgram);
    expect(result.diagnostics).toEqual([]);
    expect(result.javascript).toContain('class Pet');
    expect(result.javascript).toContain('constructor(name, age)');

    const output: string[] = [];
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>;
    const execute = new AsyncFunction('print', '__binary', result.javascript);
    const binary = (operator: string, left: any, right: any) => operator === '+' ? left + right : undefined;
    await execute((...values: unknown[]) => output.push(values.join(' ')), binary);
    expect(output).toEqual(['Hi, I am Buddy!']);
  });

  it('keeps inferred variables strongly typed', () => {
    const result = compile('let(score=1);score="high";');
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((item) => item.code === 'RW3013')).toBe(true);
    expect(result.diagnostics[0]?.line).toBe(1);
  });

  it('compiles unified loops and match cases', () => {
    const result = compile(`let(total=0);
loop(item:range(1, 4)) { total = total + item; }
match(total) {
  case(6) { print("six"); }
  default { print(str(total)); }
}`);
    expect(result.diagnostics).toEqual([]);
    expect(result.javascript).toContain('for (const item of');
    expect(result.javascript).toContain('const __match0');
  });

  it('understands duration, regex, nullable, and collection types', () => {
    const result = compile(`let(delay:time=250ms);
let(pattern:regex=r"^[a-z]+$");
let(nickname:text?=null);
let(values:list<num>=[1, 2, 3]);
print(str(len(values)));
`);
    expect(result.diagnostics).toEqual([]);
    expect(result.javascript).toContain('250');
    expect(result.javascript).toContain('new RegExp');
  });

  it('rejects break outside a loop', () => {
    const result = compile('break;');
    expect(result.diagnostics.some((item) => item.code === 'RW3005')).toBe(true);
  });

  it('keeps every starter example and lesson runnable', () => {
    for (const sample of examples) {
      expect(compile(sample.source).diagnostics, sample.name).toEqual([]);
    }
    for (const lesson of beginnerLessons) {
      expect(compile(lesson.code).diagnostics, lesson.title).toEqual([]);
    }
  });
});