import {
  BlockStatement,
  ClassDeclaration,
  Expression,
  MethodDeclaration,
  Program,
  Statement,
  TypeNode,
  VariableDeclaration,
} from './ast';
import { compile, CompileResult } from './compiler';
import { Diagnostic, SourceSpan } from './tokens';
import { convertToV02 } from './migration';
import { WhitespaceNormalizer } from './whitespace-normalizer';

export interface TextRange {
  readonly from: number;
  readonly to: number;
}

export interface TextEdit extends TextRange {
  readonly insert: string;
}

export type RoseWindSymbolKind =
  | 'class' | 'field' | 'method' | 'constructor' | 'variable' | 'parameter';

export interface DocumentSymbol {
  readonly name: string;
  readonly kind: RoseWindSymbolKind;
  readonly detail: string;
  readonly range: TextRange;
  readonly selectionRange: TextRange;
  readonly children: readonly DocumentSymbol[];
  readonly containerName?: string;
  readonly visibility?: 'pub' | 'priv';
  readonly type?: string;
}

export interface HoverInfo {
  readonly range: TextRange;
  readonly kind: RoseWindSymbolKind | 'keyword' | 'type' | 'builtin';
  readonly title: string;
  readonly signature: string;
  readonly description: string;
  readonly documentationKey: string;
}

export interface DefinitionLocation {
  readonly name: string;
  readonly range: TextRange;
  readonly selectionRange: TextRange;
}

export interface CompletionSuggestion {
  readonly label: string;
  readonly kind: RoseWindSymbolKind | 'keyword' | 'type' | 'builtin' | 'property';
  readonly detail: string;
  readonly info: string;
  readonly apply?: string;
  readonly boost: number;
}

export interface CodeAction {
  readonly id: string;
  readonly title: string;
  readonly kind: 'quickfix' | 'format';
  readonly diagnosticCode?: string;
  readonly edits: readonly TextEdit[];
  readonly preferred: boolean;
}

export interface LanguageDiagnostic extends Diagnostic {
  readonly id: string;
  readonly explanation: string;
  readonly likelyCause?: string;
  readonly expected?: string;
  readonly actual?: string;
  readonly documentationKey: string;
  readonly actions: readonly CodeAction[];
}

export interface LanguageAnalysis {
  readonly result: CompileResult;
  readonly diagnostics: readonly LanguageDiagnostic[];
  readonly symbols: readonly DocumentSymbol[];
}

interface CatalogItem {
  readonly label: string;
  readonly signature: string;
  readonly description: string;
  readonly kind: 'keyword' | 'type' | 'builtin';
  readonly apply?: string;
}

interface SymbolEntry {
  readonly symbol: DocumentSymbol;
  readonly scope: TextRange;
  readonly className?: string;
}

const keywordDescriptions: Readonly<Record<string, string>> = {
  class: 'Declares a reusable object blueprint with fields and methods.',
  create: 'Declares the constructor that initializes a new class instance.',
  extends: 'Makes a class inherit accessible behavior from another class.',
  new: 'Creates an instance and calls its create constructor.',
  pub: 'Allows a class member to be used outside its class.',
  priv: 'Restricts a class member to code inside its class.',
  self: 'Refers to the current object inside one of its methods.',
  super: 'Refers to the parent class implementation.',
  let: 'Declares a typed or inferred variable.',
  if: 'Runs a block only when its condition is true.',
  else: 'Runs an alternative block when an if condition is false.',
  loop: 'Repeats a block over values, while a condition is true, or forever.',
  in: 'Connects a loop variable to the values it iterates over.',
  return: 'Leaves a method and optionally returns a typed value.',
  break: 'Stops the nearest loop.',
  continue: 'Skips directly to the next loop iteration.',
  match: 'Chooses a branch by comparing one value with case values.',
  case: 'Declares one value handled by a match statement.',
  default: 'Declares the fallback branch of a match statement.',
  try: 'Runs code whose runtime errors should be handled.',
  catch: 'Handles an error raised by a matching try block.',
  true: 'The boolean value representing yes or on.',
  false: 'The boolean value representing no or off.',
  null: 'Represents a deliberately missing nullable value.',
};

const keywordSignatures: Readonly<Record<string, string>> = {
  class: 'class(Name[:Parent]) { ... }',
  create: 'create(name:type, ...) { ... }',
  new: 'new(Class, ...arguments)',
  pub: 'pub(name:type); or pub(method(...)->type)',
  priv: 'priv(name:type); or priv(method(...)->type)',
  let: 'let(name:type=value);',
  if: 'if(condition) { ... }',
  loop: 'loop(item:values) { ... }',
  return: 'return(value);',
  match: 'match(value) { ... }',
  case: 'case(value) { ... }',
};
const typeDescriptions: Readonly<Record<string, string>> = {
  text: 'UTF-8 text such as names, messages, and JSON.',
  num: 'A double-precision number for general calculations.',
  bool: 'A logical true or false value.',
  list: 'An ordered, dynamically sized collection: list<T>.',
  dict: 'A key-value collection: dict<K, V>.',
  void: 'Indicates that a method does not return a value.',
  any: 'Opts out of static checking for one value. Prefer a specific type when possible.',
  date: 'A high-level date and time value.',
  time: 'An exact duration written with units such as 250ms or 2s.',
  bytes: 'Raw binary data used by files, media, and web APIs.',
  decimal: 'Fixed-point decimal arithmetic for exact money-like values.',
  id: 'A generated UUID identifier.',
  set: 'An unordered collection of unique values: set<T>.',
  regex: 'A regular-expression pattern written as r"pattern".',
};

