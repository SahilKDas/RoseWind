import { autocompletion } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { describe, expect, it } from 'vitest';
import {
  roseWindCompletions,
  roseWindDiagnostics,
  roseWindHighlighting,
  roseWindLanguage,
} from './codemirror';

describe('RoseWind editor integration', () => {
  it('mounts and renders source text', () => {
    const parent = document.createElement('div');
    document.body.append(parent);

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: 'let score: num = 42;',
        extensions: [
          basicSetup,
          roseWindLanguage,
          roseWindHighlighting,
          roseWindDiagnostics(),
          autocompletion({ override: [roseWindCompletions], activateOnTyping: true }),
        ],
      }),
    });

    expect(parent.querySelector('.cm-editor')).not.toBeNull();
    expect(parent.querySelector('.cm-content')?.textContent).toContain('let score');
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
});