# RoseWind

RoseWind is a beginner-friendly, strongly typed language designed for JIT-oriented JavaScript compilation and web targets. It combines familiar braces, parentheses, and semicolons with explicit object mechanics such as `self` and `create`. Its punctuation-first v0.2 grammar ignores whitespace outside literals and comments, while one compatibility release continues to accept v0.1 source.

This repository contains:

- an Angular 22 web studio with a browser-native IDE workbench;
- request-time server rendering for public, indexable pages;
- a guarded, client-rendered editor for signed-in humans;
- a lexer, parser, type checker, JavaScript emitter, fixed-point decimal runtime, and Web Worker runner;
- a Node command-line runner using the same compiler;

## Start the web studio

```powershell
cd studio
npm install
npm start
```

Open <http://localhost:4200>. Enter a display name on the landing page to unlock the client-only editor. This preview is local-first: the display name and saved source remain in browser storage.

## Run RoseWind from the command line

```powershell
cd studio
npm run rosewind -- ..\examples\pet.rw
npm run rosewind -- ..\examples\decimal.rw
npm run rosewind -- ..\examples\pet.rw --emit
```

## Production build

```powershell
cd studio
npm test -- --watch=false
npm run build
npm run serve:ssr:studio
```

The public overview and language reference use `RenderMode.Server`. The `/editor` route uses `RenderMode.Client`, keeping the interactive compiler out of bot-facing HTML and the initial public bundle.
For production SSR, set `NG_ALLOWED_HOSTS` to the comma-separated public hostnames that may reach Angular (for example, `rosewind.example.com,www.rosewind.example.com`) and set `PUBLIC_ORIGIN` to the canonical origin used in `robots.txt` and `sitemap.xml`. Host validation remains enabled; local runs allow only `localhost` and `127.0.0.1` by default.

## Project map

- `studio/src/app/language` ? language pipeline and runtimes
- `studio/src/app/pages` ? SSR landing/reference and CSR editor
- `studio/src/app/content` ? examples and the 50-element reference
- `examples` ? runnable RoseWind programs
- `docs` ? architecture and language notes

RoseWind is licensed under the repository's MIT license.
