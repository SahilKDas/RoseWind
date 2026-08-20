export interface RunResult {
  readonly output: readonly string[];
  readonly durationMs: number;
  readonly error?: string;
}

export const workerRuntimePrelude = String.raw`
const __format = (value) => {
  if (value instanceof RoseDecimal) return value.toString();
  if (value instanceof Uint8Array) return '[' + [...value].join(', ') + ']';
  if (value instanceof Set) return '{' + [...value].map(__format).join(', ') + '}';
  if (typeof value === 'object' && value !== null) {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
};
const print = (...values) => postMessage({ type: 'output', text: values.map(__format).join(' ') });
const input = async (message = '') => { postMessage({ type: 'output', text: '[input unavailable in runner] ' + message }); return ''; };
const len = (value) => value instanceof Map || value instanceof Set ? value.size : value == null ? 0 : Object.keys(value).length;
const range = (start, end, step = 1) => {
  if (end === undefined) { end = start; start = 0; }
  if (step === 0) throw new Error('range step cannot be zero');
  const values = [];
  if (step > 0) for (let value = start; value < end; value += step) values.push(value);
  else for (let value = start; value > end; value += step) values.push(value);
  return values;
};
const str = (value) => __format(value);
const num = (value) => { const parsed = Number(value); if (Number.isNaN(parsed)) throw new Error('Cannot convert to num: ' + value); return parsed; };
const toJSON = (value) => JSON.stringify(value);
const parseJSON = (value) => JSON.parse(value);
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const web = Object.freeze({ fetch: (...args) => fetch(...args) });
const math = Object.freeze({ random: () => Math.random() });
const typeOf = (value) => value === null ? 'null' : value?.constructor?.name ?? typeof value;
const date = (value) => value === undefined ? new Date() : new Date(value);
const bytes = (value = []) => value instanceof Uint8Array ? value : new Uint8Array(value);
class RoseDecimal {
  constructor(value, coefficient, scale) {
    if (coefficient !== undefined) { this.coefficient = coefficient; this.scale = scale; return; }
    const match = String(value).trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
    if (!match) throw new Error('Invalid decimal: ' + value);
    const fraction = match[3] || '';
    this.coefficient = BigInt((match[1] || '') + match[2] + fraction);
    this.scale = fraction.length;
  }
  static parts(coefficient, scale) { return new RoseDecimal('0', coefficient, scale).normalized(); }
  normalized() {
    let coefficient = this.coefficient;
    let scale = this.scale;
    while (scale > 0 && coefficient % 10n === 0n) { coefficient /= 10n; scale--; }
    this.coefficient = coefficient; this.scale = scale; return this;
  }
  aligned(other) {
    const scale = Math.max(this.scale, other.scale);
    return [this.coefficient * (10n ** BigInt(scale - this.scale)), other.coefficient * (10n ** BigInt(scale - other.scale)), scale];
  }
  add(value) { const other = decimal(value); const [a,b,s] = this.aligned(other); return RoseDecimal.parts(a + b, s); }
  sub(value) { const other = decimal(value); const [a,b,s] = this.aligned(other); return RoseDecimal.parts(a - b, s); }
  mul(value) { const other = decimal(value); return RoseDecimal.parts(this.coefficient * other.coefficient, this.scale + other.scale); }
  div(value) {
    const other = decimal(value); if (other.coefficient === 0n) throw new Error('Division by zero');
    const precision = 18; const exponent = other.scale + precision - this.scale;
    const numerator = exponent >= 0 ? this.coefficient * (10n ** BigInt(exponent)) : this.coefficient;
    const denominator = exponent >= 0 ? other.coefficient : other.coefficient * (10n ** BigInt(-exponent));
    return RoseDecimal.parts(numerator / denominator, precision);
  }
  mod(value) { const other = decimal(value); const [a,b,s] = this.aligned(other); return RoseDecimal.parts(a % b, s); }
  compare(value) { const [a,b] = this.aligned(decimal(value)); return a < b ? -1 : a > b ? 1 : 0; }
  toString() {
    const negative = this.coefficient < 0n; let digits = (negative ? -this.coefficient : this.coefficient).toString();
    if (this.scale) digits = digits.padStart(this.scale + 1, '0').slice(0, -this.scale) + '.' + digits.padStart(this.scale + 1, '0').slice(-this.scale);
    return (negative ? '-' : '') + digits;
  }
  toJSON() { return this.toString(); }
}
const decimal = (value) => value instanceof RoseDecimal ? value : new RoseDecimal(value);
const __binary = (operator, left, right) => {
  if (left instanceof RoseDecimal || right instanceof RoseDecimal) {
    const value = decimal(left);
    if (operator === '+') return value.add(right); if (operator === '-') return value.sub(right);
    if (operator === '*') return value.mul(right); if (operator === '/') return value.div(right); if (operator === '%') return value.mod(right);
    const compared = value.compare(right);
    if (operator === '==') return compared === 0; if (operator === '!=') return compared !== 0;
    if (operator === '<') return compared < 0; if (operator === '<=') return compared <= 0;
    if (operator === '>') return compared > 0; if (operator === '>=') return compared >= 0;
  }
  if (operator === '+') return left + right; if (operator === '-') return left - right;
  if (operator === '*') return left * right; if (operator === '/') return left / right; if (operator === '%') return left % right;
  if (operator === '==') return left === right; if (operator === '!=') return left !== right;
  if (operator === '<') return left < right; if (operator === '<=') return left <= right;
  if (operator === '>') return left > right; if (operator === '>=') return left >= right;
  throw new Error('Unknown binary operator: ' + operator);
};
const id = () => crypto.randomUUID();
const set = (value = []) => value instanceof Set ? value : new Set(value);
`;

export function executeInWorker(javascript: string, timeoutMs = 5_000): Promise<RunResult> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve({ output: [], durationMs: 0, error: 'The RoseWind runner requires a browser Worker.' });
  }
  const source = `${workerRuntimePrelude}\n(async () => {\n${javascript}\n})().then(() => postMessage({ type: 'done' })).catch((error) => postMessage({ type: 'error', text: error?.stack ?? String(error) }));`;
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(url, { name: 'rosewind-runner' });
  const output: string[] = [];
  const started = performance.now();
  return new Promise((resolve) => {
    const finish = (error?: string): void => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ output, durationMs: performance.now() - started, error });
    };
    const timer = setTimeout(() => finish(`Execution stopped after ${timeoutMs}ms.`), timeoutMs);
    worker.onmessage = ({ data }: MessageEvent<{ type: string; text?: string }>) => {
      if (data.type === 'output') output.push(data.text ?? '');
      else if (data.type === 'done') finish();
      else if (data.type === 'error') finish(data.text ?? 'Unknown runtime error.');
    };
    worker.onerror = (event) => finish(event.message);
  });
}