const builtinCatalog: readonly CatalogItem[] = [
  { label: 'print', signature: 'print(...values) -> void', description: 'Writes values to the output panel.', kind: 'builtin', apply: 'print()' },
  { label: 'input', signature: 'input(prompt) -> text', description: 'Reads text input from the user.', kind: 'builtin', apply: 'input()' },
  { label: 'len', signature: 'len(value) -> num', description: 'Returns the length of text or a collection.', kind: 'builtin', apply: 'len()' },
  { label: 'range', signature: 'range(start, end, step) -> list<num>', description: 'Creates a sequence of numbers.', kind: 'builtin', apply: 'range(0, 10)' },
  { label: 'str', signature: 'str(value) -> text', description: 'Converts a primitive or object to text.', kind: 'builtin', apply: 'str()' },
  { label: 'num', signature: 'num(value) -> num', description: 'Safely converts text or another value to a number.', kind: 'builtin', apply: 'num()' },
  { label: 'toJSON', signature: 'toJSON(value) -> text', description: 'Serializes a value as JSON text.', kind: 'builtin', apply: 'toJSON()' },
  { label: 'parseJSON', signature: 'parseJSON(value) -> any', description: 'Parses JSON text into RoseWind data.', kind: 'builtin', apply: 'parseJSON()' },
  { label: 'wait', signature: 'wait(duration) -> void', description: 'Pauses asynchronously without blocking the page.', kind: 'builtin', apply: 'wait(1s)' },
  { label: 'typeOf', signature: 'typeOf(value) -> text', description: 'Returns the runtime type name of a value.', kind: 'builtin', apply: 'typeOf()' },
  { label: 'date', signature: 'date(value) -> date', description: 'Creates a date value.', kind: 'builtin', apply: 'date()' },
  { label: 'bytes', signature: 'bytes(value) -> bytes', description: 'Creates binary data.', kind: 'builtin', apply: 'bytes()' },
  { label: 'decimal', signature: 'decimal(value) -> decimal', description: 'Creates an exact fixed-point decimal.', kind: 'builtin', apply: 'decimal()' },
  { label: 'id', signature: 'id() -> id', description: 'Creates a unique UUID identifier.', kind: 'builtin', apply: 'id()' },
  { label: 'set', signature: 'set(values) -> set<any>', description: 'Creates a collection containing unique values.', kind: 'builtin', apply: 'set([])' },
];

const memberCatalog: Readonly<Record<string, readonly CatalogItem[]>> = {
  web: [{ label: 'fetch', signature: 'web.fetch(url) -> any', description: 'Fetches data from a web URL.', kind: 'builtin', apply: 'fetch()' }],
  math: [{ label: 'random', signature: 'math.random() -> num', description: 'Returns a random number from 0 up to 1.', kind: 'builtin', apply: 'random()' }],
};

const catalog: readonly CatalogItem[] = [
  ...Object.entries(keywordDescriptions).map(([label, description]) => ({ label, signature: keywordSignatures[label] ?? label, description, kind: 'keyword' as const })),
  ...Object.entries(typeDescriptions).map(([label, description]) => ({ label, signature: label, description, kind: 'type' as const })),
  ...builtinCatalog,
];

