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
import { Title } from '@angular/platform-browser';
import { AuthService } from '../../core/auth.service';
import { CodeExample, examples } from '../../content/examples';
import {
  roseWindCompletions,
  roseWindDiagnostics,
  roseWindHighlighting,
  roseWindLanguage,
} from '../../language/codemirror';
import { compile, CompileResult, executeInWorker } from '../../language/compiler';

const sourceStorageKey = 'rosewind.source';

@Component({ selector: 'app-editor', templateUrl: './editor.html', styleUrl: './editor.scss' })
export class Editor implements OnDestroy {
  private readonly editorHost = viewChild<ElementRef<HTMLDivElement>>('editorHost');
  private editor?: EditorView;
  private resizeObserver?: ResizeObserver;

  protected readonly auth = inject(AuthService);
  protected readonly examples = examples;
  protected readonly source = signal(examples[0]!.source);
  protected readonly result = signal<CompileResult>(compile(examples[0]!.source));
  protected readonly output = signal<readonly string[]>(['RoseWind Studio ready. Press Ctrl+Enter to run.']);
  protected readonly runtimeError = signal<string | null>(null);
  protected readonly running = signal(false);
  protected readonly activeView = signal<'source' | 'javascript'>('source');
  protected readonly bottomPanel = signal<'output' | 'diagnostics'>('output');
  protected readonly cursor = signal({ line: 1, column: 1 });
  protected readonly lineCount = computed(() => this.source().split('\n').length);
  protected readonly fileName = signal('pet.rw');

  constructor() {
    inject(Title).setTitle('RoseWind Studio');
    if (this.auth.isBrowser() && typeof globalThis.localStorage !== 'undefined') {
      const saved = globalThis.localStorage.getItem(sourceStorageKey);
      if (saved) this.updateSource(saved);
    }
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
          autocompletion({
            override: [roseWindCompletions],
            activateOnTyping: true,
            activateOnTypingDelay: 60,
            selectOnOpen: true,
          }),
          keymap.of([
            { key: 'Mod-Enter', run: () => { void this.run(); return true; } },
            { key: 'Mod-s', run: () => { this.save(); return true; } },
            indentWithTab,
          ]),
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
    this.result.set(compile(value));
  }

  protected loadExample(example: CodeExample): void {
    this.fileName.set(example.file);
    this.setEditorSource(example.source);
    this.output.set([`Opened ${example.file}`]);
    this.runtimeError.set(null);
  }

  protected showView(view: 'source' | 'javascript'): void {
    this.activeView.set(view);
    if (view === 'source') requestAnimationFrame(() => this.editor?.requestMeasure());
  }

  protected save(): void {
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.setItem(sourceStorageKey, this.source());
    }
    this.output.update((items) => [...items, `Saved ${this.fileName()} locally.`]);
  }

  protected async run(): Promise<void> {
    const result = compile(this.source());
    this.result.set(result);
    this.bottomPanel.set(result.ok ? 'output' : 'diagnostics');
    if (!result.ok) return;
    this.running.set(true);
    this.runtimeError.set(null);
    this.output.set([]);
    const execution = await executeInWorker(result.javascript);
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
}