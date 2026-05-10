import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat',
  imports: [FormsModule],
  templateUrl: './chat.html',
})
export class ChatComponent {
  message = '';

  sendMessage() {
    if (!this.message.trim()) return;
    // TODO: wire to API
    this.message = '';
  }
}
