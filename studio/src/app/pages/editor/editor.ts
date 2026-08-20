import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { AuthService } from '../../core/auth.service';
import { CodeExample, examples } from '../../content/examples';
import { compile, CompileResult, executeInWorker } from '../../language/compiler';

const sourceStorageKey = 'rosewind.source';

@Component({ selector: 'app-editor', imports: [FormsModule], templateUrl: './editor.html', styleUrl: './editor.scss' })
export class Editor {
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
    if (this.auth.isBrowser()) {
      const saved = localStorage.getItem(sourceStorageKey);
      if (saved) this.updateSource(saved);
    }
  }

  protected updateSource(value: string): void {
    this.source.set(value);
    this.result.set(compile(value));
  }

  protected loadExample(example: CodeExample): void {
    this.fileName.set(example.file);
    this.updateSource(example.source);
    this.output.set([`Opened ${example.file}`]);
    this.runtimeError.set(null);
  }

  protected save(): void {
    localStorage.setItem(sourceStorageKey, this.source());
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

  protected handleKeydown(event: KeyboardEvent, textarea: HTMLTextAreaElement): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      void this.run();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.save();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      this.updateSource(`${this.source().slice(0, start)}    ${this.source().slice(end)}`);
      queueMicrotask(() => { textarea.selectionStart = textarea.selectionEnd = start + 4; });
    }
  }

  protected updateCursor(textarea: HTMLTextAreaElement): void {
    const before = textarea.value.slice(0, textarea.selectionStart).split('\n');
    this.cursor.set({ line: before.length, column: (before.at(-1)?.length ?? 0) + 1 });
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
      this.updateSource(String(reader.result ?? ''));
    };
    reader.readAsText(file);
    input.value = '';
  }
}
