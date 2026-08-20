'use babel';

import { BufferedProcess, CompositeDisposable } from 'atom';
import path from 'path';

export default {
  subscriptions: null,
  panel: null,
  output: null,

  activate() {
    this.subscriptions = new CompositeDisposable();
    this.output = document.createElement('div');
    this.output.className = 'rosewind-output native-key-bindings';
    this.output.tabIndex = -1;
    this.panel = atom.workspace.addBottomPanel({ item: this.output, visible: false });
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'rosewind:run': () => this.run(),
      'rosewind:toggle-output': () => this.panel.isVisible() ? this.panel.hide() : this.panel.show(),
    }));
  },

  deactivate() {
    this.subscriptions?.dispose();
    this.panel?.destroy();
  },

  run() {
    const editor = atom.workspace.getActiveTextEditor();
    const file = editor?.getPath();
    if (!file || !file.endsWith('.rw')) {
      atom.notifications.addWarning('Save and focus a .rw file before running RoseWind.');
      return;
    }
    const project = atom.project.getPaths().find((root) => file.startsWith(root));
    if (!project) {
      atom.notifications.addError('The active RoseWind file is not inside an Atom project.');
      return;
    }
    const studio = path.join(project, 'studio');
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    this.output.textContent = `$ rosewind ${path.basename(file)}\n`;
    this.panel.show();
    new BufferedProcess({
      command,
      args: ['--prefix', studio, 'run', 'rosewind', '--', file],
      stdout: (text) => { this.output.textContent += text; },
      stderr: (text) => { this.output.textContent += text; },
      exit: (code) => {
        this.output.textContent += `\nProcess exited with code ${code}.\n`;
        if (code === 0) atom.notifications.addSuccess('RoseWind program finished.');
      },
    });
  },
};
