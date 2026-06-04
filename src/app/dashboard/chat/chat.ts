import { Component, signal, inject, ElementRef, ViewChild, AfterViewChecked, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
}

interface ChatResponse {
  conversationId: string;
  reply: string;
  toolsUsed?: string[];
  aiConfigured?: boolean;
}

// Human-readable labels for the tools the assistant can call.
const TOOL_LABELS: Record<string, string> = {
  get_org_overview: 'Organisation overview',
  list_employees: 'Employee directory',
  get_employee: 'Employee record',
  get_compliance_summary: 'Compliance summary',
};

interface ChatProfile {
  tenant?: { country?: string };
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [],
  templateUrl: './chat.html',
})
export class ChatComponent implements OnInit, AfterViewChecked {
  private http = inject(HttpClient);

  @ViewChild('messagesEnd') private messagesEnd!: ElementRef;

  country = signal<string>('AE');
  messages = signal<Message[]>([]);
  input = signal('');
  loading = signal(false);
  private conversationId: string | null = null;

  toolLabel(name: string): string {
    return TOOL_LABELS[name] ?? name;
  }

  newChat() {
    this.conversationId = null;
    this.messages.set([{ role: 'assistant', content: this.welcomeMessage(this.country()) }]);
    this.input.set('');
  }

  get isUae(): boolean {
    return this.country() === 'AE';
  }

  get headerSubtitle(): string {
    return this.isUae
      ? 'Ask anything about UAE labour law, visas, WPS, and Gulf HR compliance.'
      : 'Ask anything about HR policy, employee records, document compliance, and workforce best practices.';
  }

  ngOnInit() {
    this.http.get<ChatProfile>(`${environment.apiUrl}/api/users/me`).subscribe({
      next: (p) => {
        const c = p.tenant?.country ?? 'AE';
        this.country.set(c);
        this.messages.set([{ role: 'assistant', content: this.welcomeMessage(c) }]);
      },
      error: () => {
        this.messages.set([{ role: 'assistant', content: this.welcomeMessage('AE') }]);
      },
    });
  }

  private welcomeMessage(country: string): string {
    if (country === 'AE') {
      return "Hello! I'm your Cirvio compliance assistant. I can help you with UAE labour law, visa renewals, WPS requirements, Emirates ID tracking, and more. What would you like to know?";
    }
    return "Hello! I'm your Cirvio HR assistant. I can help you with employee records, document expiry, contracts, and general HR best practices. What would you like to know?";
  }

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
    this.http.post<ChatResponse>(`${environment.apiUrl}/api/chat`, {
      message: text,
      conversationId: this.conversationId,
    }).subscribe({
      next: (res) => {
        this.conversationId = res.conversationId;
        this.messages.update(msgs => [...msgs, {
          role: 'assistant', content: res.reply, toolsUsed: res.toolsUsed,
        }]);
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
