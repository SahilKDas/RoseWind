import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-home',
  imports: [FormsModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly readyLesson = inject(ActivatedRoute).snapshot.queryParamMap.get('lesson');
  protected name = '';
  protected loginError = '';

  constructor() {
    inject(Title).setTitle('RoseWind — Learn programming from your very first line');
    const meta = inject(Meta);
    meta.updateTag({ name: 'description', content: 'Learn programming from scratch with RoseWind: six friendly lessons, plain-language errors, no setup, and a browser playground made for first-time coders.' });
    meta.updateTag({ name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' });
    meta.updateTag({ property: 'og:type', content: 'website' });
    meta.updateTag({ property: 'og:title', content: 'RoseWind programming language' });
    meta.updateTag({ property: 'og:description', content: 'Start with one line, learn through tiny experiments, and build your own typed programs in the browser.' });
  }

  protected enterStudio(): void {
    if (!this.auth.login(this.name)) {
      this.loginError = 'Enter a display name to continue.';
      return;
    }
    void this.router.navigate(['/editor']);
  }
}
