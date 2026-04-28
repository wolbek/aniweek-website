import {
  AfterViewChecked,
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { LivechatService } from './livechat.service';
import { AuthService } from '../auth/services/auth.service';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-livechat',
  imports: [FormsModule, DatePipe],
  templateUrl: './livechat.component.html',
  styleUrl: './livechat.component.scss',
})
export class LivechatComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  chat = inject(LivechatService);
  messageText = '';
  defaultAvatar = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="%236c5ce7"/><text x="32" y="38" text-anchor="middle" fill="white" font-size="28" font-family="sans-serif">?</text></svg>')}`;

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  constructor() {
    effect(() => {
      this.chat.messages();
      setTimeout(() => this.scrollToBottom());
    });
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  ngOnInit(): void {
    this.chat.connect();
  }

  ngOnDestroy(): void {
    this.chat.disconnect();
  }

  toggleLivechat(): void {
    if (this.chat.active()) {
      this.chat.stopLivechat();
    } else {
      this.chat.startLivechat();
    }
  }

  send(): void {
    if (!this.messageText.trim()) return;
    this.chat.sendMessage(this.messageText);
    this.messageText = '';
  }
}
