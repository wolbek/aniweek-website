import { inject, Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AuthService } from '../auth/services/auth.service';

export interface ChatMessage {
  _id: string;
  text: string;
  displayName: string;
  photo: string;
  role: 'admin' | 'user';
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class LivechatService {
  private auth = inject(AuthService);
  active = signal(false);
  private socket: Socket | null = null;
  messages = signal<ChatMessage[]>([]);

  connect(): void {
    if (this.socket?.connected) return;

    const token = this.auth.getToken();
    if (!token) return;

    this.socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('livechat-status', (data: { active: boolean }) => {
      this.active.set(data.active);
      if (!data.active) {
        this.messages.set([]);
      }
    });

    this.socket.on('chat-history', (msgs: ChatMessage[]) => {
      this.messages.set(msgs);
    });

    this.socket.on('new-message', (msg: ChatMessage) => {
      this.messages.update((prev) => [...prev, msg]);
    });
    this.socket.on('message-deleted', (data: { messageId: string }) => {
      this.messages.update((prev) => prev.filter((m) => m._id !== data.messageId));
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  startLivechat(): void {
    this.socket?.emit('start-livechat');
  }

  stopLivechat(): void {
    this.socket?.emit('stop-livechat');
  }

  sendMessage(text: string): void {
    if (!text.trim()) return;
    this.socket?.emit('send-message', { text: text.trim() });
  }

  deleteMessage(messageId: string): void {
    this.socket?.emit('delete-message', { messageId });
  }
}
