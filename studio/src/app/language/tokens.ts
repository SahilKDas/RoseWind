export type TokenKind =
  | 'identifier'
  | 'number'
  | 'string'
  | 'duration'
  | 'regex'
  | 'eof'
  | 'class' | 'self' | 'create' | 'extends' | 'new' | 'pub' | 'priv' | 'super'
  | 'if' | 'else' | 'loop' | 'in' | 'return' | 'break' | 'continue'
  | 'match' | 'case' | 'default' | 'try' | 'catch' | 'let' | 'true' | 'false' | 'null'
  | 'text' | 'num' | 'bool' | 'list' | 'dict' | 'void' | 'any' | 'date'
  | 'time' | 'bytes' | 'decimal' | 'id' | 'set'
  | '{' | '}' | '(' | ')' | '[' | ']' | ';' | ':' | ',' | '.' | '?'
  | '+' | '-' | '*' | '/' | '%' | '!' | '=' | '<' | '>'
  | '==' | '!=' | '<=' | '>=' | '&&' | '||' | '->' | '=>';

export interface SourceSpan {
  readonly start: number;
  readonly end: number;
  readonly line: number;
  readonly column: number;
}

export interface Token extends SourceSpan {
  readonly kind: TokenKind;
  readonly lexeme: string;
  readonly value?: string | number | boolean | null;
}

export interface Diagnostic extends SourceSpan {
  readonly severity: 'error' | 'warning';
  readonly code: string;
  readonly message: string;
}

const keywords = new Set<TokenKind>([
  'class', 'self', 'create', 'extends', 'new', 'pub', 'priv', 'super',
  'if', 'else', 'loop', 'in', 'return', 'break', 'continue', 'match',
  'case', 'default', 'try', 'catch', 'let', 'true', 'false', 'null',
  'text', 'num', 'bool', 'list', 'dict', 'void', 'any', 'date', 'time',
  'bytes', 'decimal', 'id', 'set',
]);

const twoCharacterTokens: Readonly<Record<string, TokenKind>> = {
  '==': '==', '!=': '!=', '<=': '<=', '>=': '>=', '&&': '&&',
  '||': '||', '->': '->', '=>': '=>',
};

const singleCharacterTokens = new Set<TokenKind>([
  '{', '}', '(', ')', '[', ']', ';', ':', ',', '.', '?', '+', '-', '*',
  '/', '%', '!', '=', '<', '>',
]);

export class Lexer {
  private readonly tokens: Token[] = [];
  private readonly diagnostics: Diagnostic[] = [];
  private current = 0;
  private line = 1;
  private column = 1;

  constructor(private readonly source: string) {}

  scan(): { tokens: readonly Token[]; diagnostics: readonly Diagnostic[] } {
    while (!this.atEnd()) {
      const start = this.current;
      const line = this.line;
      const column = this.column;
      this.scanToken(start, line, column);
    }
    this.tokens.push({
      kind: 'eof', lexeme: '', start: this.current, end: this.current,
      line: this.line, column: this.column,
    });
    return { tokens: this.tokens, diagnostics: this.diagnostics };
  }

  private scanToken(start: number, line: number, column: number): void {
    const character = this.advance();
    if (/\s/.test(character)) return;

    if (character === '/' && this.peek() === '/') {
      while (this.peek() !== '\n' && !this.atEnd()) this.advance();
      return;
    }
    if (character === '/' && this.peek() === '*') {
      this.advance();
      while (!this.atEnd() && !(this.peek() === '*' && this.peekNext() === '/')) {
        this.advance();
      }
      if (this.atEnd()) {
        this.report('RW1001', 'Unterminated block comment.', start, line, column);
      } else {
        this.advance();
        this.advance();
      }
      return;
    }

    if (character === 'r' && this.peek() === '"') {
      this.advance();
      this.quoted('regex', start, line, column);
      return;
    }
    if (character === '"' || character === '\'') {
      this.quoted('string', start, line, column, character);
      return;
    }
    if (/\d/.test(character)) {
      this.number(start, line, column);
      return;
    }
    if (/[A-Za-z_]/.test(character)) {
      while (/[A-Za-z0-9_]/.test(this.peek())) this.advance();
      const lexeme = this.source.slice(start, this.current);
      const kind = keywords.has(lexeme as TokenKind) ? lexeme as TokenKind : 'identifier';
      const value = kind === 'true' ? true : kind === 'false' ? false : kind === 'null' ? null : lexeme;
      this.add(kind, start, line, column, value);
      return;
    }

    const pair = character + this.peek();
    const pairKind = twoCharacterTokens[pair];
    if (pairKind) {
      this.advance();
      this.add(pairKind, start, line, column);
      return;
    }
    if (singleCharacterTokens.has(character as TokenKind)) {
      this.add(character as TokenKind, start, line, column);
      return;
    }
    this.report('RW1000', `Unexpected character "${character}".`, start, line, column);
  }

  private quoted(kind: 'string' | 'regex', start: number, line: number, column: number, quote = '"'): void {
    let value = '';
    while (!this.atEnd() && this.peek() !== quote) {
      const character = this.advance();
      if (character === '\\' && !this.atEnd()) {
        const escaped = this.advance();
        value += ({ n: '\n', r: '\r', t: '\t' } as Record<string, string>)[escaped] ?? escaped;
      } else {
        value += character;
      }
    }
    if (this.atEnd()) {
      this.report('RW1002', `Unterminated ${kind} literal.`, start, line, column);
      return;
    }
    this.advance();
    this.add(kind, start, line, column, value);
  }

  private number(start: number, line: number, column: number): void {
    while (/\d/.test(this.peek())) this.advance();
    if (this.peek() === '.' && /\d/.test(this.peekNext())) {
      this.advance();
      while (/\d/.test(this.peek())) this.advance();
    }
    const numericEnd = this.current;
    while (/[A-Za-z]/.test(this.peek())) this.advance();
    const unit = this.source.slice(numericEnd, this.current);
    if (unit) {
      const validUnits = new Set(['ms', 's', 'm', 'h', 'd']);
      if (!validUnits.has(unit)) {
        this.report('RW1003', `Unknown duration unit "${unit}".`, start, line, column);
      }
      this.add('duration', start, line, column, this.durationValue(Number(this.source.slice(start, numericEnd)), unit));
      return;
    }
    this.add('number', start, line, column, Number(this.source.slice(start, numericEnd)));
  }

  private durationValue(value: number, unit: string): number {
    return value * ({ ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as Record<string, number>)[unit]!;
  }

  private add(kind: TokenKind, start: number, line: number, column: number, value?: Token['value']): void {
    this.tokens.push({ kind, lexeme: this.source.slice(start, this.current), value, start, end: this.current, line, column });
  }

  private report(code: string, message: string, start: number, line: number, column: number): void {
    this.diagnostics.push({ severity: 'error', code, message, start, end: this.current, line, column });
  }

  private advance(): string {
    const character = this.source[this.current++] ?? '\0';
    if (character === '\n') { this.line++; this.column = 1; } else { this.column++; }
    return character;
  }

  private peek(): string { return this.source[this.current] ?? '\0'; }
  private peekNext(): string { return this.source[this.current + 1] ?? '\0'; }
  private atEnd(): boolean { return this.current >= this.source.length; }
}