const diagnosticExplanations: Readonly<Record<string, { explanation: string; cause?: string }>> = {
  RW1000: { explanation: 'RoseWind found a character that is not part of its syntax.', cause: 'The character may have been pasted from formatted text or typed accidentally.' },
  RW1001: { explanation: 'A block comment began with /* but never reached */.', cause: 'Add the closing */ after the comment text.' },
  RW1002: { explanation: 'A quoted value reaches the end of the file before its closing quote.', cause: 'A matching quote is probably missing.' },
  RW1003: { explanation: 'Duration values only accept ms, s, m, h, or d units.', cause: 'The suffix after the number is not a supported time unit.' },
  RW2101: { explanation: 'Whitespace-independent class headers put the name inside punctuation.', cause: 'This file still uses the v0.1 class header.' },
  RW2109: { explanation: 'Line comments depend on a newline, so v0.2 uses block comments instead.', cause: 'Convert // text to /* text */.' },
  RW2110: { explanation: 'Whitespace-independent variable declarations are wrapped in let(...).', cause: 'This file still uses the v0.1 variable form.' },
  RW2111: { explanation: 'v0.2 fields put the name before a colon and wrap the declaration.', cause: 'This field uses the v0.1 type-name order.' },
  RW2112: { explanation: 'v0.2 wraps a public or private method signature in parentheses.', cause: 'This method uses the v0.1 signature form.' },
  RW2113: { explanation: 'v0.2 puts the class and constructor arguments inside new(...).', cause: 'This constructor call uses the v0.1 form.' },
  RW2114: { explanation: 'v0.2 loop headers are parenthesized and use a colon for iteration.', cause: 'This loop uses the v0.1 in separator.' },
  RW2115: { explanation: 'v0.2 wraps return values in parentheses.', cause: 'This return uses the v0.1 form.' },
  RW2116: { explanation: 'v0.2 match cases wrap their value and no longer need =>.', cause: 'This case uses the v0.1 form.' },
  RW2117: { explanation: 'v0.2 always wraps if and match conditions in parentheses.', cause: 'This condition uses the v0.1 form.' },
  RW2007: { explanation: 'Fields are declarations, so they must end with a semicolon.', cause: 'The semicolon after the field was omitted.' },
  RW2014: { explanation: 'Variable declarations must end with a semicolon.', cause: 'The semicolon after the variable was omitted.' },
  RW2016: { explanation: 'Standalone expressions and calls must end with a semicolon.', cause: 'The semicolon after the expression was omitted.' },
  RW2022: { explanation: 'A return statement must end with a semicolon.', cause: 'The semicolon after the returned value was omitted.' },
  RW2023: { explanation: 'break and continue statements must end with a semicolon.', cause: 'The semicolon after the loop-control statement was omitted.' },
  RW3003: { explanation: 'A class can only extend another class declared in this file.', cause: 'The parent class name may be misspelled or missing.' },
  RW3004: { explanation: 'return sends a result back from a method, so it cannot be used at the top level.', cause: 'Move this statement into a method or remove it.' },
  RW3005: { explanation: 'break and continue control a loop and have no meaning outside one.', cause: 'This statement is not currently inside a loop block.' },
  RW3006: { explanation: 'RoseWind cannot find a visible declaration with this name.', cause: 'The name may be misspelled, declared later in a local scope, or outside the current scope.' },
  RW3007: { explanation: 'The object type does not declare the requested field or method.', cause: 'The member may be misspelled or belong to a different class.' },
  RW3008: { explanation: 'Private members can only be accessed from inside their own class.', cause: 'Use a public method or change the class API rather than accessing private state directly.' },
  RW3009: { explanation: 'new must name a class declared in this file.', cause: 'The class name may be misspelled or not declared yet.' },
  RW3011: { explanation: 'This name is not a built-in type or a declared class.', cause: 'The type name may be misspelled.' },
  RW3013: { explanation: 'The value has a different type from the location receiving it.', cause: 'Check the declared type, the expression type, and whether nullability is required.' },
  RW3014: { explanation: 'Two declarations in the same scope cannot use the same name.', cause: 'Rename one declaration or remove the duplicate.' },
};

const semicolonCodes = new Set(['RW2007', 'RW2014', 'RW2016', 'RW2022', 'RW2023']);

export class RoseWindLanguageService {
  analyze(source: string): LanguageAnalysis {
    try {
      const result = compile(source, { migrationHints: true });
      const symbols = collectDocumentSymbols(source, result.program);
      const diagnostics = result.diagnostics.map((item) => this.enrichDiagnostic(source, item, symbols));
      return { result, diagnostics, symbols };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const program: Program = { kind: 'Program', declarations: [], start: 0, end: source.length, line: 1, column: 1 };
      const diagnostic: LanguageDiagnostic = {
        severity: 'error', code: 'RW9000', message: 'The language service could not analyze this incomplete program.',
        start: 0, end: Math.min(1, source.length), line: 1, column: 1,
        id: 'RW9000:0', explanation: 'The editor recovered from an unexpected compiler failure.',
        likelyCause: message, documentationKey: 'diagnostics.rw9000', actions: [],
      };
      return { result: { ok: false, javascript: '', diagnostics: [diagnostic], program }, diagnostics: [diagnostic], symbols: [] };
    }
  }

  symbols(source: string): readonly DocumentSymbol[] {
    return this.analyze(source).symbols;
  }

  hover(source: string, position: number): HoverInfo | null {
    const word = wordAt(source, position);
    if (!word) return null;
    const item = catalog.find((candidate) => candidate.label === word.text);
    if (item) {
      return {
        range: word.range, kind: item.kind, title: item.label, signature: item.signature,
        description: item.description, documentationKey: `${item.kind}s.${item.label}`,
      };
    }
    const entry = resolveSymbolEntry(source, position, word.text);
    if (!entry) return null;
    return {
      range: word.range,
      kind: entry.symbol.kind,
      title: entry.symbol.name,
      signature: entry.symbol.detail,
      description: symbolDescription(entry.symbol),
      documentationKey: `symbols.${entry.symbol.kind}`,
    };
  }

