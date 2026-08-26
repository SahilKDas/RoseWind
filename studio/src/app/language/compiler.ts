import { Program } from './ast';
import { JavaScriptEmitter } from './emitter';
import { Lexer } from './tokens';
import { Parser } from './parser';
import { Diagnostic } from './tokens';
import { TypeChecker } from './type-checker';
import { legacyGrammarDiagnostics, usesLegacyGrammar } from './migration';
import { WhitespaceNormalizer } from './whitespace-normalizer';

export interface CompileResult {
  readonly ok: boolean;
  readonly javascript: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly program: Program;
}

export interface CompileOptions {
  readonly migrationHints?: boolean;
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const normalized = new WhitespaceNormalizer().normalize(source);
  const legacy = usesLegacyGrammar(source);
  const lexed = legacy
    ? new Lexer(source).scan()
    : new Lexer(normalized.source, normalized).scan();
  const parsed = new Parser(lexed.tokens).parse();
  const diagnostics = [
    ...(options.migrationHints ? normalized.diagnostics : []),
    ...(options.migrationHints && legacy ? legacyGrammarDiagnostics(source) : []),
    ...lexed.diagnostics,
    ...parsed.diagnostics,
  ];
  if (!diagnostics.some((item) => item.severity === 'error')) {
    diagnostics.push(...new TypeChecker().check(parsed.program));
  }
  const ok = !diagnostics.some((item) => item.severity === 'error');
  return {
    ok,
    javascript: ok ? new JavaScriptEmitter().emit(parsed.program) : '',
    diagnostics: diagnostics.sort((left, right) => (left.severity === right.severity ? 0 : left.severity === 'error' ? -1 : 1) || left.start - right.start),
    program: parsed.program,
  };
}

export { executeInWorker } from './runtime';
export type { RunResult } from './runtime';
export type { Diagnostic } from './tokens';
