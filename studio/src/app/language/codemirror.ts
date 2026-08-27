import {
  Completion,
  CompletionContext,
  CompletionResult,
  snippetCompletion,
} from '@codemirror/autocomplete';
import { HighlightStyle, StreamLanguage, StringStream, syntaxHighlighting } from '@codemirror/language';
import { Diagnostic as EditorDiagnostic, lintGutter, linter } from '@codemirror/lint';
import { Extension } from '@codemirror/state';
import { Command, EditorView, hoverTooltip } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import {
  CompletionSuggestion,
  RoseWindLanguageService,
  roseWindLanguageService,
  TextEdit,
  TextRange,
} from './language-service';

interface RoseWindState {
  blockComment: boolean;
}

const keywords = new Set([
  'class', 'create', 'new', 'pub', 'priv', 'self', 'super', 'if',
  'else', 'loop', 'return', 'break', 'continue', 'match', 'case',
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
    if (stream.match('/*')) { state.blockComment = true; return 'comment'; }
    if (stream.match(/r"(?:[^"\\]|\\.)*"/)) return 'regexp';
    if (stream.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/)) return 'string';
    if (stream.match(/\d+(?:\.\d+)?(?:ms|s|m|h|d)\b/)) return 'number unit';
    if (stream.match(/\d+(?:\.\d+)?\b/)) return 'number';
    if (stream.match(/->|==|!=|<=|>=|&&|\|\||[+\-*\/%=<>!]/)) return 'operator';
    if (stream.match(/[{}()[\],;:.?]/)) return 'punctuation';

    const identifier = stream.match(/[A-Za-z_][A-Za-z0-9_]*/);
    if (identifier) {
      const value = identifier === true ? stream.current() : identifier[0];
      if (keywords.has(value)) return 'keyword';
      if (types.has(value)) return 'typeName';
      if (constants.has(value)) return value === 'null' ? 'null' : 'bool';
      if (stream.match(/(?=\s*\()/, false)) return 'variableName.function';
      if (stream.string.slice(0, stream.start).trimEnd().endsWith('.')) return 'propertyName';
      if (/^[A-Z]/.test(value)) return 'className';
      return 'variableName';
    }

    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { block: { open: '/*', close: '*/' } },
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

const snippetCompletions: readonly Completion[] = [
  snippetCompletion('class(${name}) {\n    value: text;\n\n    create(value: text) {\n        self.value = value;\n    }\n}', {
    label: 'class…', detail: 'Create a beginner-friendly class', type: 'snippet', boost: 10,
  }),
  snippetCompletion('${name}(${parameters}) {\n    /* body */\n}', {
    label: 'method…', detail: 'Create a public method', type: 'snippet', boost: 10,
  }),
  snippetCompletion('loop(${item}:${range(0, 10)}) {\n    /* body */\n}', {
    label: 'loop…', detail: 'Iterate over values', type: 'snippet', boost: 10,
  }),
  snippetCompletion('match(${value}) {\n    case(${pattern}) {\n        /* body */\n    }\n    default {\n        /* fallback */\n    }\n}', {
    label: 'match…', detail: 'Match a value', type: 'snippet', boost: 10,
  }),
];

export function roseWindCompletions(context: CompletionContext): CompletionResult | null {
  const token = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]*)?/);
  if (!token || (token.from === token.to && !context.explicit)) return null;
  const typed = context.state.sliceDoc(token.from, token.to);
  const dot = typed.lastIndexOf('.');
  const from = dot >= 0 ? token.from + dot + 1 : token.from;
  const suggestions = roseWindLanguageService.completions(context.state.doc.toString(), context.pos);
  const options = suggestions.map(toCodeMirrorCompletion);
  if (dot < 0) options.push(...snippetCompletions);
  return {
    from,
    options,
    validFor: /^(?:[A-Za-z_][A-Za-z0-9_]*)?$/,
  };
}

export function roseWindDiagnostics(service: RoseWindLanguageService = roseWindLanguageService): Extension {
  return [
    linter((view): readonly EditorDiagnostic[] => {
      const source = view.state.doc.toString();
      return service.analyze(source).diagnostics.map((item) => ({
        from: Math.min(item.start, view.state.doc.length),
        to: Math.max(Math.min(item.end, view.state.doc.length), Math.min(item.start + 1, view.state.doc.length)),
        severity: item.severity,
        message: `${item.code}: ${item.message}`,
        source: 'RoseWind',
        renderMessage: () => diagnosticMessage(item.message, item.explanation, item.expected, item.actual),
        actions: item.actions.map((action) => ({
          name: `💡 ${action.title}`,
          apply: (activeView: EditorView) => applyTextEdits(activeView, action.edits),
        })),
      }));
    }, { delay: 180 }),
    lintGutter(),
  ];
}