  definition(source: string, position: number): DefinitionLocation | null {
    const word = wordAt(source, position);
    if (!word || catalog.some((item) => item.label === word.text)) return null;
    const entry = resolveSymbolEntry(source, position, word.text);
    return entry ? { name: entry.symbol.name, range: entry.symbol.range, selectionRange: entry.symbol.selectionRange } : null;
  }

  completions(source: string, position: number): readonly CompletionSuggestion[] {
    const member = source.slice(0, position).match(/([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z0-9_]*)$/);
    if (member) return this.memberCompletions(source, position, member[1]!);

    const entries = flattenSymbols(collectDocumentSymbols(source, safeCompile(source).program));
    const suggestions: CompletionSuggestion[] = catalog.map((item) => ({
      label: item.label, kind: item.kind, detail: item.signature, info: item.description,
      apply: item.apply, boost: item.kind === 'builtin' ? 45 : item.kind === 'type' ? 30 : 15,
    }));
    for (const entry of entries) {
      if (entry.scope.from > position || entry.scope.to < position) continue;
      const local = entry.scope.from > 0;
      const declaredBefore = entry.symbol.selectionRange.from <= position;
      suggestions.push({
        label: entry.symbol.name,
        kind: entry.symbol.kind,
        detail: entry.symbol.detail,
        info: symbolDescription(entry.symbol),
        boost: (local ? 85 : 60) + (declaredBefore ? 10 : 0),
      });
    }
    return deduplicateCompletions(suggestions);
  }

  codeActions(source: string, diagnostic: Diagnostic, symbols = this.symbols(source)): readonly CodeAction[] {
    const actions: CodeAction[] = [];
    if (diagnostic.code.startsWith('RW21')) {
      const edits = this.convertDocumentToV02(source);
      if (edits.length) {
        actions.push({
          id: `${diagnostic.code}.convert-document-v02`, title: 'Convert document to v0.2',
          kind: 'format', diagnosticCode: diagnostic.code, edits, preferred: true,
        });
      }
    }
    if (semicolonCodes.has(diagnostic.code)) {
      const position = Math.min(diagnostic.start, source.length);
      if (source[position - 1] !== ';' && source[position] !== ';') {
        actions.push({
          id: `${diagnostic.code}.insert-semicolon.${position}`,
          title: 'Insert missing semicolon', kind: 'quickfix', diagnosticCode: diagnostic.code,
          edits: [{ from: position, to: position, insert: ';' }], preferred: true,
        });
      }
    }

    const unknown = quotedName(diagnostic.message);
    if (unknown && ['RW3003', 'RW3006', 'RW3007', 'RW3009', 'RW3011'].includes(diagnostic.code)) {
      const candidates = this.spellingCandidates(diagnostic.code, symbols);
      const replacement = closestUnique(unknown, candidates);
      const range = findNameRange(source, diagnostic, unknown);
      if (replacement && range) {
        actions.push({
          id: `${diagnostic.code}.rename.${range.from}.${replacement}`,
          title: `Change “${unknown}” to “${replacement}”`, kind: 'quickfix', diagnosticCode: diagnostic.code,
          edits: [{ ...range, insert: replacement }], preferred: true,
        });
      }
    }
    return actions;
  }

  format(source: string, range?: TextRange): readonly TextEdit[] {
    if (!range && compile(source).ok) {
      const formattedDocument = prettyPrintV02(source);
      return source === formattedDocument ? [] : [{ from: 0, to: source.length, insert: formattedDocument }];
    }
    const target = range ? expandToFullLines(source, range) : { from: 0, to: source.length };
    const prefix = source.slice(0, target.from);
    const context = formattingContext(prefix);
    const original = source.slice(target.from, target.to);
    const formatted = formatLines(original, context.indent, context.blockComment);
    return original === formatted ? [] : [{ ...target, insert: formatted }];
  }

  convertDocumentToV02(source: string): readonly TextEdit[] {
    const converted = compile(source).ok ? prettyPrintV02(source) : formatLines(convertToV02(source), 0, false);
    return converted === source ? [] : [{ from: 0, to: source.length, insert: converted }];
  }

  minify(source: string): readonly TextEdit[] {
    const converted = convertToV02(source);
    const minified = new WhitespaceNormalizer().normalize(converted).source;
    return minified === source ? [] : [{ from: 0, to: source.length, insert: minified }];
  }

  applyEdits(source: string, edits: readonly TextEdit[]): string {
    return [...edits].sort((left, right) => right.from - left.from)
      .reduce((value, edit) => value.slice(0, edit.from) + edit.insert + value.slice(edit.to), source);
  }

  private enrichDiagnostic(source: string, diagnostic: Diagnostic, symbols: readonly DocumentSymbol[]): LanguageDiagnostic {
    const known = diagnosticExplanations[diagnostic.code];
    const types = diagnosticTypes(diagnostic.message);
    return {
      ...diagnostic,
      id: `${diagnostic.code}:${diagnostic.start}:${diagnostic.end}`,
      explanation: known?.explanation ?? explainExpectedDiagnostic(diagnostic.message),
      likelyCause: known?.cause,
      expected: types.expected,
      actual: types.actual,
      documentationKey: `diagnostics.${diagnostic.code.toLowerCase()}`,
      actions: this.codeActions(source, diagnostic, symbols),
    };
  }

