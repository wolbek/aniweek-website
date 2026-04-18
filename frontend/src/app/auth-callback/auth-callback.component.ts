import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: '<p>Signing you in...</p>',
})
export class AuthCallbackComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  auth = inject(AuthService);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParams['token'];
    if (token) {
      this.auth.setToken(token);
      this.router.navigate(['/home']);
    } else {
      this.router.navigate(['/auth']);
    }
  }
}
