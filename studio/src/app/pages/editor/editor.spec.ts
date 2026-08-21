import { TestBed } from '@angular/core/testing';
import { Editor } from './editor';

describe('RoseWind Studio editor', () => {
  it('renders CodeMirror with the starter source after Angular paints the view', async () => {
    const fixture = TestBed.createComponent(Editor);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.cm-editor')).not.toBeNull();
    expect(element.querySelector('.cm-content')?.textContent).toContain('class Pet');
    fixture.destroy();
  });
});
