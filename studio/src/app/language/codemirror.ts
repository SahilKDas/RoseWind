import {
  Completion,
  CompletionContext,
  CompletionResult,
  snippetCompletion,
} from '@codemirror/autocomplete';
import { HighlightStyle, StreamLanguage, StringStream, syntaxHighlighting } from '@codemirror/language';
import { Diagnostic as EditorDiagnostic, linter } from '@codemirror/lint';
import { Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';
import { compile } from './compiler';

interface RoseWindState {
  blockComment: boolean;
}

const keywords = new Set([
  'class', 'create', 'extends', 'new', 'pub', 'priv', 'self', 'super', 'if',
  'else', 'loop', 'in', 'return', 'break', 'continue', 'match', 'case',
  'default', 'try', 'catch', 'let',
]);

const types = new Set([
  'text', 'num', 'bool', 'list', 'dict', 'void', 'any', 'date', 'time',
  'bytes', 'decimal', 'id', 'set', 'regex',
]);

const constants = new Set(['true', 'false', 'null']);

export const roseWindLanguage = StreamLanguage.define<RoseWindState>({
  name: 'rosewind',
  startState: () => ({ blockComment: false }),
  token(stream: StringStream, state: RoseWindState): string | null {
    if (state.blockComment) {
      if (stream.skipTo('*/')) {
        stream.match('*/');
        state.blockComment = false;
      } else {
        stream.skipToEnd();
      }
      return 'comment';
    }

    if (stream.eatSpace()) return null;
    if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match('/*')) { state.blockComment = true; return 'comment'; }
    if (stream.match(/r"(?:[^"\\]|\\.)*"/)) return 'regexp';
    if (stream.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/)) return 'string';
    if (stream.match(/\d+(?:\.\d+)?(?:ms|s|m|h|d)\b/)) return 'number unit';
    if (stream.match(/\d+(?:\.\d+)?\b/)) return 'number';
    if (stream.match(/->|=>|==|!=|<=|>=|&&|\|\||[+\-*\/%=<>!]/)) return 'operator';
    if (stream.match(/[{}()[\],;:.?]/)) return 'punctuation';

    const identifier = stream.match(/[A-Za-z_][A-Za-z0-9_]*/);
    if (identifier) {
      const value = identifier === true ? stream.current() : identifier[0];
      if (keywords.has(value)) return 'keyword';
      if (types.has(value)) return 'typeName';
      if (constants.has(value)) return value === 'null' ? 'null' : 'bool';
      if (stream.match(/(?=\s*\()/, false)) return 'function(variableName)';
      if (stream.string.slice(0, stream.start).trimEnd().endsWith('.')) return 'propertyName';
      if (/^[A-Z]/.test(value)) return 'className';
      return 'variableName';
    }

    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    closeBrackets: { brackets: ['(', '[', '{', '"', "'"] },
    indentOnInput: /^\s*[}\]]$/,
  },
});

export const roseWindHighlighting = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, color: '#eb8faf', fontWeight: '600' },
  { tag: tags.typeName, color: '#75d0bf' },
  { tag: tags.className, color: '#7fd3c4', fontWeight: '600' },
  { tag: tags.function(tags.variableName), color: '#86b7e8' },
  { tag: tags.propertyName, color: '#d8bd78' },
  { tag: tags.variableName, color: '#d7d1cc' },
  { tag: [tags.string, tags.regexp], color: '#9bd27d' },
  { tag: [tags.number, tags.bool, tags.null], color: '#c2a3ee' },
  { tag: tags.operator, color: '#e89a6c' },
  { tag: tags.punctuation, color: '#8d8782' },
  { tag: tags.comment, color: '#6f6965', fontStyle: 'italic' },
]));

