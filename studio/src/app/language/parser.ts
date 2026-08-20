import {
  ArrayExpression, AssignmentExpression, BinaryExpression, BlockStatement,
  BreakStatement, CallExpression, ClassDeclaration, ClassMember, ContinueStatement,
  Declaration, DictionaryEntry, DictionaryExpression, Expression, ExpressionStatement,
  FieldDeclaration, IdentifierExpression, IfStatement, IndexExpression, LiteralExpression,
  LoopStatement, MatchCase, MatchStatement, MemberExpression, MethodDeclaration,
  NewExpression, Parameter, Program, ReturnStatement, Statement, TryStatement, TypeNode,
  UnaryExpression, VariableDeclaration,
} from './ast';
import { Diagnostic, SourceSpan, Token, TokenKind } from './tokens';

const typeTokens = new Set<TokenKind>([
  'text', 'num', 'bool', 'list', 'dict', 'void', 'any', 'date', 'time',
  'bytes', 'decimal', 'id', 'set', 'identifier',
]);

const callableTypeTokens = new Set<TokenKind>(['num', 'date', 'bytes', 'decimal', 'id', 'set']);

const precedence: Readonly<Record<string, number>> = {
  '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4,
  '+': 5, '-': 5, '*': 6, '/': 6, '%': 6,
};

