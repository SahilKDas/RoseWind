export interface DiagnosticGuide {
  readonly code: string;
  readonly title: string;
  readonly explanation: string;
  readonly repair: string;
}

export const diagnosticGuides: readonly DiagnosticGuide[] = [
  { code: 'RW1001', title: 'Unclosed block comment', explanation: 'A comment beginning with /* must eventually end with */.', repair: 'Add */ after the final line of the comment.' },
  { code: 'RW1002', title: 'Unclosed text or regex', explanation: 'A quoted literal reached the end of the file before its closing quote.', repair: 'Add a matching quote, or escape a quote that belongs inside the value.' },
  { code: 'RW2007', title: 'Field needs a semicolon', explanation: 'Class field declarations use a semicolon as a clear boundary.', repair: 'Insert ; immediately after the closing ) in the field declaration.' },
  { code: 'RW2014', title: 'Variable needs a semicolon', explanation: 'Every let declaration must end before the next statement begins.', repair: 'Insert ; after the type or initial value.' },
  { code: 'RW2016', title: 'Expression needs a semicolon', explanation: 'Calls, assignments, and other standalone expressions end with semicolons.', repair: 'Insert ; after the expression.' },
  { code: 'RW2022', title: 'Return needs a semicolon', explanation: 'A return statement has the same explicit boundary as other statements.', repair: 'Use return(value); or return(); and keep the final semicolon.' },
  { code: 'RW2101', title: 'Legacy class header', explanation: 'v0.2 puts class names inside punctuation so whitespace never separates tokens.', repair: 'Use class(Name) or class(Child:Parent), or apply Convert document to v0.2.' },
  { code: 'RW2109', title: 'Legacy line comment', explanation: '// depends on a newline, while v0.2 whitespace is never significant.', repair: 'Convert the comment to /* comment */.' },
  { code: 'RW2110', title: 'Legacy variable declaration', explanation: 'v0.2 wraps variable declarations so their boundary is punctuation.', repair: 'Use let(name:type=value);.' },
  { code: 'RW2111', title: 'Legacy field declaration', explanation: 'v0.2 fields use name-first type annotations.', repair: 'Use pub(name:type); or priv(name:type);.' },
  { code: 'RW2112', title: 'Legacy method signature', explanation: 'v0.2 wraps the complete method signature after its access modifier.', repair: 'Use pub(name(parameters)->type) { ... }.' },
  { code: 'RW2113', title: 'Legacy object creation', explanation: 'v0.2 places the class name inside the new expression punctuation.', repair: 'Use new(Class, arguments).' },
  { code: 'RW2114', title: 'Legacy loop header', explanation: 'Every v0.2 loop header is parenthesized.', repair: 'Use loop(item:values), loop(condition), or loop().' },
  { code: 'RW2115', title: 'Legacy return value', explanation: 'v0.2 return values are punctuation-delimited.', repair: 'Use return(value);.' },
  { code: 'RW2116', title: 'Legacy match branch', explanation: 'v0.2 case values are parenthesized and no longer use =>.', repair: 'Use case(value) { ... } or default { ... }.' },
  { code: 'RW2117', title: 'Unparenthesized condition', explanation: 'v0.2 requires punctuation around if and match conditions.', repair: 'Wrap the condition in parentheses.' },  { code: 'RW3006', title: 'Unknown name', explanation: 'No visible declaration matches the name at this location.', repair: 'Check spelling and scope. The editor offers a repair only when one match is unambiguous.' },
  { code: 'RW3007', title: 'Unknown member', explanation: 'The object type does not declare the requested field or method.', repair: 'Check the member spelling and the type of the expression before the dot.' },
  { code: 'RW3008', title: 'Private member access', explanation: 'priv state is intentionally hidden from code outside its class.', repair: 'Use a public method that exposes the required behavior.' },
  { code: 'RW3011', title: 'Unknown type', explanation: 'The type is neither built in nor declared as a class in this file.', repair: 'Check the type spelling or declare the class before using it.' },
  { code: 'RW3013', title: 'Type mismatch', explanation: 'The value type cannot safely be assigned to the expected type.', repair: 'Change the value, change the declaration, or make the type nullable when null is intentional.' },
  { code: 'RW3014', title: 'Duplicate name', explanation: 'A scope cannot contain two declarations with the same name.', repair: 'Rename one declaration or remove the duplicate.' },
];