const staticCompletions: readonly Completion[] = [
  ...['class', 'extends', 'new', 'pub', 'priv', 'self', 'super', 'if', 'else',
    'loop', 'in', 'return', 'break', 'continue', 'match', 'case', 'default',
    'try', 'catch', 'let', 'true', 'false', 'null'].map((label) => ({ label, type: 'keyword' })),
  ...[...types].map((label) => ({ label, type: 'type', detail: 'RoseWind type' })),
  ...[
    ['print', 'print(value)', 'Write to the output panel'],
    ['input', 'input(prompt)', 'Read interactive input'],
    ['len', 'len(value)', 'Return collection or text length'],
    ['range', 'range(start, end, step)', 'Generate a number sequence'],
    ['str', 'str(value)', 'Convert a value to text'],
    ['num', 'num(value)', 'Convert a value to a number'],
    ['toJSON', 'toJSON(value)', 'Serialize a value as JSON'],
    ['parseJSON', 'parseJSON(text)', 'Parse JSON text'],
    ['wait', 'wait(duration)', 'Pause asynchronously'],
    ['web.fetch', 'web.fetch(url)', 'Fetch a web resource'],
    ['math.random', 'math.random()', 'Generate a random number'],
    ['typeOf', 'typeOf(value)', 'Inspect a runtime type'],
  ].map(([label, apply, info]) => ({ label, apply, info, type: 'function' })),
  snippetCompletion('class ${name} {\n    pub text name;\n\n    create(text name) {\n        self.name = name;\n    }\n}', {
    label: 'class…', detail: 'Create a class', type: 'snippet',
  }),
  snippetCompletion('pub ${name}(${parameters}) -> ${void} {\n    ${// body}\n}', {
    label: 'method…', detail: 'Create a typed method', type: 'snippet',
  }),
  snippetCompletion('loop ${item} in ${range(0, 10)} {\n    ${// body}\n}', {
    label: 'loop…', detail: 'Iterate over values', type: 'snippet',
  }),
  snippetCompletion('match (${value}) {\n    case ${pattern} => {\n        ${// body}\n    }\n    default => {\n        ${// fallback}\n    }\n}', {
    label: 'match…', detail: 'Match a value', type: 'snippet',
  }),
];

function discoveredCompletions(source: string): Completion[] {
  const found = new Map<string, Completion>();
  for (const match of source.matchAll(/\bclass\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
    found.set(match[1]!, { label: match[1]!, type: 'class', detail: 'Class in this file' });
  }
  for (const match of source.matchAll(/\b(?:pub|priv)\s+(?:[A-Za-z_][\w<>?, ]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?=[;(])/g)) {
    found.set(match[1]!, { label: match[1]!, type: 'property', detail: 'Class member' });
  }
  for (const match of source.matchAll(/\blet\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
    found.set(match[1]!, { label: match[1]!, type: 'variable', detail: 'Variable in this file' });
  }
  return [...found.values()];
}

export function roseWindCompletions(context: CompletionContext): CompletionResult | null {
  const token = context.matchBefore(/[A-Za-z_][A-Za-z0-9_.]*/);
  if (!token || (token.from === token.to && !context.explicit)) return null;
  const typed = context.state.sliceDoc(token.from, token.to);
  const dot = typed.lastIndexOf('.');
  return {
    from: dot >= 0 ? token.from + dot + 1 : token.from,
    options: [...staticCompletions, ...discoveredCompletions(context.state.doc.toString())],
    validFor: /^[A-Za-z_][A-Za-z0-9_]*$/,
  };
}

export function roseWindDiagnostics(): Extension {
  return linter((view): readonly EditorDiagnostic[] => compile(view.state.doc.toString()).diagnostics.map((item) => ({
    from: Math.min(item.start, view.state.doc.length),
    to: Math.max(Math.min(item.end, view.state.doc.length), Math.min(item.start + 1, view.state.doc.length)),
    severity: item.severity,
    message: `${item.code}: ${item.message}`,
    source: 'RoseWind',
  })), { delay: 180 });
}
