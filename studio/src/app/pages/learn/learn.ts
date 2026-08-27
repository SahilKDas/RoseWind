import { Component, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { BeginnerLesson, beginnerLessons } from '../../content/beginner-lessons';
import { languageElements } from '../../content/language-elements';
import { diagnosticGuides } from '../../content/diagnostic-guides';

@Component({ selector: 'app-learn', templateUrl: './learn.html', styleUrl: './learn.scss' })
export class Learn {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly lessons = beginnerLessons;
  protected readonly elements = languageElements;
  protected readonly diagnostics = diagnosticGuides;
  protected readonly categories = [...new Set(languageElements.map((item) => item.category))];
  protected readonly copiedLesson = signal<number | null>(null);

  constructor() {
    inject(Title).setTitle('Learn programming from scratch with RoseWind');
    const meta = inject(Meta);
    meta.updateTag({ name: 'description', content: 'A free, server-rendered beginner programming course that teaches kids variables, decisions, loops, classes, and typed web programming from their very first line of code.' });
    meta.updateTag({ name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' });
    meta.updateTag({ property: 'og:type', content: 'article' });
    meta.updateTag({ property: 'og:title', content: 'Learn programming from scratch with RoseWind' });
    meta.updateTag({ property: 'og:description', content: 'Six friendly lessons take a complete beginner from hello world to their own typed program.' });
  }

  protected inCategory(category: string) { return this.elements.filter((item) => item.category === category); }

  protected async copyLesson(lesson: BeginnerLesson): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(lesson.code);
    this.copiedLesson.set(lesson.number);
    setTimeout(() => this.copiedLesson.set(null), 1600);
  }

  protected tryLesson(lesson: BeginnerLesson): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('rosewind.source', lesson.code);
        localStorage.setItem('rosewind.fileName', `lesson-${lesson.number}.rw`);
      }
    } catch { /* Studio still opens with its first lesson when browser storage is unavailable. */ }
    if (this.auth.user()) void this.router.navigate(['/editor']);
    else void this.router.navigate(['/'], { fragment: 'start', queryParams: { lesson: lesson.number } });
  }
}