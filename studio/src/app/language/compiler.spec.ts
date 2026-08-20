import { describe, expect, it } from 'vitest';
import { compile } from './compiler';

const petProgram = `class Pet {
  pub text name;
  priv num age;

  create(text name, num age) {
    self.name = name;
    self.age = age;
  }

  pub speak() -> void {
    print("Hi, I am " + self.name + "!");
  }
}

let myDog: Pet = new Pet("Buddy", 3);
myDog.speak();
`;

describe('RoseWind compiler', () => {
  it('compiles the Pet example to executable JavaScript', async () => {
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

  it('reports beginner-friendly assignment type errors', () => {
    const result = compile('let score: num = "high";');
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((item) => item.code === 'RW3013')).toBe(true);
    expect(result.diagnostics[0]?.line).toBe(1);
  });

  it('compiles unified loops and match cases', () => {
    const result = compile(`let total: num = 0;
loop item in range(1, 4) { total = total + item; }
match (total) {
  case 6 => { print("six"); }
  default => { print(str(total)); }
}`);
    expect(result.diagnostics).toEqual([]);
    expect(result.javascript).toContain('for (const item of');
    expect(result.javascript).toContain('const __match0');
  });

  it('understands duration, regex, nullable, and collection types', () => {
    const result = compile(`let delay: time = 250ms;
let pattern: regex = r"^[a-z]+$";
let nickname: text? = null;
let values: list<num> = [1, 2, 3];
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
});
