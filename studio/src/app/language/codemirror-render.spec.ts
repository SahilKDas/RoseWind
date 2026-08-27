import { autocompletion } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { describe, expect, it } from 'vitest';
import '../../test-dom';
import {
  formatRoseWindDocument,
  goToRoseWindDefinition,
  roseWindCompletions,
  roseWindDiagnostics,
  roseWindHighlighting,
  roseWindHover,
  roseWindLanguage,
} from './codemirror';

describe('RoseWind editor integration', () => {
  it('mounts and renders highlighted source with language tools', () => {
    const parent = document.createElement('div');
    document.body.append(parent);

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: 'let(score=42);',
        extensions: [
          basicSetup,
          roseWindLanguage,
          roseWindHighlighting,
          roseWindDiagnostics(),
          roseWindHover(),
          autocompletion({ override: [roseWindCompletions], activateOnTyping: true }),
        ],
      }),
    });

    expect(parent.querySelector('.cm-editor')).not.toBeNull();
    expect(parent.querySelector('.cm-content')?.textContent).toContain('let(score');
    expect(parent.querySelector('.cm-gutter-lint')).not.toBeNull();
    view.destroy();
    parent.remove();
  });

  it('opens IntelliSense automatically while typing', async () => {
    const parent = document.createElement('div');
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        extensions: [
          roseWindLanguage,
          autocompletion({
            override: [roseWindCompletions],
            activateOnTyping: true,
            activateOnTypingDelay: 10,
          }),
        ],
      }),
    });

    view.dispatch({
      changes: { from: 0, insert: 'pri' },
      selection: { anchor: 3 },
      userEvent: 'input.type',
    });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(parent.querySelector('.cm-tooltip-autocomplete')).not.toBeNull();
    expect(parent.textContent).toContain('print');
    view.destroy();
    parent.remove();
  });

  it('navigates to definitions and formats through editor commands', () => {
    const source = 'class(Pet){\ncreate(){\n}\nspeak(){\n}\n}\nlet(pet=new(Pet));\npet.speak();';
    const use = source.lastIndexOf('speak');
    const parent = document.createElement('div');
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({ doc: source, selection: { anchor: use + 2 }, extensions: [roseWindLanguage] }),
    });

    expect(goToRoseWindDefinition(view)).toBe(true);
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('speak');
    expect(view.state.selection.main.from).toBeLessThan(use);

    expect(formatRoseWindDocument(view)).toBe(true);
    expect(view.state.doc.toString()).toContain('    create() {');
    view.destroy();
    parent.remove();
  });
});