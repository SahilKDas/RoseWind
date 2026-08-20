import {
  BlockStatement, ClassDeclaration, ClassMember, Expression, MethodDeclaration,
  Program, Statement, TypeNode, VariableDeclaration,
} from './ast';
import { Diagnostic, SourceSpan } from './tokens';

export interface RoseType {
  readonly name: string;
  readonly arguments: readonly RoseType[];
  readonly nullable: boolean;
}

interface ClassSymbol {
  readonly declaration: ClassDeclaration;
  readonly members: Map<string, ClassMember>;
}

const primitiveTypes = new Set([
  'text', 'num', 'bool', 'void', 'any', 'date', 'time', 'bytes', 'decimal',
  'id', 'regex', 'null',
]);

const builtins: Readonly<Record<string, RoseType>> = {
  print: type('void'), input: type('text'), len: type('num'), range: type('list', [type('num')]),
  str: type('text'), num: type('num'), toJSON: type('text'), parseJSON: type('any'),
  wait: type('void'), typeOf: type('text'), date: type('date'), bytes: type('bytes'),
  decimal: type('decimal'), id: type('id'), set: type('set', [type('any')]),
  web: type('any'), math: type('any'),
};

function type(name: string, args: readonly RoseType[] = [], nullable = false): RoseType {
  return { name, arguments: args, nullable };
}

export class TypeChecker {
  private readonly diagnostics: Diagnostic[] = [];
  private readonly classes = new Map<string, ClassSymbol>();
  private scopes: Map<string, RoseType>[] = [new Map(Object.entries(builtins))];
  private currentClass?: ClassSymbol;
  private returnType?: RoseType;
  private loopDepth = 0;

  check(program: Program): readonly Diagnostic[] {
    for (const item of program.declarations) {
      if (item.kind !== 'ClassDeclaration') continue;
      if (this.classes.has(item.name)) this.report(item, 'RW3001', `Class "${item.name}" is already declared.`);
      const members = new Map<string, ClassMember>();
      for (const member of item.members) {
        if (members.has(member.name)) this.report(member, 'RW3002', `Member "${member.name}" is already declared in ${item.name}.`);
        members.set(member.name, member);
      }
      this.classes.set(item.name, { declaration: item, members });
    }

    for (const [name] of this.classes) this.scopes[0]!.set(name, type(name));
    for (const item of program.declarations) {
      if (item.kind === 'ClassDeclaration') this.checkClass(item);
      else this.checkStatement(item);
    }
    return this.diagnostics;
  }

  private checkClass(declaration: ClassDeclaration): void {
    const symbol = this.classes.get(declaration.name)!;
    if (declaration.parent && !this.classes.has(declaration.parent)) {
      this.report(declaration, 'RW3003', `Unknown parent class "${declaration.parent}".`);
    }
    this.currentClass = symbol;
    for (const member of declaration.members) {
      if (member.kind === 'FieldDeclaration') this.validateType(member.type);
      else this.checkMethod(member);
    }
    this.currentClass = undefined;
  }

  private checkMethod(method: MethodDeclaration): void {
    this.validateType(method.returnType);
    this.pushScope();
    this.define('self', type(this.currentClass!.declaration.name), method);
    if (this.currentClass!.declaration.parent) this.define('super', type(this.currentClass!.declaration.parent), method);
    for (const parameter of method.parameters) {
      this.validateType(parameter.type);
      this.define(parameter.name, this.fromNode(parameter.type), parameter);
    }
    const previousReturn = this.returnType;
    this.returnType = this.fromNode(method.returnType);
    this.checkBlock(method.body, false);
    this.returnType = previousReturn;
    this.popScope();
  }

