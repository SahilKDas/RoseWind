export interface DiagnosticGuide {
  readonly code: string;
  readonly title: string;
  readonly explanation: string;
  readonly repair: string;
}

export const diagnosticGuides: readonly DiagnosticGuide[] = [
  { code: 'RW1001', title: 'Unclosed block comment', explanation: 'A comment beginning with /* must eventually end with */.', repair: 'Add */ after the final line of the comment.' },
  { code: 'RW1002', title: 'Unclosed text or regex', explanation: 'A quoted literal reached the end of the file before its closing quote.', repair: 'Add a matching quote, or escape a quote that belongs inside the value.' },
  { code: 'RW2007', title: 'Field needs a semicolon', explanation: 'Class field declarations use a semicolon as a clear boundary.', repair: 'Insert ; immediately after the field type.' },
  { code: 'RW2014', title: 'Variable needs a semicolon', explanation: 'Every let declaration must end before the next statement begins.', repair: 'Insert ; after the closing parenthesis.' },
  { code: 'RW2016', title: 'Expression needs a semicolon', explanation: 'Calls, assignments, and other standalone expressions end with semicolons.', repair: 'Insert ; after the expression.' },
  { code: 'RW2022', title: 'Return needs a semicolon', explanation: 'A return statement has the same explicit boundary as other statements.', repair: 'Use return(value); or return(); and keep the final semicolon.' },
  { code: 'RW2201', title: 'Class header needs parentheses', explanation: 'Class names live inside punctuation so spaces can never change a program.', repair: 'Use class(Name) or class(Child:Parent).' },
  { code: 'RW2202', title: 'Access marker needs parentheses', explanation: 'pub and priv wrap the member they describe.', repair: 'Use priv(name:type); or priv(method()).' },
  { code: 'RW2203', title: 'Class member expected', explanation: 'A class body can contain a field, method, or create constructor.', repair: 'Use name:type;, method() { ... }, or create(...) { ... }.' },
  { code: 'RW2204', title: 'Parameter needs a type', explanation: 'Method inputs are named first and then given a type.', repair: 'Write name:type inside the parameter list.' },
  { code: 'RW2205', title: 'Variable needs parentheses', explanation: 'let wraps a variable declaration so whitespace remains cosmetic.', repair: 'Use let(name=value); or let(name:type=value);.' },
  { code: 'RW2206', title: 'If needs parentheses', explanation: 'An if question is always enclosed in parentheses.', repair: 'Use if(condition) { ... }.' },
  { code: 'RW2207', title: 'Loop needs parentheses', explanation: 'A loop header is enclosed in punctuation.', repair: 'Use loop(item:values), loop(condition), or loop().' },
  { code: 'RW2208', title: 'Return needs parentheses', explanation: 'A returned value is enclosed in punctuation.', repair: 'Use return(value); or return();.' },
  { code: 'RW2209', title: 'Line comments are not supported', explanation: '// depends on a newline, but RoseWind ignores whitespace completely.', repair: 'Use /* comment */.' },
  { code: 'RW2210', title: 'Match needs parentheses', explanation: 'The value being matched is enclosed in punctuation.', repair: 'Use match(value) { ... }.' },
  { code: 'RW2211', title: 'Case needs parentheses', explanation: 'Each case value is enclosed in punctuation.', repair: 'Use case(value) { ... }.' },
  { code: 'RW2212', title: 'New needs parentheses', explanation: 'The class and constructor inputs live inside new(...).', repair: 'Use new(Class, arguments).' },
  { code: 'RW3006', title: 'Unknown name', explanation: 'No visible declaration matches the name at this location.', repair: 'Check spelling and scope. The editor offers a repair only when one match is unambiguous.' },
  { code: 'RW3007', title: 'Unknown member', explanation: 'The object type does not declare the requested field or method.', repair: 'Check the member spelling and the type of the expression before the dot.' },
  { code: 'RW3008', title: 'Private member access', explanation: 'priv state is intentionally hidden from code outside its class.', repair: 'Use a public method that exposes the required behavior.' },
  { code: 'RW3011', title: 'Unknown type', explanation: 'The type is neither built in nor declared as a class in this file.', repair: 'Check the type spelling or declare the class before using it.' },
  { code: 'RW3013', title: 'Type mismatch', explanation: 'The value type cannot safely be assigned to the expected type.', repair: 'Change the value, change the declaration, or make the type nullable when null is intentional.' },
  { code: 'RW3014', title: 'Duplicate name', explanation: 'A scope cannot contain two declarations with the same name.', repair: 'Rename one declaration or remove the duplicate.' },
];