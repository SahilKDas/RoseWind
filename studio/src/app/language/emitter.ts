import {
  BlockStatement, ClassDeclaration, Expression, MatchStatement, MethodDeclaration,
  Program, Statement, VariableDeclaration,
} from './ast';

export class JavaScriptEmitter {
  private indent = 0;
  private matchIndex = 0;

  emit(program: Program): string {
    return program.declarations.map((item) => item.kind === 'ClassDeclaration'
      ? this.classDeclaration(item)
      : this.statement(item)).join('\n\n');
  }

  private classDeclaration(declaration: ClassDeclaration): string {
    const header = `class ${declaration.name}${declaration.parent ? ` extends ${declaration.parent}` : ''} {`;
    this.indent++;
    const members = declaration.members.map((member) => {
      if (member.kind === 'FieldDeclaration') return `${this.pad()}${member.name};`;
      return this.method(member, declaration);
    }).join('\n\n');
    this.indent--;
    return `${header}\n${members}\n${this.pad()}}`;
  }

  private method(method: MethodDeclaration, owner: ClassDeclaration): string {
    const parameters = method.parameters.map((parameter) => parameter.name).join(', ');
    const name = method.constructor ? 'constructor' : method.name;
    const asyncPrefix = method.constructor ? '' : 'async ';
    const injectedSuper = method.constructor && owner.parent && !this.callsSuperCreate(method.body)
      ? `${this.pad(1)}super();\n`
      : '';
    return `${this.pad()}${asyncPrefix}${name}(${parameters}) {\n${injectedSuper}${this.blockContents(method.body)}\n${this.pad()}}`;
  }

  private callsSuperCreate(block: BlockStatement): boolean {
    return block.statements.some((statement) => statement.kind === 'ExpressionStatement'
      && statement.expression.kind === 'CallExpression'
      && statement.expression.callee.kind === 'MemberExpression'
      && statement.expression.callee.object.kind === 'IdentifierExpression'
      && statement.expression.callee.object.name === 'super'
      && statement.expression.callee.property === 'create');
  }

  private statement(statement: Statement): string {
    switch (statement.kind) {
      case 'BlockStatement': return this.block(statement);
      case 'VariableDeclaration': return `${this.pad()}${this.variable(statement)};`;
      case 'ExpressionStatement': return `${this.pad()}${this.expression(statement.expression)};`;
      case 'IfStatement': {
        const alternate = statement.elseBranch ? ` else ${this.statementBody(statement.elseBranch)}` : '';
        return `${this.pad()}if (${this.expression(statement.condition)}) ${this.statementBody(statement.thenBranch)}${alternate}`;
      }
      case 'LoopStatement': {
        if (statement.variable && statement.iterable) {
          return `${this.pad()}for (const ${statement.variable} of ${this.expression(statement.iterable)}) ${this.statementBody(statement.body)}`;
        }
        return `${this.pad()}while (${statement.condition ? this.expression(statement.condition) : 'true'}) ${this.statementBody(statement.body)}`;
      }
      case 'ReturnStatement': return `${this.pad()}return${statement.value ? ` ${this.expression(statement.value)}` : ''};`;
      case 'BreakStatement': return `${this.pad()}break;`;
      case 'ContinueStatement': return `${this.pad()}continue;`;
      case 'TryStatement':
        return `${this.pad()}try ${this.block(statement.body)} catch (${statement.errorName}) ${this.block(statement.catchBody)}`;
      case 'MatchStatement': return this.match(statement);
    }
  }

  private variable(declaration: VariableDeclaration): string {
    const initial = declaration.initializer ? this.expression(declaration.initializer) : this.defaultValue(declaration.type?.name);
    const wrapped = declaration.type ? this.wrapTypedInitial(declaration.type.name, initial) : initial;
    return `let ${declaration.name} = ${wrapped}`;
  }

  private wrapTypedInitial(name: string, value: string): string {
    if (name === 'decimal') return `decimal(${value})`;
    if (name === 'bytes') return `bytes(${value})`;
    if (name === 'set') return `set(${value})`;
    if (name === 'date') return `date(${value})`;
    return value;
  }

