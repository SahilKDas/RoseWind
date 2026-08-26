import { TestBed } from '@angular/core/testing';
import '../../../test-dom';
import { Editor } from './editor';

async function createEditor() {
  const fixture = TestBed.createComponent(Editor);
  fixture.detectChanges();
  await fixture.whenStable();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  fixture.detectChanges();
  return fixture;
}

describe('RoseWind Studio editor', () => {
  it('renders CodeMirror, the symbol outline, and teaching controls', async () => {
    const fixture = await createEditor();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.cm-editor')).not.toBeNull();
    expect(element.querySelector('.cm-content')?.textContent).toContain('class(Pet)');
    expect(element.querySelector('.outline')?.textContent).toContain('Pet');
    expect(element.querySelector('.text-button')?.textContent).toContain('Format');
    fixture.destroy();
  });

  it('navigates from a problem, explains it, previews its fix, and applies it', async () => {
    const fixture = await createEditor();
    const component = fixture.componentInstance as any;
    component.setEditorSource('let score: num = 42');
    component.bottomPanel.set('diagnostics');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    (element.querySelector('.problem-row') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('.problem-explanation')?.textContent).toContain('semicolon');

    (element.querySelector('.fix-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('.fix-dialog')?.textContent).toContain('Insert missing semicolon');
    expect(element.querySelector('.diff')?.textContent).toContain('+ ;');

    (element.querySelector('.apply-fix') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.source()).toBe('let score: num = 42;');
    expect(component.result().ok).toBe(true);
    fixture.destroy();
  });

  it('formats before saving when format-on-save is enabled', async () => {
    const fixture = await createEditor();
    const component = fixture.componentInstance as any;
    component.setEditorSource('class Demo {\ncreate() {\nprint("ok");\n}\n}\n');
    if (!component.formatOnSave()) component.toggleFormatOnSave();
    component.save();
    fixture.detectChanges();

    expect(component.source()).toContain('    create() {\n        print("ok");');
    expect(component.output().at(-1)).toContain('formatted');
    fixture.destroy();
  });
});