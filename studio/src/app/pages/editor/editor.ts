import { autocompletion } from '@codemirror/autocomplete';
import { indentWithTab } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { AuthService } from '../../core/auth.service';
import { CodeExample, examples } from '../../content/examples';
import {
  formatRoseWindDocument,
  formatRoseWindSelection,
  minifyRoseWindDocument,
  goToRoseWindDefinition,
  roseWindCompletions,
  roseWindDefinitionNavigation,
  roseWindDiagnostics,
  roseWindHighlighting,
  roseWindHover,
  roseWindLanguage,
} from '../../language/codemirror';
import { executeInWorker } from '../../language/compiler';
import {
  CodeAction,
  DocumentSymbol,
  LanguageAnalysis,
  LanguageDiagnostic,
  roseWindLanguageService,
  TextRange,
} from '../../language/language-service';

const sourceStorageKey = 'rosewind.source';
const formatStorageKey = 'rosewind.formatOnSave';
const fileNameStorageKey = 'rosewind.fileName';

@Component({ selector: 'app-editor', templateUrl: './editor.html', styleUrl: './editor.scss' })
export class Editor implements OnDestroy {
  private readonly editorHost = viewChild<ElementRef<HTMLDivElement>>('editorHost');
  private readonly languageService = roseWindLanguageService;
  private editor?: EditorView;
  private resizeObserver?: ResizeObserver;

  protected readonly auth = inject(AuthService);
  protected readonly examples = examples;
  protected readonly source = signal(examples[0]!.source);
  protected readonly analysis = signal<LanguageAnalysis>(this.languageService.analyze(examples[0]!.source));
  protected readonly result = computed(() => this.analysis().result);
  protected readonly diagnostics = computed(() => this.analysis().diagnostics);
  protected readonly symbols = computed(() => this.analysis().symbols);
  protected readonly output = signal<readonly string[]>(['Welcome! Press Run to make the computer follow your first two instructions.']);
  protected readonly runtimeError = signal<string | null>(null);
  protected readonly running = signal(false);
  protected readonly activeView = signal<'source' | 'javascript'>('source');
  protected readonly bottomPanel = signal<'output' | 'diagnostics'>('output');
  protected readonly cursor = signal({ line: 1, column: 1 });
  protected readonly lineCount = computed(() => this.source().split('\n').length);
  protected readonly fileName = signal(examples[0]!.file);
  protected readonly currentExample = computed(() => examples.find((example) => example.file === this.fileName()));
  protected readonly selectedDiagnostic = signal<LanguageDiagnostic | null>(null);
  protected readonly pendingAction = signal<CodeAction | null>(null);
  protected readonly formatOnSave = signal(false);
  protected readonly fixPreview = computed(() => {
    const action = this.pendingAction();
    if (!action) return null;
    return action.edits.map((edit) => ({
      before: this.source().slice(edit.from, edit.to) || '∅',
      after: edit.insert || '∅',
      line: this.lineAt(edit.from),
    }));
  });

  constructor() {
    inject(Title).setTitle('RoseWind Studio');
    inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow, noarchive' });
    const saved = this.readStorage(sourceStorageKey);
    const savedFileName = this.readStorage(fileNameStorageKey);
    if (saved) this.updateSource(saved);
    if (savedFileName) this.fileName.set(savedFileName);
    this.formatOnSave.set(this.readStorage(formatStorageKey) === 'true');
    afterNextRender(() => this.mountEditor());
  }

