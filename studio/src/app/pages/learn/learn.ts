import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { languageElements } from '../../content/language-elements';
import { diagnosticGuides } from '../../content/diagnostic-guides';

@Component({ selector: 'app-learn', imports: [RouterLink], templateUrl: './learn.html', styleUrl: './learn.scss' })
export class Learn {
  protected readonly elements = languageElements;
  protected readonly diagnostics = diagnosticGuides;
  protected readonly categories = [...new Set(languageElements.map((item) => item.category))];

  constructor() {
    inject(Title).setTitle('RoseWind language documentation — 50 core elements');
    const meta = inject(Meta);
    meta.updateTag({ name: 'description', content: 'Server-rendered RoseWind documentation covering all 50 core types, classes, control-flow forms, syntax rules, diagnostics, and web-first standard-library functions.' });
    meta.updateTag({ name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' });
    meta.updateTag({ property: 'og:type', content: 'article' });
    meta.updateTag({ property: 'og:title', content: 'RoseWind language documentation' });
    meta.updateTag({ property: 'og:description', content: 'The complete RoseWind language reference, rendered as crawlable HTML.' });
  }

  protected inCategory(category: string) { return this.elements.filter((item) => item.category === category); }
}