  private defaultValue(typeName?: string): string {
    if (typeName === 'text') return `''`;
    if (typeName === 'num' || typeName === 'time' || typeName === 'decimal') return '0';
    if (typeName === 'bool') return 'false';
    if (typeName === 'list') return '[]';
    if (typeName === 'dict') return '{}';
    if (typeName === 'set') return '[]';
    if (typeName === 'bytes') return '[]';
    if (typeName === 'date') return 'undefined';
    if (typeName === 'id') return 'id()';
    return 'null';
  }

  private block(block: BlockStatement): string {
    return `{\n${this.blockContents(block)}\n${this.pad()}}`;
  }

  private blockContents(block: BlockStatement): string {
    this.indent++;
    const contents = block.statements.map((statement) => this.statement(statement)).join('\n');
    this.indent--;
    return contents;
  }

  private statementBody(statement: Statement): string {
    if (statement.kind === 'BlockStatement') return this.block(statement);
    this.indent++;
    const emitted = `{\n${this.statement(statement)}\n${this.pad(-1)}}`;
    this.indent--;
    return emitted;
  }

  private match(statement: MatchStatement): string {
    const temporary = `__match${this.matchIndex++}`;
    const lines = [`${this.pad()}{`, `${this.pad(1)}const ${temporary} = ${this.expression(statement.value)};`];
    statement.cases.forEach((item, index) => {
      const keyword = index === 0 ? 'if' : 'else if';
      if (item.test) lines.push(`${this.pad(1)}${keyword} (${temporary} === ${this.expression(item.test)}) ${this.block(item.body)}`);
      else lines.push(`${this.pad(1)}else ${this.block(item.body)}`);
    });
    lines.push(`${this.pad()}}`);
    return lines.join('\n');
  }

  private expression(expression: Expression): string {
    switch (expression.kind) {
      case 'LiteralExpression':
        if (expression.literalType === 'regex') return `new RegExp(${JSON.stringify(expression.value)})`;
        return JSON.stringify(expression.value);
      case 'IdentifierExpression': return expression.name === 'self' ? 'this' : expression.name;
      case 'ArrayExpression': return `[${expression.elements.map((item) => this.expression(item)).join(', ')}]`;
      case 'DictionaryExpression': return `{ ${expression.entries.map((entry) => `${JSON.stringify(entry.key)}: ${this.expression(entry.value)}`).join(', ')} }`;
      case 'UnaryExpression': return `(${expression.operator}${this.expression(expression.operand)})`;
      case 'BinaryExpression': {
        const native = ['&&', '||'].includes(expression.operator);
        return native
          ? `(${this.expression(expression.left)} ${expression.operator} ${this.expression(expression.right)})`
          : `__binary(${JSON.stringify(expression.operator)}, ${this.expression(expression.left)}, ${this.expression(expression.right)})`;
      }
      case 'AssignmentExpression': return `(${this.expression(expression.target)} = ${this.expression(expression.value)})`;
      case 'MemberExpression': return `${this.expression(expression.object)}.${expression.property}`;
      case 'IndexExpression': return `${this.expression(expression.object)}[${this.expression(expression.index)}]`;
      case 'CallExpression': {
        if (expression.callee.kind === 'MemberExpression'
          && expression.callee.object.kind === 'IdentifierExpression'
          && expression.callee.object.name === 'super'
          && expression.callee.property === 'create') {
          return `super(${expression.arguments.map((item) => this.expression(item)).join(', ')})`;
        }
        return `(await ${this.expression(expression.callee)}(${expression.arguments.map((item) => this.expression(item)).join(', ')}))`;
      }
      case 'NewExpression': return `new ${expression.className}(${expression.arguments.map((item) => this.expression(item)).join(', ')})`;
    }
  }

  private pad(offset = 0): string { return '  '.repeat(Math.max(0, this.indent + offset)); }
}
