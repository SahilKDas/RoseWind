# Architecture

## Rendering boundary

Angular's server route configuration is the source of truth:

| Route | Render mode | Purpose |
| --- | --- | --- |
| `/` | Server | Search-indexable overview, example, and sign-in |
| `/learn` | Server | Complete indexable language reference |
| `/editor` | Client | Authenticated interactive workbench |
| fallback | Server | Public redirects and metadata |

Client hydration uses event replay on server-rendered pages. The editor is lazy-loaded and protected by a browser-side guard. The preview login is intentionally local-first; production identity can replace `AuthService` without changing the render boundary.

## Compiler pipeline

```text
RoseWind source
  -> WhitespaceNormalizer (literal-aware compaction, original offset map)
  -> Lexer (tokens, comments, mapped source spans)
  -> Parser (typed AST, Pratt expressions)
  -> TypeChecker (scopes, classes, privacy, nullability, generics)
  -> JavaScriptEmitter (modern async JavaScript)
  -> Browser Worker or Node CLI runtime
```

Every diagnostic carries a stable code, severity, byte range, line, and column. JavaScript is emitted only when lexical, syntactic, and type diagnostics contain no errors.

## Runtime isolation

Browser programs run in a dedicated Web Worker made from a short-lived Blob URL. Output is message-based, execution is terminated after five seconds, and the URL is revoked after completion. User code does not execute in Angular's UI context.

The standard runtime provides `print`, `input`, `len`, `range`, casts, JSON helpers, `wait`, `web.fetch`, `math.random`, type inspection, dates, bytes, sets, UUIDs, and fixed-point decimals.

## Decimal representation

`decimal` parses a decimal string into a signed `BigInt` coefficient plus a scale. Addition, subtraction, multiplication, modulo, and comparisons align scales without floating-point conversion. Division produces a deterministic result with up to 18 fractional places.

## Web-native editor

The workbench is implemented entirely with Angular and CodeMirror. Project navigation, tabs, editing, IntelliSense, syntax highlighting, diagnostics, output, and commands run as browser-native components and use the shared RoseWind compiler directly.