  private mountEditor(): void {
    const host = this.editorHost()?.nativeElement;
    if (!host || this.editor) return;
    this.editor = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: this.source(),
        extensions: [
          basicSetup,
          EditorState.tabSize.of(4),
          roseWindLanguage,
          roseWindHighlighting,
          roseWindDiagnostics(),
          roseWindHover(),
          roseWindDefinitionNavigation(),
          autocompletion({
            override: [roseWindCompletions],
            activateOnTyping: true,
            activateOnTypingDelay: 60,
            selectOnOpen: true,
          }),
          keymap.of([
            { key: 'Mod-Enter', run: () => { void this.run(); return true; } },
            { key: 'Mod-s', run: () => { this.save(); return true; } },
            { key: 'F12', run: goToRoseWindDefinition },
            { key: 'Shift-Alt-f', run: formatRoseWindDocument },
            { key: 'Mod-k Mod-f', run: formatRoseWindSelection },
            { key: 'Shift-Alt-m', run: minifyRoseWindDocument },
            indentWithTab,
          ]),
          EditorView.contentAttributes.of({
            'aria-label': 'RoseWind source editor',
            title: 'Hover for help · Ctrl+click or F12 for definition · Shift+Alt+F to format',
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) this.updateSource(update.state.doc.toString());
            if (update.docChanged || update.selectionSet) {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              this.cursor.set({ line: line.number, column: head - line.from + 1 });
            }
          }),
          EditorView.theme({
            '&': { height: '100%', backgroundColor: '#191817' },
            '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: '13px' },
            '.cm-content': { padding: '13px 8px', caretColor: '#f4a083' },
            '.cm-line': { padding: '0 10px' },
            '.cm-gutters': { backgroundColor: '#191817', color: '#544f4c', border: 'none' },
            '.cm-activeLine': { backgroundColor: '#211f1e' },
            '.cm-activeLineGutter': { backgroundColor: '#211f1e', color: '#8d8782' },
            '&.cm-focused': { outline: 'none' },
            '&.cm-focused .cm-cursor': { borderLeftColor: '#f4a083' },
            '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#47413e' },
          }, { dark: true }),
        ],
      }),
    });
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.editor?.requestMeasure());
      this.resizeObserver.observe(host);
    }
    requestAnimationFrame(() => {
      this.editor?.requestMeasure();
      this.editor?.focus();
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.editor?.destroy();
  }

  protected updateSource(value: string): void {
    this.source.set(value);
    this.analysis.set(this.languageService.analyze(value));
    const selected = this.selectedDiagnostic();
    if (selected) {
      this.selectedDiagnostic.set(this.diagnostics().find((item) => item.id === selected.id) ?? null);
    }
    this.pendingAction.set(null);
  }

  protected loadExample(example: CodeExample): void {
    this.fileName.set(example.file);
    this.setEditorSource(example.source);
    this.output.set([`Opened ${example.file}`]);
    this.runtimeError.set(null);
    this.selectedDiagnostic.set(null);
  }

  protected showView(view: 'source' | 'javascript'): void {
    this.activeView.set(view);
    if (view === 'source') requestAnimationFrame(() => this.editor?.requestMeasure());
  }

  protected save(): void {
    if (this.formatOnSave()) this.formatDocument();
    this.writeStorage(sourceStorageKey, this.source());
    this.writeStorage(fileNameStorageKey, this.fileName());
    this.output.update((items) => [...items, `Saved ${this.fileName()} locally${this.formatOnSave() ? ' and formatted it' : ''}.`]);
  }

  protected toggleFormatOnSave(): void {
    this.formatOnSave.update((value) => !value);
    this.writeStorage(formatStorageKey, String(this.formatOnSave()));
  }

  protected formatDocument(): void {
    if (!this.editor) return;
    formatRoseWindDocument(this.editor);
    this.output.update((items) => [...items, 'Formatted the document.']);
  }

  protected formatSelection(): void {
    if (!this.editor) return;
    formatRoseWindSelection(this.editor);
  }
  protected minifyDocument(): void {
    if (!this.editor) return;
    minifyRoseWindDocument(this.editor);
    this.output.update((items) => [...items, 'Minified RoseWind. Whitespace outside literals and comments was removed.']);
  }

  protected navigateToSymbol(symbol: DocumentSymbol): void {
    this.navigateTo(symbol.selectionRange);
  }

  protected selectProblem(problem: LanguageDiagnostic): void {
    this.selectedDiagnostic.set(problem);
    this.pendingAction.set(null);
    this.navigateTo({ from: problem.start, to: Math.max(problem.start + 1, problem.end) });
  }

  protected previewAction(action: CodeAction): void {
    this.pendingAction.set(action);
  }

  protected applyPendingAction(): void {
    const action = this.pendingAction();
    if (!action) return;
    this.applyEdits(action);
    this.pendingAction.set(null);
  }

  protected cancelAction(): void {
    this.pendingAction.set(null);
  }

  protected async run(): Promise<void> {
    const analysis = this.languageService.analyze(this.source());
    this.analysis.set(analysis);
    this.bottomPanel.set(analysis.result.ok ? 'output' : 'diagnostics');
    if (!analysis.result.ok) {
      this.selectedDiagnostic.set(analysis.diagnostics[0] ?? null);
      return;
    }
    this.running.set(true);
    this.runtimeError.set(null);
    this.output.set([]);
    const execution = await executeInWorker(analysis.result.javascript);
    this.output.set(execution.output.length ? execution.output : ['Program finished with no output.']);
    this.runtimeError.set(execution.error ?? null);
    this.running.set(false);
  }

  protected download(): void {
    const url = URL.createObjectURL(new Blob([this.source()], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.fileName();
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected openFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.fileName.set(file.name.endsWith('.rw') ? file.name : `${file.name}.rw`);
      this.setEditorSource(String(reader.result ?? ''));
    };
    reader.readAsText(file);
    input.value = '';
  }

  private navigateTo(range: TextRange): void {
    this.showView('source');
    if (!this.editor) return;
    this.editor.dispatch({
      selection: { anchor: Math.min(range.from, this.editor.state.doc.length), head: Math.min(range.to, this.editor.state.doc.length) },
      scrollIntoView: true,
    });
    this.editor.focus();
  }

  private applyEdits(action: CodeAction): void {
    if (!this.editor) return;
    const changes = [...action.edits].sort((left, right) => left.from - right.from)
      .map((edit) => ({ from: edit.from, to: edit.to, insert: edit.insert }));
    this.editor.dispatch({ changes, scrollIntoView: true });
    this.editor.focus();
  }

  private setEditorSource(value: string): void {
    if (!this.editor) {
      this.updateSource(value);
      return;
    }
    this.editor.dispatch({
      changes: { from: 0, to: this.editor.state.doc.length, insert: value },
      selection: { anchor: 0 },
      scrollIntoView: true,
    });
    this.editor.focus();
  }

  private lineAt(position: number): number {
    return this.source().slice(0, position).split('\n').length;
  }

  private readStorage(key: string): string | null {
    if (!this.auth.isBrowser()) return null;
    try { return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage.getItem(key); }
    catch { return null; }
  }

  private writeStorage(key: string, value: string): void {
    if (!this.auth.isBrowser()) return;
    try { globalThis.localStorage?.setItem(key, value); }
    catch { /* Storage may be disabled without disabling the editor. */ }
  }
}