import { Diagnostic, SourceSpan } from './tokens';

export interface NormalizedSource {
  readonly source: string;
  readonly original: string;
  readonly offsets: readonly number[];
  readonly diagnostics: readonly Diagnostic[];
}

/** Removes whitespace outside literals/comments while retaining an exact source map. */
export class WhitespaceNormalizer {
  normalize(original: string): NormalizedSource {
    const output: string[] = [];
    const offsets: number[] = [];
    const diagnostics: Diagnostic[] = [];
    let index = 0;

    const append = (position: number): void => {
      output.push(original[position]!);
      offsets.push(position);
    };

    while (index < original.length) {
      const character = original[index]!;
      const next = original[index + 1] ?? '';

      if (/\s/u.test(character)) { index++; continue; }

      if (character === '/' && next === '*') {
        append(index++); append(index++);
        while (index < original.length) {
          const current = original[index]!;
          append(index++);
          if (current === '*' && original[index] === '/') { append(index++); break; }
        }
        continue;
      }

      if (character === '/' && next === '/') {
        const start = index;
        while (index < original.length && original[index] !== '\n' && original[index] !== '\r') append(index++);
        if (index < original.length) {
          if (original[index] === '\r') append(index++);
          if (original[index] === '\n') append(index++);
        }
        const location = locate(original, start);
        diagnostics.push({
          severity: 'error', code: 'RW2209',
          message: 'RoseWind does not use // comments. Use /* comment */ instead.',
          start, end: index, ...location,
        });
        continue;
      }

      const regexLiteral = character === 'r' && next === '"';
      if (character === '"' || character === "'" || regexLiteral) {
        if (regexLiteral) append(index++);
        const quote = original[index]!;
        append(index++);
        while (index < original.length) {
          const current = original[index]!;
          append(index++);
          if (current === '\\' && index < original.length) append(index++);
          else if (current === quote) break;
        }
        continue;
      }

      append(index++);
    }

    offsets.push(original.length);
    return { source: output.join(''), original, offsets, diagnostics };
  }
}

export function mapNormalizedSpan(input: NormalizedSource, start: number, end: number): SourceSpan {
  const originalStart = input.offsets[Math.min(start, input.offsets.length - 1)] ?? input.original.length;
  const last = end > start ? input.offsets[Math.min(end - 1, input.offsets.length - 2)] ?? originalStart : originalStart - 1;
  const originalEnd = end > start ? Math.min(input.original.length, last + 1) : originalStart;
  return { start: originalStart, end: originalEnd, ...locate(input.original, originalStart) };
}

function locate(source: string, offset: number): Pick<SourceSpan, 'line' | 'column'> {
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < offset; index++) {
    if (source[index] === '\n') { line++; lineStart = index + 1; }
  }
  return { line, column: offset - lineStart + 1 };
}