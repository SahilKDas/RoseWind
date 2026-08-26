import { Diagnostic } from './tokens';

export function usesLegacyGrammar(source: string): boolean {
  const code = maskLiteralsAndComments(source);
  return /\bclass\s+[A-Za-z_]/.test(code)
    || /\blet\s+[A-Za-z_]/.test(code)
    || /\b(?:pub|priv)\s+(?:[A-Za-z_]\w*(?:\s*<[^>]+>)?\??)\s+[A-Za-z_]\w*/.test(code)
    || /\b(?:pub|priv)\s+[A-Za-z_]\w*\s*\(/.test(code)
    || /\bcreate\s*\(\s*(?:[A-Za-z_]\w*(?:\s*<[^>]+>)?\??)\s+[A-Za-z_]/.test(code)
    || /\bnew\s+[A-Za-z_]/.test(code)
    || /\bloop(?!\s*\()/.test(code)
    || /\breturn\s+(?!\()/.test(code)
    || /\bcase\s+(?!\()/.test(code)
    || /\b(?:if|match)(?!\s*\()/.test(code)
    || /\bdefault\s*=>/.test(code);
}

export function legacyGrammarDiagnostics(source: string): readonly Diagnostic[] {
  const rules: readonly [RegExp, string, string][] = [
    [/\bclass\s+[A-Za-z_]/g, 'RW2101', 'v0.2 class names use class(Name).'],
    [/\blet\s+[A-Za-z_]/g, 'RW2110', 'v0.2 variables use let(name:type=value);.'],
    [/\b(?:pub|priv)\s+(?:[A-Za-z_]\w*(?:\s*<[^>]+>)?\??)\s+[A-Za-z_]\w*/g, 'RW2111', 'v0.2 fields use pub(name:type); or priv(name:type);.'],
    [/\b(?:pub|priv)\s+[A-Za-z_]\w*\s*\(/g, 'RW2112', 'v0.2 methods wrap their signature: pub(name(parameters)->type).'],
    [/\bnew\s+[A-Za-z_]/g, 'RW2113', 'v0.2 object creation uses new(Class, arguments).'],
    [/\bloop(?!\s*\()/g, 'RW2114', 'v0.2 loops use loop(item:values), loop(condition), or loop().'],
    [/\breturn\s+(?!\()/g, 'RW2115', 'v0.2 return values use return(value);.'],
    [/\b(?:case(?!\s*\()|default\s*=>)/g, 'RW2116', 'v0.2 match branches use case(value) { ... } or default { ... }.'],
    [/\b(?:if|match)(?!\s*\()/g, 'RW2117', 'v0.2 requires parentheses around if and match conditions.'],
  ];
  const masked = maskLiteralsAndComments(source);
  const diagnostics: Diagnostic[] = [];
  for (const [pattern, code, message] of rules) {
    for (const match of masked.matchAll(pattern)) {
      const start = match.index!;
      const end = start + match[0].length;
      diagnostics.push({ severity: 'warning', code, message, start, end, ...locate(source, start) });
    }
  }
  return diagnostics;
}

/** Best-effort, deterministic v0.1-to-v0.2 source migration used by the IDE. */
export function convertToV02(source: string): string {
  let converted = source.replace(/\/\/([^\r\n]*)/g, (_match, text: string) => `/*${text.trimEnd()} */`);
  const protectedParts: string[] = [];
  converted = converted.replace(/\/\*[\s\S]*?\*\/|r"(?:[^"\\]|\\.)*"|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (value) => {
    const placeholder = `\uE000${protectedParts.length}\uE001`;
    protectedParts.push(value);
    return placeholder;
  });

  converted = converted
    .replace(/\bclass\s+([A-Za-z_]\w*)\s+extends\s+([A-Za-z_]\w*)/g, 'class($1:$2)')
    .replace(/\bclass\s+([A-Za-z_]\w*)/g, 'class($1)')
    .replace(/\blet\s+([A-Za-z_]\w*)(\s*:[^=;\r\n]+)?(\s*=[^;\r\n]+)?\s*;/g,
      (_match, name: string, typePart = '', valuePart = '') => `let(${name}${compactEdge(typePart)}${compactEdge(valuePart)});`)
    .replace(/\b(pub|priv)\s+([A-Za-z_]\w*(?:\s*<[^>]+>)?\??)\s+([A-Za-z_]\w*)\s*;/g,
      (_match, access: string, type: string, name: string) => `${access}(${name}:${compactType(type)});`)
    .replace(/\b(pub|priv)\s+([A-Za-z_]\w*)\s*\(([^()]*)\)\s*->\s*([A-Za-z_]\w*(?:\s*<[^>]+>)?\??)\s*\{/g,
      (_match, access: string, name: string, parameters: string, type: string) =>
        `${access}(${name}(${convertParameters(parameters)})->${compactType(type)}) {`)
    .replace(/\bcreate\s*\(([^()]*)\)\s*\{/g,
      (_match, parameters: string) => `create(${convertParameters(parameters)}) {`)
    .replace(/\bnew\s+([A-Za-z_]\w*)\s*\(\s*\)/g, 'new($1)')
    .replace(/\bnew\s+([A-Za-z_]\w*)\s*\(/g, 'new($1, ')
    .replace(/\bloop\s+([A-Za-z_]\w*)\s+in\s+([^\{\r\n]+)\s*\{/g,
      (_match, name: string, value: string) => `loop(${name}:${value.trim()}) {`)
    .replace(/\bloop\s+([^\{\r\n]+)\s*\{/g, (_match, value: string) => `loop(${value.trim()}) {`)
    .replace(/\bloop\s*\{/g, 'loop() {')
    .replace(/\breturn\s*;/g, 'return();')
    .replace(/\breturn\s+([^;\r\n]+)\s*;/g, (_match, value: string) => `return(${value.trim()});`)
    .replace(/\bcase\s+([^=\{\r\n]+)\s*=>\s*\{/g, (_match, value: string) => `case(${value.trim()}) {`)
    .replace(/\bdefault\s*=>\s*\{/g, 'default {')
    .replace(/\b(if|match)\s+(?!\()([^\{\r\n]+)\s*\{/g,
      (_match, keyword: string, value: string) => `${keyword}(${value.trim()}) {`);

  return converted.replace(/\uE000(\d+)\uE001/g, (_match, index: string) => protectedParts[Number(index)]!);
}

function convertParameters(parameters: string): string {
  return parameters.split(',').map((parameter) => {
    const value = parameter.trim();
    if (!value || value.includes(':')) return value.replace(/\s+/g, '');
    const match = value.match(/^(.+?)\s+([A-Za-z_]\w*)$/);
    return match ? `${match[2]}:${compactType(match[1]!)}` : value;
  }).join(', ');
}

function compactType(value: string): string { return value.replace(/\s+/g, ''); }
function compactEdge(value: string): string { return value.replace(/^\s+|\s+$/g, '').replace(/\s*([:=])\s*/g, '$1'); }

function maskLiteralsAndComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|r"(?:[^"\\]|\\.)*"|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g,
    (value) => ' '.repeat(value.length));
}

function locate(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, offset);
  const line = before.split('\n').length;
  const newline = before.lastIndexOf('\n');
  return { line, column: offset - newline };
}