  private spellingCandidates(code: string, symbols: readonly DocumentSymbol[]): readonly string[] {
    if (code === 'RW3011') return [...Object.keys(typeDescriptions), ...symbols.filter((item) => item.kind === 'class').map((item) => item.name)];
    if (code === 'RW3003' || code === 'RW3009') return symbols.filter((item) => item.kind === 'class').map((item) => item.name);
    if (code === 'RW3007') return flattenDocumentSymbols(symbols).filter((item) => item.kind === 'field' || item.kind === 'method').map((item) => item.name);
    return [...builtinCatalog.map((item) => item.label), ...flattenDocumentSymbols(symbols).map((item) => item.name)];
  }

  private memberCompletions(source: string, position: number, receiver: string): readonly CompletionSuggestion[] {
    const builtins = memberCatalog[receiver];
    if (builtins) return builtins.map((item) => ({ label: item.label, kind: 'property', detail: item.signature, info: item.description, apply: item.apply, boost: 100 }));
    const symbols = collectDocumentSymbols(source, safeCompile(source).program);
    let className: string | undefined;
    if (receiver === 'self') {
      className = symbols.find((item) => item.kind === 'class' && item.range.from <= position && item.range.to >= position)?.name;
    } else {
      className = flattenDocumentSymbols(symbols).find((item) => item.name === receiver && item.type)?.type?.replace(/\?$/, '');
    }
    const klass = symbols.find((item) => item.kind === 'class' && item.name === className);
    if (!klass) return [];
    return klass.children
      .filter((item) => (item.kind === 'field' || item.kind === 'method') && (receiver === 'self' || item.visibility === 'pub'))
      .map((item) => ({
        label: item.name, kind: item.kind, detail: item.detail, info: symbolDescription(item),
        apply: item.kind === 'method' ? `${item.name}()` : undefined, boost: item.visibility === 'pub' ? 100 : 90,
      }));
  }
}

export const roseWindLanguageService = new RoseWindLanguageService();

function safeCompile(source: string): CompileResult {
  try { return compile(source); }
  catch {
    const program: Program = { kind: 'Program', declarations: [], start: 0, end: source.length, line: 1, column: 1 };
    return { ok: false, javascript: '', diagnostics: [], program };
  }
}

function collectDocumentSymbols(source: string, program: Program): readonly DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];
  for (const item of program.declarations) {
    if (item.kind === 'ClassDeclaration') symbols.push(classSymbol(source, item));
    else if (item.kind === 'VariableDeclaration') symbols.push(variableSymbol(source, item, { from: 0, to: source.length }));
  }
  addFallbackSymbols(source, symbols);
  return symbols.sort((left, right) => left.range.from - right.range.from);
}

function classSymbol(source: string, declaration: ClassDeclaration): DocumentSymbol {
  const children: DocumentSymbol[] = [];
  for (const member of declaration.members) {
    if (member.kind === 'FieldDeclaration') {
      children.push({
        name: member.name, kind: 'field', detail: `${member.access} ${displayType(member.type)} ${member.name}`,
        range: toRange(member), selectionRange: nameRange(source, member, member.name), children: [],
        containerName: declaration.name, visibility: member.access, type: displayType(member.type),
      });
    } else {
      children.push(methodSymbol(source, member, declaration.name));
    }
  }
  return {
    name: declaration.name, kind: 'class',
    detail: `class(${declaration.name}${declaration.parent ? `:${declaration.parent}` : ''})`,
    range: toRange(declaration), selectionRange: nameRange(source, declaration, declaration.name), children,
  };
}

function methodSymbol(source: string, method: MethodDeclaration, className: string): DocumentSymbol {
  const parameters = method.parameters.map((parameter) => ({
    name: parameter.name, kind: 'parameter' as const,
    detail: `${parameter.name}: ${displayType(parameter.type)}`,
    range: toRange(parameter), selectionRange: nameRange(source, parameter, parameter.name), children: [],
    containerName: method.name, type: displayType(parameter.type),
  }));
  const locals = collectStatementSymbols(source, method.body, method.name, { from: method.body.start, to: method.body.end });
  const args = method.parameters.map((parameter) => `${parameter.name}: ${displayType(parameter.type)}`).join(', ');
  return {
    name: method.name, kind: method.constructor ? 'constructor' : 'method',
    detail: method.constructor ? `create(${args})` : `${method.access}(${method.name}(${args})->${displayType(method.returnType)})`,
    range: toRange(method), selectionRange: nameRange(source, method, method.name),
    children: [...parameters, ...locals], containerName: className, visibility: method.access,
    type: displayType(method.returnType),
  };
}

