import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

interface ContactUsResponse {
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class ContactUsService {
  private http = inject(HttpClient);

  sendMessage(subject: string, body: string): Observable<ContactUsResponse> {
    return this.http.post<ContactUsResponse>('/api/contact', { subject, body });
  }
}
