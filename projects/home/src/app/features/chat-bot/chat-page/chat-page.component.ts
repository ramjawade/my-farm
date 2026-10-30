import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ChatOrchestratorService } from '../chat-orchestrator.service';
import { ChatPanelComponent } from '../chat-panel/chat-panel.component';

/**
 * The assistant on its own page (`/chat`). It is a second view of the
 * conversation the floating overlay shows: both inject the orchestrator
 * provided by the app layout, and the Review & Save popup stays in the chat
 * container, so this page only hosts the panel.
 */
@Component({
  selector: 'app-chat-page',
  imports: [ChatPanelComponent],
  template: `
    <app-chat-panel
      layout="page"
      [messages]="orchestrator.messages()"
      [busy]="orchestrator.busy()"
      [hasMoreHistory]="orchestrator.hasMoreHistory()"
      [suggestions]="orchestrator.suggestions()"
      (send)="orchestrator.sendText($event)"
      (chipSelected)="orchestrator.selectChip($event)"
      (loadOlder)="orchestrator.loadOlder()"
      (clearConfirmed)="orchestrator.clearHistory()"
      (reviewRequested)="orchestrator.requestReview()"
    />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPageComponent {
  protected readonly orchestrator = inject(ChatOrchestratorService);

  constructor() {
    // Restore saved messages and, at most once a day, the brief.
    void this.orchestrator.onOpen();
  }
}
