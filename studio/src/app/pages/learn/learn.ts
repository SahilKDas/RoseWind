import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { languageElements } from '../../content/language-elements';

@Component({ selector: 'app-learn', imports: [RouterLink], templateUrl: './learn.html', styleUrl: './learn.scss' })
export class Learn {
  protected readonly elements = languageElements;
  protected readonly categories = [...new Set(languageElements.map((item) => item.category))];

  constructor() {
    inject(Title).setTitle('The 50 core RoseWind language elements');
    inject(Meta).updateTag({ name: 'description', content: 'A complete reference to RoseWind types, classes, control flow, syntax, null safety, and web-first standard library.' });
  }

  protected inCategory(category: string) { return this.elements.filter((item) => item.category === category); }
}
