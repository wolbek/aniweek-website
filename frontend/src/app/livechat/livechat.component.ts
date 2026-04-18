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
