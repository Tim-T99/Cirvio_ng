import { Component, signal, inject, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [],
  templateUrl: './chat.html',
})
export class ChatComponent implements AfterViewChecked {
  private http = inject(HttpClient);

  @ViewChild('messagesEnd') private messagesEnd!: ElementRef;

  messages = signal<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your Cirvio compliance assistant. I can help you with UAE labour law, visa renewals, WPS requirements, Emirates ID tracking, and more. What would you like to know?',
    },
  ]);
  input = signal('');
  loading = signal(false);

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom() {
    try {
      this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }

  sendMessage() {
    const text = this.input().trim();
    if (!text || this.loading()) return;
    this.messages.update(msgs => [...msgs, { role: 'user', content: text }]);
    this.input.set('');
    this.loading.set(true);
    this.http.post<{ reply: string }>(`${environment.apiUrl}/api/chat`, { message: text }).subscribe({
      next: (res) => {
        this.messages.update(msgs => [...msgs, { role: 'assistant', content: res.reply }]);
        this.loading.set(false);
      },
      error: () => {
        this.messages.update(msgs => [...msgs, {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        }]);
        this.loading.set(false);
      },
    });
  }

  handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }
}