export class Parser {
  private current = 0;
  private readonly diagnostics: Diagnostic[] = [];

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): { program: Program; diagnostics: readonly Diagnostic[] } {
    const start = this.peek();
    const declarations: (Declaration | Statement)[] = [];
    while (!this.check('eof')) {
      try {
        declarations.push(this.declaration());
      } catch {
        this.synchronize();
      }
    }
    return {
      program: { kind: 'Program', declarations, ...this.span(start, this.previousOr(start)) },
      diagnostics: this.diagnostics,
    };
  }

  private declaration(): Declaration | Statement {
    if (this.match('class')) return this.classDeclaration(this.previous());
    if (this.match('let')) return this.variableDeclaration(this.previous());
    return this.statement();
  }

  private classDeclaration(start: Token): ClassDeclaration {
    const name = this.consume('identifier', 'RW2001', 'Expected a class name.');
    const parent = this.match('extends')
      ? this.consume('identifier', 'RW2002', 'Expected a parent class name.').lexeme
      : undefined;
    this.consume('{', 'RW2003', 'Expected "{" before class members.');
    const members: ClassMember[] = [];
    while (!this.check('}') && !this.check('eof')) members.push(this.classMember());
    const end = this.consume('}', 'RW2004', 'Expected "}" after class declaration.');
    return { kind: 'ClassDeclaration', name: name.lexeme, parent, members, ...this.span(start, end) };
  }

  private classMember(): ClassMember {
    const start = this.peek();
    const access = this.match('pub') ? 'pub' : this.match('priv') ? 'priv' : 'priv';
    if (this.match('create')) {
      const parameters = this.parameters();
      const body = this.block();
      return {
        kind: 'MethodDeclaration', access, name: 'create', constructor: true,
        parameters, returnType: this.syntheticType('void', start), body,
        ...this.span(start, this.previous()),
      } satisfies MethodDeclaration;
    }

    if (this.check('identifier') && this.peekNext().kind === '(') {
      const name = this.advance();
      const parameters = this.parameters();
      this.consume('->', 'RW2005', 'Expected "->" before the method return type.');
      const returnType = this.type();
      const body = this.block();
      return {
        kind: 'MethodDeclaration', access, name: name.lexeme, constructor: false,
        parameters, returnType, body, ...this.span(start, this.previous()),
      } satisfies MethodDeclaration;
    }

    const fieldType = this.type();
    const fieldName = this.consume('identifier', 'RW2006', 'Expected a field name.');
    const end = this.consume(';', 'RW2007', 'Expected ";" after field declaration.');
    return {
      kind: 'FieldDeclaration', access, name: fieldName.lexeme, type: fieldType,
      ...this.span(start, end),
    } satisfies FieldDeclaration;
  }

  private parameters(): Parameter[] {
    this.consume('(', 'RW2008', 'Expected "(" before parameters.');
    const parameters: Parameter[] = [];
    if (!this.check(')')) {
      do {
        const start = this.peek();
        const parameterType = this.type();
        const name = this.consume('identifier', 'RW2009', 'Expected a parameter name.');
        parameters.push({ name: name.lexeme, type: parameterType, ...this.span(start, name) });
      } while (this.match(','));
    }
    this.consume(')', 'RW2010', 'Expected ")" after parameters.');
    return parameters;
  }

  private type(): TypeNode {
    const start = this.peek();
    if (!typeTokens.has(start.kind)) return this.failType(start, 'Expected a type name.');
    this.advance();
    const args: TypeNode[] = [];
    if (this.match('<')) {
      do { args.push(this.type()); } while (this.match(','));
      this.consume('>', 'RW2012', 'Expected ">" after generic type arguments.');
    }
    const nullable = this.match('?');
    return {
      name: start.lexeme, arguments: args, nullable,
      ...this.span(start, this.previous()),
    };
  }

  private failType(token: Token, message: string): never {
    this.error(token, 'RW2011', message);
    throw new ParseFailure();
  }

  private variableDeclaration(start: Token): VariableDeclaration {
    const name = this.consume('identifier', 'RW2013', 'Expected a variable name.');
    const declaredType = this.match(':') ? this.type() : undefined;
    const initializer = this.match('=') ? this.expression() : undefined;
    const end = this.consume(';', 'RW2014', 'Expected ";" after variable declaration.');
    if (!declaredType && !initializer) {
      this.error(name, 'RW2015', 'A variable needs a type or an initial value.');
    }
    return {
      kind: 'VariableDeclaration', name: name.lexeme, type: declaredType, initializer,
      ...this.span(start, end),
    };
  }

  private statement(): Statement {
    if (this.match('{')) return this.blockFrom(this.previous());
    if (this.match('if')) return this.ifStatement(this.previous());
    if (this.match('loop')) return this.loopStatement(this.previous());
    if (this.match('return')) return this.returnStatement(this.previous());
    if (this.match('break')) return this.keywordStatement<BreakStatement>('BreakStatement', this.previous());
    if (this.match('continue')) return this.keywordStatement<ContinueStatement>('ContinueStatement', this.previous());
    if (this.match('try')) return this.tryStatement(this.previous());
    if (this.match('match')) return this.matchStatement(this.previous());
    const start = this.peek();
    const expression = this.expression();
    const end = this.consume(';', 'RW2016', 'Expected ";" after expression.');
    return { kind: 'ExpressionStatement', expression, ...this.span(start, end) } satisfies ExpressionStatement;
  }

  private block(): BlockStatement {
    const start = this.consume('{', 'RW2017', 'Expected "{" before block.');
    return this.blockFrom(start);
  }

  private blockFrom(start: Token): BlockStatement {
    const statements: Statement[] = [];
    while (!this.check('}') && !this.check('eof')) {
      const item = this.declaration();
      if (item.kind === 'ClassDeclaration') {
        this.error(this.previous(), 'RW2018', 'Classes can only be declared at the top level.');
      } else {
        statements.push(item);
      }
    }
    const end = this.consume('}', 'RW2019', 'Expected "}" after block.');
    return { kind: 'BlockStatement', statements, ...this.span(start, end) };
  }

  private ifStatement(start: Token): IfStatement {
    const parenthesized = this.match('(');
    const condition = this.expression();
    if (parenthesized) this.consume(')', 'RW2020', 'Expected ")" after condition.');
    const thenBranch = this.statement();
    const elseBranch = this.match('else') ? this.statement() : undefined;
    return { kind: 'IfStatement', condition, thenBranch, elseBranch, ...this.span(start, this.previous()) };
  }

  private loopStatement(start: Token): LoopStatement {
    let variable: string | undefined;
    let iterable: Expression | undefined;
    let condition: Expression | undefined;
    const parenthesized = this.match('(');
    if (this.check('identifier') && this.peekNext().kind === 'in') {
      variable = this.advance().lexeme;
      this.advance();
      iterable = this.expression();
    } else if (!this.check('{')) {
      condition = this.expression();
    }
    if (parenthesized) this.consume(')', 'RW2021', 'Expected ")" after loop header.');
    const body = this.statement();
    return { kind: 'LoopStatement', variable, iterable, condition, body, ...this.span(start, this.previous()) };
  }

  private returnStatement(start: Token): ReturnStatement {
    const value = this.check(';') ? undefined : this.expression();
    const end = this.consume(';', 'RW2022', 'Expected ";" after return value.');
    return { kind: 'ReturnStatement', value, ...this.span(start, end) };
  }

  private keywordStatement<T extends BreakStatement | ContinueStatement>(kind: T['kind'], start: Token): T {
    const end = this.consume(';', 'RW2023', 'Expected ";" after loop control statement.');
    return { kind, ...this.span(start, end) } as T;
  }

  private tryStatement(start: Token): TryStatement {
    const body = this.block();
    this.consume('catch', 'RW2024', 'Expected "catch" after try block.');
    this.consume('(', 'RW2025', 'Expected "(" after catch.');
    const name = this.consume('identifier', 'RW2026', 'Expected an error variable.');
    this.consume(')', 'RW2027', 'Expected ")" after error variable.');
    const catchBody = this.block();
    return { kind: 'TryStatement', body, errorName: name.lexeme, catchBody, ...this.span(start, this.previous()) };
  }

  private matchStatement(start: Token): MatchStatement {
    const parenthesized = this.match('(');
    const value = this.expression();
    if (parenthesized) this.consume(')', 'RW2028', 'Expected ")" after match value.');
    this.consume('{', 'RW2029', 'Expected "{" before match cases.');
    const cases: MatchCase[] = [];
    while (!this.check('}') && !this.check('eof')) {
      const caseStart = this.peek();
      let test: Expression | undefined;
      if (this.match('case')) test = this.expression();
      else this.consume('default', 'RW2030', 'Expected "case" or "default".');
      this.consume('=>', 'RW2031', 'Expected "=>" after match case.');
      const body = this.block();
      cases.push({ test, body, ...this.span(caseStart, this.previous()) });
    }
    this.consume('}', 'RW2032', 'Expected "}" after match.');
    return { kind: 'MatchStatement', value, cases, ...this.span(start, this.previous()) };
  }

  private expression(): Expression { return this.assignment(); }

  private assignment(): Expression {
    const target = this.binary(1);
    if (!this.match('=')) return target;
    const value = this.assignment();
    if (target.kind !== 'IdentifierExpression' && target.kind !== 'MemberExpression' && target.kind !== 'IndexExpression') {
      this.error(this.previous(), 'RW2033', 'Invalid assignment target.');
    }
    return { kind: 'AssignmentExpression', target, value, ...this.expressionSpan(target, value) } satisfies AssignmentExpression;
  }

  private binary(minimum: number): Expression {
    let left = this.unary();
    while ((precedence[this.peek().kind] ?? 0) >= minimum) {
      const operator = this.advance();
      const right = this.binary((precedence[operator.kind] ?? 0) + 1);
      left = {
        kind: 'BinaryExpression', left, operator: operator.lexeme, right,
        ...this.expressionSpan(left, right),
      } satisfies BinaryExpression;
    }
    return left;
  }

  private unary(): Expression {
    if (this.match('!', '-')) {
      const operator = this.previous();
      const operand = this.unary();
      return {
        kind: 'UnaryExpression', operator: operator.kind as '!' | '-', operand,
        ...this.span(operator, operand),
      } satisfies UnaryExpression;
    }
    return this.postfix(this.primary());
  }

  private postfix(initial: Expression): Expression {
    let expression = initial;
    for (;;) {
      if (this.match('(')) {
        const args = this.argumentsAfterOpen();
        expression = { kind: 'CallExpression', callee: expression, arguments: args, ...this.span(expression, this.previous()) } satisfies CallExpression;
      } else if (this.match('.')) {
        const property = this.consume('identifier', 'RW2034', 'Expected a property name after ".".');
        expression = { kind: 'MemberExpression', object: expression, property: property.lexeme, ...this.span(expression, property) } satisfies MemberExpression;
      } else if (this.match('[')) {
        const index = this.expression();
        const end = this.consume(']', 'RW2035', 'Expected "]" after index.');
        expression = { kind: 'IndexExpression', object: expression, index, ...this.span(expression, end) } satisfies IndexExpression;
      } else break;
    }
    return expression;
  }

  private primary(): Expression {
    const token = this.advance();
    if (token.kind === 'number' || token.kind === 'string' || token.kind === 'duration' || token.kind === 'regex'
      || token.kind === 'true' || token.kind === 'false' || token.kind === 'null') {
      const literalType = token.kind === 'string' ? 'text'
        : token.kind === 'number' ? 'num'
        : token.kind === 'duration' ? 'time'
        : token.kind === 'regex' ? 'regex'
        : token.kind === 'null' ? 'null' : 'bool';
      return { kind: 'LiteralExpression', value: token.value ?? null, literalType, ...this.span(token, token) } satisfies LiteralExpression;
    }
    if (token.kind === 'identifier' || token.kind === 'self' || token.kind === 'super'
      || callableTypeTokens.has(token.kind)) {
      return { kind: 'IdentifierExpression', name: token.lexeme, ...this.span(token, token) } satisfies IdentifierExpression;
    }
    if (token.kind === 'new') {
      const name = this.consume('identifier', 'RW2036', 'Expected a class name after "new".');
      this.consume('(', 'RW2037', 'Expected "(" after class name.');
      const args = this.argumentsAfterOpen();
      return { kind: 'NewExpression', className: name.lexeme, arguments: args, ...this.span(token, this.previous()) } satisfies NewExpression;
    }
    if (token.kind === '(') {
      const expression = this.expression();
      this.consume(')', 'RW2038', 'Expected ")" after expression.');
      return expression;
    }
    if (token.kind === '[') {
      const elements: Expression[] = [];
      if (!this.check(']')) do { elements.push(this.expression()); } while (this.match(','));
      const end = this.consume(']', 'RW2039', 'Expected "]" after list.');
      return { kind: 'ArrayExpression', elements, ...this.span(token, end) } satisfies ArrayExpression;
    }
    if (token.kind === '{') {
      const entries: DictionaryEntry[] = [];
      if (!this.check('}')) {
        do {
          const key = this.advance();
          if (key.kind !== 'identifier' && key.kind !== 'string') {
            this.error(key, 'RW2040', 'Expected a dictionary key.');
            throw new ParseFailure();
          }
          this.consume(':', 'RW2041', 'Expected ":" after dictionary key.');
          entries.push({ key: String(key.value ?? key.lexeme), value: this.expression() });
        } while (this.match(','));
      }
      const end = this.consume('}', 'RW2042', 'Expected "}" after dictionary.');
      return { kind: 'DictionaryExpression', entries, ...this.span(token, end) } satisfies DictionaryExpression;
    }
    this.error(token, 'RW2043', 'Expected an expression.');
    throw new ParseFailure();
  }

  private argumentsAfterOpen(): Expression[] {
    const args: Expression[] = [];
    if (!this.check(')')) do { args.push(this.expression()); } while (this.match(','));
    this.consume(')', 'RW2044', 'Expected ")" after arguments.');
    return args;
  }

  private syntheticType(name: string, token: Token): TypeNode {
    return { name, arguments: [], nullable: false, ...this.span(token, token) };
  }

  private consume(kind: TokenKind, code: string, message: string): Token {
    if (this.check(kind)) return this.advance();
    this.error(this.peek(), code, message);
    throw new ParseFailure();
  }

  private error(token: Token, code: string, message: string): void {
    this.diagnostics.push({ severity: 'error', code, message, ...this.span(token, token) });
  }

  private synchronize(): void {
    while (!this.check('eof')) {
      if (this.previousOr(this.peek()).kind === ';') return;
      if (['class', 'let', 'if', 'loop', 'return', 'try', 'match'].includes(this.peek().kind)) return;
      this.advance();
    }
  }

  private match(...kinds: TokenKind[]): boolean {
    for (const kind of kinds) if (this.check(kind)) { this.advance(); return true; }
    return false;
  }

  private check(kind: TokenKind): boolean { return this.peek().kind === kind; }
  private advance(): Token { if (!this.check('eof')) this.current++; return this.previous(); }
  private peek(): Token { return this.tokens[this.current]!; }
  private peekNext(): Token { return this.tokens[Math.min(this.current + 1, this.tokens.length - 1)]!; }
  private previous(): Token { return this.tokens[Math.max(0, this.current - 1)]!; }
  private previousOr(fallback: Token): Token { return this.current > 0 ? this.previous() : fallback; }

  private span(start: SourceSpan, end: SourceSpan): SourceSpan {
    return { start: start.start, end: end.end, line: start.line, column: start.column };
  }
  private expressionSpan(start: Expression, end: Expression): SourceSpan { return this.span(start, end); }
}

class ParseFailure extends Error {}