function collectStatementSymbols(source: string, statement: Statement, containerName: string, scope: TextRange): DocumentSymbol[] {
  const result: DocumentSymbol[] = [];
  const visit = (item: Statement, activeScope: TextRange): void => {
    switch (item.kind) {
      case 'VariableDeclaration': result.push(variableSymbol(source, item, activeScope, containerName)); break;
      case 'BlockStatement': {
        const blockScope = toRange(item);
        for (const child of item.statements) visit(child, blockScope);
        break;
      }
      case 'IfStatement':
        visit(item.thenBranch, toRange(item.thenBranch));
        if (item.elseBranch) visit(item.elseBranch, toRange(item.elseBranch));
        break;
      case 'LoopStatement':
        if (item.variable) {
          const range = nameRange(source, item, item.variable);
          result.push({ name: item.variable, kind: 'variable', detail: `loop ${item.variable}`, range, selectionRange: range, children: [], containerName, type: 'any' });
        }
        visit(item.body, toRange(item.body));
        break;
      case 'TryStatement':
        visit(item.body, toRange(item.body));
        {
          const range = nameRange(source, item, item.errorName);
          result.push({ name: item.errorName, kind: 'variable', detail: `${item.errorName}: any`, range, selectionRange: range, children: [], containerName, type: 'any' });
        }
        visit(item.catchBody, toRange(item.catchBody));
        break;
      case 'MatchStatement': for (const branch of item.cases) visit(branch.body, toRange(branch.body)); break;
    }
  };
  for (const child of statement.kind === 'BlockStatement' ? statement.statements : [statement]) visit(child, scope);
  return result;
}

function variableSymbol(source: string, declaration: VariableDeclaration, scope: TextRange, containerName?: string): DocumentSymbol {
  const valueType = declaration.type ? displayType(declaration.type) : inferExpressionType(declaration.initializer);
  return {
    name: declaration.name, kind: 'variable', detail: `let ${declaration.name}: ${valueType}`,
    range: toRange(declaration), selectionRange: nameRange(source, declaration, declaration.name),
    children: [], containerName, type: valueType,
  };
}

function inferExpressionType(expression?: Expression): string {
  if (!expression) return 'any';
  if (expression.kind === 'LiteralExpression') return expression.literalType === 'null' ? 'any?' : expression.literalType;
  if (expression.kind === 'ArrayExpression') return `list<${expression.elements.length ? inferExpressionType(expression.elements[0]) : 'any'}>`;
  if (expression.kind === 'DictionaryExpression') return 'dict<text, any>';
  if (expression.kind === 'NewExpression') return expression.className;
  return 'any';
}