  private checkStatement(statement: Statement): void {
    switch (statement.kind) {
      case 'BlockStatement': this.checkBlock(statement); break;
      case 'VariableDeclaration': this.checkVariable(statement); break;
      case 'ExpressionStatement': this.expressionType(statement.expression); break;
      case 'IfStatement': {
        this.require(this.expressionType(statement.condition), type('bool'), statement.condition, 'If conditions must be bool.');
        this.checkStatement(statement.thenBranch);
        if (statement.elseBranch) this.checkStatement(statement.elseBranch);
        break;
      }
      case 'LoopStatement': {
        this.loopDepth++;
        this.pushScope();
        if (statement.iterable && statement.variable) {
          const iterable = this.expressionType(statement.iterable);
          const itemType = iterable.arguments[0] ?? type('any');
          this.define(statement.variable, itemType, statement);
        }
        if (statement.condition) this.require(this.expressionType(statement.condition), type('bool'), statement.condition, 'Loop conditions must be bool.');
        this.checkStatement(statement.body);
        this.popScope();
        this.loopDepth--;
        break;
      }
      case 'ReturnStatement': {
        if (!this.returnType) this.report(statement, 'RW3004', 'Return can only be used inside a method.');
        else {
          const actual = statement.value ? this.expressionType(statement.value) : type('void');
          this.require(actual, this.returnType, statement, `Return type must be ${display(this.returnType)}.`);
        }
        break;
      }
      case 'BreakStatement':
      case 'ContinueStatement':
        if (this.loopDepth === 0) this.report(statement, 'RW3005', `${statement.kind === 'BreakStatement' ? 'break' : 'continue'} can only be used inside a loop.`);
        break;
      case 'TryStatement':
        this.checkBlock(statement.body);
        this.pushScope();
        this.define(statement.errorName, type('any'), statement);
        this.checkBlock(statement.catchBody, false);
        this.popScope();
        break;
      case 'MatchStatement':
        this.expressionType(statement.value);
        for (const item of statement.cases) {
          if (item.test) this.expressionType(item.test);
          this.checkBlock(item.body);
        }
        break;
    }
  }

  private checkBlock(block: BlockStatement, ownScope = true): void {
    if (ownScope) this.pushScope();
    for (const statement of block.statements) this.checkStatement(statement);
    if (ownScope) this.popScope();
  }

  private checkVariable(declaration: VariableDeclaration): void {
    const declared = declaration.type ? this.fromNode(declaration.type) : undefined;
    if (declaration.type) this.validateType(declaration.type);
    const actual = declaration.initializer ? this.expressionType(declaration.initializer) : undefined;
    if (declared && actual) this.require(actual, declared, declaration.initializer!, `Cannot assign ${display(actual)} to ${display(declared)}.`);
    this.define(declaration.name, declared ?? actual ?? type('any'), declaration);
  }

  private expressionType(expression: Expression): RoseType {
    switch (expression.kind) {
      case 'LiteralExpression': return type(expression.literalType, [], expression.literalType === 'null');
      case 'IdentifierExpression': {
        const found = this.lookup(expression.name);
        if (!found) {
          this.report(expression, 'RW3006', `Unknown name "${expression.name}".`);
          return type('any');
        }
        return found;
      }
      case 'ArrayExpression': {
        const first = expression.elements[0] ? this.expressionType(expression.elements[0]) : type('any');
        for (const item of expression.elements.slice(1)) this.expressionType(item);
        return type('list', [first]);
      }
      case 'DictionaryExpression':
        for (const entry of expression.entries) this.expressionType(entry.value);
        return type('dict', [type('text'), type('any')]);
      case 'UnaryExpression': {
        const operand = this.expressionType(expression.operand);
        const expected = expression.operator === '!' ? type('bool') : type('num');
        this.require(operand, expected, expression.operand, `Operator ${expression.operator} expects ${expected.name}.`);
        return expected;
      }
      case 'BinaryExpression': {
        const left = this.expressionType(expression.left);
        const right = this.expressionType(expression.right);
        if (['==', '!=', '<', '<=', '>', '>='].includes(expression.operator)) return type('bool');
        if (['&&', '||'].includes(expression.operator)) {
          this.require(left, type('bool'), expression.left, 'Logical operators expect bool operands.');
          this.require(right, type('bool'), expression.right, 'Logical operators expect bool operands.');
          return type('bool');
        }
        if (expression.operator === '+' && (left.name === 'text' || right.name === 'text')) return type('text');
        if (left.name === 'decimal' || right.name === 'decimal') {
          if (!['decimal', 'num'].includes(left.name)) this.report(expression.left, 'RW3015', `Operator ${expression.operator} expects decimal or num operands.`);
          if (!['decimal', 'num'].includes(right.name)) this.report(expression.right, 'RW3015', `Operator ${expression.operator} expects decimal or num operands.`);
          return type('decimal');
        }
        this.require(left, type('num'), expression.left, `Operator ${expression.operator} expects num operands.`);
        this.require(right, type('num'), expression.right, `Operator ${expression.operator} expects num operands.`);
        return type('num');
      }
      case 'AssignmentExpression': {
        const target = this.expressionType(expression.target);
        const value = this.expressionType(expression.value);
        this.require(value, target, expression.value, `Cannot assign ${display(value)} to ${display(target)}.`);
        return target;
      }
      case 'MemberExpression': {
        const object = this.expressionType(expression.object);
        if (object.name === 'any') return type('any');
        const owner = this.findMemberOwner(object.name, expression.property);
        const member = owner?.members.get(expression.property);
        if (!member) {
          this.report(expression, 'RW3007', `Type ${object.name} has no member "${expression.property}".`);
          return type('any');
        }
        if (member.access === 'priv' && owner !== this.currentClass) {
          this.report(expression, 'RW3008', `Member "${expression.property}" is private.`);
        }
        return member.kind === 'FieldDeclaration' ? this.fromNode(member.type) : this.fromNode(member.returnType);
      }
      case 'IndexExpression': {
        const object = this.expressionType(expression.object);
        this.expressionType(expression.index);
        return object.arguments.at(-1) ?? type('any');
      }
      case 'CallExpression':
        for (const argument of expression.arguments) this.expressionType(argument);
        return this.expressionType(expression.callee);
      case 'NewExpression': {
        const klass = this.classes.get(expression.className);
        if (!klass) this.report(expression, 'RW3009', `Unknown class "${expression.className}".`);
        for (const argument of expression.arguments) this.expressionType(argument);
        const constructor = klass?.members.get('create');
        if (constructor?.kind === 'MethodDeclaration' && constructor.parameters.length !== expression.arguments.length) {
          this.report(expression, 'RW3010', `${expression.className} expects ${constructor.parameters.length} constructor argument(s).`);
        }
        return type(expression.className);
      }
    }
  }

