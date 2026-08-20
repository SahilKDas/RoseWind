import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compile } from './compiler';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find((item) => !item.startsWith('--'));
  if (!file) {
    console.error('Usage: npm run rosewind -- <file.rw> [--emit]');
    process.exitCode = 2;
    return;
  }

  const absoluteFile = resolve(file);
  const result = compile(await readFile(absoluteFile, 'utf8'));
  if (!result.ok) {
    for (const item of result.diagnostics) {
      console.error(`${absoluteFile}:${item.line}:${item.column} - ${item.code} ${item.message}`);
    }
    process.exitCode = 1;
    return;
  }
  if (args.includes('--emit')) {
    console.log(result.javascript);
    return;
  }

  const format = (value: unknown): string => {
    if (value instanceof RoseDecimal) return value.toString();
    if (value instanceof Uint8Array) return `[${[...value].join(', ')}]`;
    if (value instanceof Set) return `{${[...value].map(format).join(', ')}}`;
    if (typeof value === 'object' && value !== null) {
      try { return JSON.stringify(value); } catch { return String(value); }
    }
    return String(value);
  };
  const print = (...values: unknown[]) => console.log(values.map(format).join(' '));
  const input = async () => '';
  const len = (value: any) => value instanceof Map || value instanceof Set ? value.size : value == null ? 0 : Object.keys(value).length;
  const range = (start: number, end?: number, step = 1) => {
    if (end === undefined) { end = start; start = 0; }
    if (step === 0) throw new Error('range step cannot be zero');
    const values: number[] = [];
    if (step > 0) for (let value = start; value < end; value += step) values.push(value);
    else for (let value = start; value > end; value += step) values.push(value);
    return values;
  };
  const str = format;
  const toNumber = (value: unknown) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) throw new Error(`Cannot convert to num: ${value}`);
    return parsed;
  };
  const wait = (milliseconds: number) => new Promise((done) => setTimeout(done, milliseconds));
  const date = (value?: string | number) => value === undefined ? new Date() : new Date(value);
  const bytes = (value: Iterable<number> = []) => value instanceof Uint8Array ? value : new Uint8Array(value);
  class RoseDecimal {
    coefficient: bigint;
    scale: number;
    constructor(value: unknown, coefficient?: bigint, scale = 0) {
      if (coefficient !== undefined) { this.coefficient = coefficient; this.scale = scale; return; }
      const match = String(value).trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
      if (!match) throw new Error(`Invalid decimal: ${value}`);
      const fraction = match[3] ?? '';
      this.coefficient = BigInt(`${match[1] ?? ''}${match[2]}${fraction}`);
      this.scale = fraction.length;
    }
    static parts(coefficient: bigint, scale: number) { return new RoseDecimal(0, coefficient, scale).normalized(); }
    normalized() { while (this.scale > 0 && this.coefficient % 10n === 0n) { this.coefficient /= 10n; this.scale--; } return this; }
    aligned(other: RoseDecimal): [bigint, bigint, number] { const scale = Math.max(this.scale, other.scale); return [this.coefficient * 10n ** BigInt(scale - this.scale), other.coefficient * 10n ** BigInt(scale - other.scale), scale]; }
    add(value: unknown) { const [a,b,s] = this.aligned(decimal(value)); return RoseDecimal.parts(a + b, s); }
    sub(value: unknown) { const [a,b,s] = this.aligned(decimal(value)); return RoseDecimal.parts(a - b, s); }
    mul(value: unknown) { const other = decimal(value); return RoseDecimal.parts(this.coefficient * other.coefficient, this.scale + other.scale); }
    div(value: unknown) { const other = decimal(value); if (other.coefficient === 0n) throw new Error('Division by zero'); const precision = 18; const exponent = other.scale + precision - this.scale; const numerator = exponent >= 0 ? this.coefficient * 10n ** BigInt(exponent) : this.coefficient; const denominator = exponent >= 0 ? other.coefficient : other.coefficient * 10n ** BigInt(-exponent); return RoseDecimal.parts(numerator / denominator, precision); }
    mod(value: unknown) { const [a,b,s] = this.aligned(decimal(value)); return RoseDecimal.parts(a % b, s); }
    compare(value: unknown) { const [a,b] = this.aligned(decimal(value)); return a < b ? -1 : a > b ? 1 : 0; }
    toString() { const negative = this.coefficient < 0n; let digits = (negative ? -this.coefficient : this.coefficient).toString(); if (this.scale) { const padded = digits.padStart(this.scale + 1, '0'); digits = `${padded.slice(0, -this.scale)}.${padded.slice(-this.scale)}`; } return `${negative ? '-' : ''}${digits}`; }
    toJSON() { return this.toString(); }
  }
  const decimal = (value: unknown): RoseDecimal => value instanceof RoseDecimal ? value : new RoseDecimal(value);
  const binary = (operator: string, left: any, right: any): any => {
    if (left instanceof RoseDecimal || right instanceof RoseDecimal) {
      const value = decimal(left);
      if (operator === '+') return value.add(right); if (operator === '-') return value.sub(right); if (operator === '*') return value.mul(right); if (operator === '/') return value.div(right); if (operator === '%') return value.mod(right);
      const compared = value.compare(right);
      if (operator === '==') return compared === 0; if (operator === '!=') return compared !== 0; if (operator === '<') return compared < 0; if (operator === '<=') return compared <= 0; if (operator === '>') return compared > 0; if (operator === '>=') return compared >= 0;
    }
    if (operator === '+') return left + right; if (operator === '-') return left - right; if (operator === '*') return left * right; if (operator === '/') return left / right; if (operator === '%') return left % right;
    if (operator === '==') return left === right; if (operator === '!=') return left !== right; if (operator === '<') return left < right; if (operator === '<=') return left <= right; if (operator === '>') return left > right; if (operator === '>=') return left >= right;
    throw new Error(`Unknown binary operator: ${operator}`);
  };
  const runtimeNames = ['print', 'input', 'len', 'range', 'str', 'num', 'toJSON', 'parseJSON', 'wait', 'web', 'math', 'typeOf', 'date', 'bytes', 'decimal', 'id', 'set', '__binary'];
  const runtimeValues = [
    print, input, len, range, str, toNumber, JSON.stringify, JSON.parse, wait,
    Object.freeze({ fetch: globalThis.fetch }), Object.freeze({ random: Math.random }),
    (value: any) => value === null ? 'null' : value?.constructor?.name ?? typeof value,
    date, bytes, decimal, () => crypto.randomUUID(),
    (value: Iterable<unknown> = []) => value instanceof Set ? value : new Set(value), binary,
  ];
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...parameters: string[]) => (...values: unknown[]) => Promise<void>;
  await new AsyncFunction(...runtimeNames, result.javascript)(...runtimeValues);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
