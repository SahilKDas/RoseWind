import { SourceSpan } from './tokens';

export interface TypeNode extends SourceSpan {
  readonly name: string;
  readonly arguments: readonly TypeNode[];
  readonly nullable: boolean;
}

export interface Parameter extends SourceSpan {
  readonly name: string;
  readonly type: TypeNode;
}

export type Declaration = ClassDeclaration | VariableDeclaration;

export interface Program extends SourceSpan {
  readonly kind: 'Program';
  readonly declarations: readonly (Declaration | Statement)[];
}

export interface ClassDeclaration extends SourceSpan {
  readonly kind: 'ClassDeclaration';
  readonly name: string;
  readonly parent?: string;
  readonly members: readonly ClassMember[];
}

export type ClassMember = FieldDeclaration | MethodDeclaration;

export interface FieldDeclaration extends SourceSpan {
  readonly kind: 'FieldDeclaration';
  readonly access: 'pub' | 'priv';
  readonly name: string;
  readonly type: TypeNode;
}

export interface MethodDeclaration extends SourceSpan {
  readonly kind: 'MethodDeclaration';
  readonly access: 'pub' | 'priv';
  readonly name: string;
  readonly constructor: boolean;
  readonly parameters: readonly Parameter[];
  readonly returnType: TypeNode;
  readonly body: BlockStatement;
}

export interface VariableDeclaration extends SourceSpan {
  readonly kind: 'VariableDeclaration';
  readonly name: string;
  readonly type?: TypeNode;
  readonly initializer?: Expression;
}

export type Statement =
  | BlockStatement | ExpressionStatement | IfStatement | LoopStatement
  | ReturnStatement | BreakStatement | ContinueStatement | TryStatement
  | MatchStatement | VariableDeclaration;

export interface BlockStatement extends SourceSpan {
  readonly kind: 'BlockStatement';
  readonly statements: readonly Statement[];
}

export interface ExpressionStatement extends SourceSpan {
  readonly kind: 'ExpressionStatement';
  readonly expression: Expression;
}

export interface IfStatement extends SourceSpan {
  readonly kind: 'IfStatement';
  readonly condition: Expression;
  readonly thenBranch: Statement;
  readonly elseBranch?: Statement;
}

export interface LoopStatement extends SourceSpan {
  readonly kind: 'LoopStatement';
  readonly variable?: string;
  readonly iterable?: Expression;
  readonly condition?: Expression;
  readonly body: Statement;
}

export interface ReturnStatement extends SourceSpan {
  readonly kind: 'ReturnStatement';
  readonly value?: Expression;
}

export interface BreakStatement extends SourceSpan { readonly kind: 'BreakStatement'; }
export interface ContinueStatement extends SourceSpan { readonly kind: 'ContinueStatement'; }

export interface TryStatement extends SourceSpan {
  readonly kind: 'TryStatement';
  readonly body: BlockStatement;
  readonly errorName: string;
  readonly catchBody: BlockStatement;
}

export interface MatchCase extends SourceSpan {
  readonly test?: Expression;
  readonly body: BlockStatement;
}

export interface MatchStatement extends SourceSpan {
  readonly kind: 'MatchStatement';
  readonly value: Expression;
  readonly cases: readonly MatchCase[];
}

export type Expression =
  | LiteralExpression | IdentifierExpression | ArrayExpression | DictionaryExpression
  | UnaryExpression | BinaryExpression | AssignmentExpression | MemberExpression
  | IndexExpression | CallExpression | NewExpression;

export interface LiteralExpression extends SourceSpan {
  readonly kind: 'LiteralExpression';
  readonly value: string | number | boolean | null;
  readonly literalType: 'text' | 'num' | 'bool' | 'null' | 'time' | 'regex';
}

export interface IdentifierExpression extends SourceSpan {
  readonly kind: 'IdentifierExpression';
  readonly name: string;
}

export interface ArrayExpression extends SourceSpan {
  readonly kind: 'ArrayExpression';
  readonly elements: readonly Expression[];
}

export interface DictionaryEntry { readonly key: string; readonly value: Expression; }
export interface DictionaryExpression extends SourceSpan {
  readonly kind: 'DictionaryExpression';
  readonly entries: readonly DictionaryEntry[];
}

export interface UnaryExpression extends SourceSpan {
  readonly kind: 'UnaryExpression';
  readonly operator: '!' | '-';
  readonly operand: Expression;
}

export interface BinaryExpression extends SourceSpan {
  readonly kind: 'BinaryExpression';
  readonly left: Expression;
  readonly operator: string;
  readonly right: Expression;
}

export interface AssignmentExpression extends SourceSpan {
  readonly kind: 'AssignmentExpression';
  readonly target: Expression;
  readonly value: Expression;
}

export interface MemberExpression extends SourceSpan {
  readonly kind: 'MemberExpression';
  readonly object: Expression;
  readonly property: string;
}

export interface IndexExpression extends SourceSpan {
  readonly kind: 'IndexExpression';
  readonly object: Expression;
  readonly index: Expression;
}

export interface CallExpression extends SourceSpan {
  readonly kind: 'CallExpression';
  readonly callee: Expression;
  readonly arguments: readonly Expression[];
}

export interface NewExpression extends SourceSpan {
  readonly kind: 'NewExpression';
  readonly className: string;
  readonly arguments: readonly Expression[];
}