  private findMemberOwner(className: string, memberName: string): ClassSymbol | undefined {
    let symbol = this.classes.get(className);
    while (symbol) {
      if (symbol.members.has(memberName)) return symbol;
      symbol = symbol.declaration.parent ? this.classes.get(symbol.declaration.parent) : undefined;
    }
    return undefined;
  }

  private validateType(node: TypeNode): void {
    const known = primitiveTypes.has(node.name) || node.name === 'list' || node.name === 'dict'
      || node.name === 'set' || this.classes.has(node.name);
    if (!known) this.report(node, 'RW3011', `Unknown type "${node.name}".`);
    const expectedArgs = node.name === 'dict' ? 2 : node.name === 'list' || node.name === 'set' ? 1 : 0;
    if (node.arguments.length !== expectedArgs) {
      this.report(node, 'RW3012', `${node.name} expects ${expectedArgs} type argument(s).`);
    }
    for (const argument of node.arguments) this.validateType(argument);
  }

  private require(actual: RoseType, expected: RoseType, span: SourceSpan, message: string): void {
    if (!assignable(actual, expected)) this.report(span, 'RW3013', message);
  }

  private fromNode(node: TypeNode): RoseType {
    return type(node.name, node.arguments.map((item) => this.fromNode(item)), node.nullable);
  }

  private define(name: string, value: RoseType, span: SourceSpan): void {
    const scope = this.scopes.at(-1)!;
    if (scope.has(name)) this.report(span, 'RW3014', `Name "${name}" is already declared in this scope.`);
    scope.set(name, value);
  }

  private lookup(name: string): RoseType | undefined {
    for (let index = this.scopes.length - 1; index >= 0; index--) {
      const value = this.scopes[index]!.get(name);
      if (value) return value;
    }
    return undefined;
  }

  private pushScope(): void { this.scopes.push(new Map()); }
  private popScope(): void { this.scopes.pop(); }
  private report(span: SourceSpan, code: string, message: string): void {
    this.diagnostics.push({ severity: 'error', code, message, ...span });
  }
}

function assignable(actual: RoseType, expected: RoseType): boolean {
  if (actual.name === 'any' || expected.name === 'any') return true;
  if (actual.name === 'null') return expected.nullable;
  if (actual.name !== expected.name || actual.arguments.length !== expected.arguments.length) return false;
  return actual.arguments.every((argument, index) => assignable(argument, expected.arguments[index]!));
}

function display(value: RoseType): string {
  const generics = value.arguments.length ? `<${value.arguments.map(display).join(', ')}>` : '';
  return `${value.name}${generics}${value.nullable ? '?' : ''}`;
}