export function roseWindHover(service: RoseWindLanguageService = roseWindLanguageService): Extension {
  return hoverTooltip((view, position) => {
    const hover = service.hover(view.state.doc.toString(), position);
    if (!hover) return null;
    return {
      pos: hover.range.from,
      end: hover.range.to,
      above: true,
      create: () => {
        const dom = document.createElement('div');
        dom.className = 'rw-hover';
        const header = document.createElement('div');
        header.className = 'rw-hover-header';
        const kind = document.createElement('span');
        kind.textContent = hover.kind;
        const title = document.createElement('strong');
        title.textContent = hover.title;
        header.append(kind, title);
        const signature = document.createElement('code');
        signature.textContent = hover.signature;
        const description = document.createElement('p');
        description.textContent = hover.description;
        dom.append(header, signature, description);
        return { dom };
      },
    };
  }, { hoverTime: 180, hideOnChange: true });
}

export function roseWindDefinitionNavigation(service: RoseWindLanguageService = roseWindLanguageService): Extension {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (event.button !== 0 || (!event.ctrlKey && !event.metaKey)) return false;
      const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (position === null || !navigateToDefinition(view, position, service)) return false;
      event.preventDefault();
      return true;
    },
  });
}

export const goToRoseWindDefinition: Command = (view) =>
  navigateToDefinition(view, view.state.selection.main.head, roseWindLanguageService);

export const formatRoseWindDocument: Command = (view) => {
  const edits = roseWindLanguageService.format(view.state.doc.toString());
  if (!edits.length) return true;
  applyTextEdits(view, edits);
  return true;
};

export const formatRoseWindSelection: Command = (view) => {
  const selection = view.state.selection.main;
  const range: TextRange | undefined = selection.empty ? undefined : { from: selection.from, to: selection.to };
  const edits = roseWindLanguageService.format(view.state.doc.toString(), range);
  if (!edits.length) return true;
  applyTextEdits(view, edits);
  return true;
};
export const minifyRoseWindDocument: Command = (view) => {
  const edits = roseWindLanguageService.minify(view.state.doc.toString());
  if (!edits.length) return true;
  applyTextEdits(view, edits);
  return true;
};

function toCodeMirrorCompletion(item: CompletionSuggestion): Completion {
  return {
    label: item.label,
    type: completionType(item.kind),
    detail: item.detail,
    info: item.info,
    apply: item.apply,
    boost: item.boost,
  };
}

function completionType(kind: CompletionSuggestion['kind']): string {
  if (kind === 'builtin') return 'function';
  if (kind === 'field' || kind === 'property') return 'property';
  if (kind === 'method' || kind === 'constructor') return 'method';
  if (kind === 'parameter') return 'variable';
  return kind;
}

function navigateToDefinition(view: EditorView, position: number, service: RoseWindLanguageService): boolean {
  const definition = service.definition(view.state.doc.toString(), position);
  if (!definition) return false;
  view.dispatch({
    selection: { anchor: definition.selectionRange.from, head: definition.selectionRange.to },
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

function applyTextEdits(view: EditorView, edits: readonly TextEdit[]): void {
  const changes = [...edits]
    .sort((left, right) => left.from - right.from)
    .map((edit) => ({ from: edit.from, to: edit.to, insert: edit.insert }));
  view.dispatch({ changes, scrollIntoView: true });
  view.focus();
}

function diagnosticMessage(message: string, explanation: string, expected?: string, actual?: string): HTMLElement {
  const dom = document.createElement('div');
  dom.className = 'rw-diagnostic';
  const summary = document.createElement('strong');
  summary.textContent = message;
  const detail = document.createElement('p');
  detail.textContent = explanation;
  dom.append(summary, detail);
  if (expected || actual) {
    const types = document.createElement('code');
    types.textContent = `${actual ? `actual: ${actual}` : ''}${actual && expected ? ' · ' : ''}${expected ? `expected: ${expected}` : ''}`;
    dom.append(types);
  }
  return dom;
}