function addFallbackSymbols(source: string, symbols: DocumentSymbol[]): void {
  const existing = new Set(flattenDocumentSymbols(symbols).map((item) => `${item.kind}:${item.name}:${item.selectionRange.from}`));
  for (const match of source.matchAll(/\b(class|let)\s*(?:\(\s*)?([A-Za-z_][A-Za-z0-9_]*)/g)) {
    const kind = match[1] === 'class' ? 'class' : 'variable';
    const from = match.index! + match[0].lastIndexOf(match[2]!);
    const key = `${kind}:${match[2]}:${from}`;
    if (existing.has(key)) continue;
    symbols.push({
      name: match[2]!, kind, detail: kind === 'class' ? `class ${match[2]}` : `let ${match[2]}: any`,
      range: { from: match.index!, to: lineEnd(source, match.index!) },
      selectionRange: { from, to: from + match[2]!.length }, children: [], type: kind === 'variable' ? 'any' : undefined,
    });
  }
}

function flattenDocumentSymbols(symbols: readonly DocumentSymbol[]): DocumentSymbol[] {
  const result: DocumentSymbol[] = [];
  const visit = (symbol: DocumentSymbol): void => { result.push(symbol); symbol.children.forEach(visit); };
  symbols.forEach(visit);
  return result;
}

function flattenSymbols(symbols: readonly DocumentSymbol[]): SymbolEntry[] {
  const result: SymbolEntry[] = [];
  const visit = (symbol: DocumentSymbol, parentScope: TextRange, className?: string): void => {
    const currentClass = symbol.kind === 'class' ? symbol.name : className;
    const scope = symbol.kind === 'parameter' || symbol.kind === 'variable' ? parentScope : symbol.range;
    result.push({ symbol, scope, className: currentClass });
    const childScope = symbol.kind === 'method' || symbol.kind === 'constructor' ? symbol.range : scope;
    symbol.children.forEach((child) => visit(child, childScope, currentClass));
  };
  symbols.forEach((symbol) => visit(symbol, { from: 0, to: Number.MAX_SAFE_INTEGER }));
  return result;
}

function resolveSymbolEntry(source: string, position: number, name: string): SymbolEntry | undefined {
  const entries = flattenSymbols(collectDocumentSymbols(source, safeCompile(source).program)).filter((item) => item.symbol.name === name);
  const definition = entries.find((item) => item.symbol.selectionRange.from <= position && item.symbol.selectionRange.to >= position);
  if (definition) return definition;
  const propertyAccess = source.slice(0, position).match(/([A-Za-z_][A-Za-z0-9_]*)\.[A-Za-z0-9_]*$/);
  if (propertyAccess?.[1] === 'self') {
    const containingClass = entries.find((item) => item.className && item.scope.from <= position && item.scope.to >= position)?.className;
    const member = entries.find((item) => item.symbol.containerName === containingClass);
    if (member) return member;
  }
  return entries
    .filter((item) => item.scope.from <= position && item.scope.to >= position)
    .sort((left, right) => {
      const leftBefore = left.symbol.selectionRange.from <= position ? 1 : 0;
      const rightBefore = right.symbol.selectionRange.from <= position ? 1 : 0;
      return rightBefore - leftBefore || right.symbol.selectionRange.from - left.symbol.selectionRange.from;
    })[0] ?? entries[0];
}

function displayType(node: TypeNode): string {
  const args = node.arguments.length ? `<${node.arguments.map(displayType).join(', ')}>` : '';
  return `${node.name}${args}${node.nullable ? '?' : ''}`;
}

function symbolDescription(symbol: DocumentSymbol): string {
  switch (symbol.kind) {
    case 'class': return 'A class groups typed state and behavior into reusable objects.';
    case 'field': return `${symbol.visibility === 'pub' ? 'Public' : 'Private'} state stored on each ${symbol.containerName ?? 'class'} instance.`;
    case 'method': return `${symbol.visibility === 'pub' ? 'Public' : 'Private'} behavior declared by ${symbol.containerName ?? 'this class'}.`;
    case 'constructor': return `Initializes a new ${symbol.containerName ?? 'class'} instance.`;
    case 'parameter': return 'A typed input available inside this method.';
    case 'variable': return 'A named value available in its declaring scope.';
  }
}

function toRange(span: SourceSpan): TextRange { return { from: span.start, to: span.end }; }

function nameRange(source: string, span: SourceSpan, name: string): TextRange {
  const from = source.indexOf(name, span.start);
  if (from >= span.start && from + name.length <= span.end) return { from, to: from + name.length };
  const spaced = new RegExp(name.split('').map(escapeRegExp).join('\\s*')).exec(source.slice(span.start, span.end));
  if (spaced?.index !== undefined) {
    const spacedFrom = span.start + spaced.index;
    return { from: spacedFrom, to: spacedFrom + spaced[0].length };
  }
  return { from: span.start, to: Math.min(span.end, span.start + name.length) };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordAt(source: string, position: number): { text: string; range: TextRange } | null {
  let from = Math.max(0, Math.min(position, source.length));
  let to = from;
  if (from === source.length || !/[A-Za-z0-9_]/.test(source[from] ?? '')) from--;
  if (from < 0 || !/[A-Za-z0-9_]/.test(source[from] ?? '')) return null;
  while (from > 0 && /[A-Za-z0-9_]/.test(source[from - 1]!)) from--;
  to = Math.max(position, from);
  while (to < source.length && /[A-Za-z0-9_]/.test(source[to]!)) to++;
  return { text: source.slice(from, to), range: { from, to } };
}

function findNameRange(source: string, span: SourceSpan, name: string): TextRange | null {
  const boundedEnd = Math.min(source.length, Math.max(span.end, span.start + name.length));
  let from = source.lastIndexOf(name, boundedEnd);
  if (from < span.start) from = source.indexOf(name, span.start);
  return from >= 0 ? { from, to: from + name.length } : null;
}

function quotedName(message: string): string | undefined {
  return [...message.matchAll(/["“]([^"”]+)["”]/g)].at(-1)?.[1];
}

function diagnosticTypes(message: string): { expected?: string; actual?: string } {
  const assignment = message.match(/Cannot assign (.+?) to (.+?)\.$/);
  if (assignment) return { actual: assignment[1], expected: assignment[2] };
  const required = message.match(/(?:must be|expects) ([A-Za-z][A-Za-z0-9_<>?, ]*)\.?$/);
  return required ? { expected: required[1] } : {};
}

function explainExpectedDiagnostic(message: string): string {
  if (message.startsWith('Expected ')) return `RoseWind could not continue parsing because ${message.slice(0, -1).toLowerCase()}.`;
  return 'RoseWind found code that does not satisfy this language rule.';
}

function closestUnique(value: string, candidates: readonly string[]): string | undefined {
  const ranked = [...new Set(candidates)].filter((item) => item !== value)
    .map((item) => ({ item, distance: editDistance(value.toLowerCase(), item.toLowerCase()) }))
    .sort((left, right) => left.distance - right.distance || left.item.localeCompare(right.item));
  const maximum = Math.max(1, Math.min(3, Math.floor(value.length / 3) + 1));
  return ranked[0] && ranked[0].distance <= maximum && ranked[0].distance < (ranked[1]?.distance ?? Infinity) ? ranked[0].item : undefined;
}

function editDistance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const previous = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return row[right.length]!;
}

function deduplicateCompletions(items: readonly CompletionSuggestion[]): readonly CompletionSuggestion[] {
  const found = new Map<string, CompletionSuggestion>();
  for (const item of items) {
    const current = found.get(item.label);
    if (!current || item.boost > current.boost) found.set(item.label, item);
  }
  return [...found.values()].sort((left, right) => right.boost - left.boost || left.label.localeCompare(right.label));
}

function prettyPrintV02(source: string): string {
  const compact = new WhitespaceNormalizer().normalize(convertToV02(source)).source;
  let output = '';
  let indent = 0;
  let index = 0;
  let atLineStart = true;

  const write = (value: string): void => {
    if (!value) return;
    if (atLineStart) { output += ' '.repeat(indent * 4); atLineStart = false; }
    output += value;
  };
  const newline = (): void => {
    output = output.replace(/[ \t]+$/g, '');
    if (!output.endsWith('\n')) output += '\n';
    atLineStart = true;
  };
  const spaced = (value: string): void => {
    output = output.replace(/[ \t]+$/g, '');
    if (output && !output.endsWith('\n')) output += ' ';
    write(value);
    output += ' ';
  };

  while (index < compact.length) {
    const character = compact[index]!;
    const next = compact[index + 1] ?? '';
    if (character === '/' && next === '*') {
      const end = compact.indexOf('*/', index + 2);
      write(compact.slice(index, end < 0 ? compact.length : end + 2));
      index = end < 0 ? compact.length : end + 2;
      newline();
      continue;
    }
    if (character === '"' || character === '\'') {
      const quote = character;
      let literal = character;
      index++;
      while (index < compact.length) {
        const current = compact[index]!;
        literal += current;
        index++;
        if (current === '\\' && index < compact.length) literal += compact[index++]!;
        else if (current === quote) break;
      }
      write(literal);
      continue;
    }
    const pair = character + next;
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(pair)) {
      spaced(pair); index += 2; continue;
    }
    if (pair === '->') { write(pair); index += 2; continue; }
    if (character === '{') {
      output = output.replace(/[ \t]+$/g, '');
      if (output && !output.endsWith('\n') && !output.endsWith(' ')) output += ' ';
      write('{'); indent++; index++; newline(); continue;
    }
    if (character === '}') {
      if (!atLineStart) newline();
      indent = Math.max(0, indent - 1);
      write('}'); index++;
      const following = compact[index] ?? '';
      if (![')', ']', ',', ';'].includes(following)) newline();
      continue;
    }
    if (character === ';') { write(';'); index++; newline(); continue; }
    if (character === ',') { write(', '); index++; continue; }
    if (['=', '+', '-', '*', '/', '%', '<', '>'].includes(character)) {
      spaced(character); index++; continue;
    }
    write(character);
    index++;
  }
  return output.trimEnd() + '\n';
}
function expandToFullLines(source: string, range: TextRange): TextRange {
  const from = Math.max(0, source.lastIndexOf('\n', Math.max(0, range.from - 1)) + 1);
  const newline = source.indexOf('\n', range.to);
  return { from, to: newline < 0 ? source.length : newline + 1 };
}

function formattingContext(source: string): { indent: number; blockComment: boolean } {
  const state = { indent: 0, blockComment: false };
  for (const line of source.split('\n')) {
    const scan = scanBraces(line, state.blockComment);
    state.blockComment = scan.blockComment;
    state.indent = Math.max(0, state.indent + scan.opens - scan.closes);
  }
  return state;
}

function formatLines(source: string, initialIndent: number, initialBlockComment: boolean): string {
  const trailingNewline = source.endsWith('\n');
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  if (trailingNewline) lines.pop();
  let indent = initialIndent;
  let blockComment = initialBlockComment;
  const output = lines.map((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const leadingClosers = trimmed.match(/^}+/)?.[0].length ?? 0;
    const lineIndent = Math.max(0, indent - leadingClosers);
    const scan = scanBraces(trimmed, blockComment);
    blockComment = scan.blockComment;
    indent = Math.max(0, indent + scan.opens - scan.closes);
    return `${' '.repeat(lineIndent * 4)}${trimmed}`;
  });
  return output.join('\n') + (trailingNewline ? '\n' : '');
}

function scanBraces(source: string, initialBlockComment: boolean): { opens: number; closes: number; blockComment: boolean } {
  let opens = 0;
  let closes = 0;
  let blockComment = initialBlockComment;
  let quote = '';
  for (let index = 0; index < source.length; index++) {
    const character = source[index]!;
    const next = source[index + 1] ?? '';
    if (blockComment) {
      if (character === '*' && next === '/') { blockComment = false; index++; }
      continue;
    }
    if (quote) {
      if (character === '\\') index++;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '/' && next === '/') break;
    if (character === '/' && next === '*') { blockComment = true; index++; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '{') opens++;
    if (character === '}') closes++;
  }
  return { opens, closes, blockComment };
}

function lineEnd(source: string, position: number): number {
  const end = source.indexOf('\n', position);
  return end < 0 ? source.length : end;
}
