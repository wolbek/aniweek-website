import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';
import { ContactUsService } from './services/contact-us.service';

@Component({
  selector: 'app-contact-us',
  imports: [FormsModule, RouterLink],
  templateUrl: './contact-us.component.html',
  styleUrl: './contact-us.component.scss',
})
export class ContactUsComponent {
  auth = inject(AuthService);
  private contactService = inject(ContactUsService);

  subject = '';
  body = '';
  sending = signal(false);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  canSend(): boolean {
    return !!this.subject.trim() && !!this.body.trim() && !this.sending();
  }

  send(): void {
    if (!this.canSend()) return;

    this.sending.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.contactService.sendMessage(this.subject.trim(), this.body.trim()).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.successMessage.set(res.message);
        this.subject = '';
        this.body = '';
      },
      error: (err) => {
        this.sending.set(false);
        this.errorMessage.set(err.error?.message ?? 'Failed to send. Please try again.');
      },
    });
  }
}
