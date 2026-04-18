import { Component, inject, OnInit } from '@angular/core';
import { AuthService } from '../auth/services/auth.service';
import { LivechatComponent } from '../livechat/livechat.component';
@Component({
  selector: 'app-home',
  imports: [LivechatComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  auth = inject(AuthService);

  logout(): void {
    this.auth.logout();
  }
}
