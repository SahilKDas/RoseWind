import { Program } from './ast';
import { JavaScriptEmitter } from './emitter';
import { Lexer } from './tokens';
import { Parser } from './parser';
import { Diagnostic } from './tokens';
import { TypeChecker } from './type-checker';

export interface CompileResult {
  readonly ok: boolean;
  readonly javascript: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly program: Program;
}

export function compile(source: string): CompileResult {
  const lexed = new Lexer(source).scan();
  const parsed = new Parser(lexed.tokens).parse();
  const diagnostics = [...lexed.diagnostics, ...parsed.diagnostics];
  if (!diagnostics.some((item) => item.severity === 'error')) {
    diagnostics.push(...new TypeChecker().check(parsed.program));
  }
  const ok = !diagnostics.some((item) => item.severity === 'error');
  return {
    ok,
    javascript: ok ? new JavaScriptEmitter().emit(parsed.program) : '',
    diagnostics: diagnostics.sort((left, right) => left.start - right.start),
    program: parsed.program,
  };
}

export { executeInWorker } from './runtime';
export type { RunResult } from './runtime';
export type { Diagnostic } from './tokens';
