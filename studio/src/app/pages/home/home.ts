import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
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
  protected name = '';
  protected loginError = '';

  constructor() {
    inject(Title).setTitle('RoseWind — A friendly, strongly typed language for the web');
    inject(Meta).updateTag({ name: 'description', content: 'Learn and run RoseWind, a beginner-friendly strongly typed language with classes, null safety, JIT-oriented JavaScript output, and web-first data types.' });
  }

  protected enterStudio(): void {
    if (!this.auth.login(this.name)) {
      this.loginError = 'Enter a display name to continue.';
      return;
    }
    void this.router.navigate(['/editor']);
  }
}
