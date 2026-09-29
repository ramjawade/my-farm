import { Injectable, inject } from '@angular/core';

import { HttpService } from '../http/http.service';
import type { components } from './contracts/generated/openapi-schema';

export type AskResponse = components['schemas']['AskResponse'];
export type AskClarification = components['schemas']['Clarification'];
export type BriefResponse = components['schemas']['BriefResponse'];
export type AssistantMessage = components['schemas']['ChatMessageRead'];
export type AssistantMessagesPage = components['schemas']['ChatMessagesPage'];
export type NewAssistantMessage = components['schemas']['ChatMessageCreate'];

/**
 * The farmer assistant's backend (#285): routing and answers, the daily brief,
 * and the persisted chat history. A thin wrapper — callers decide what a
 * failure means (`ask` failing falls back to logging, history failing is
 * ignored), so nothing here swallows an error.
 */
@Injectable({ providedIn: 'root' })
export class AssistantApiService {
  private readonly http = inject(HttpService);

  /** Route a fresh message and, for a question, answer it. 503 when the model is unavailable. */
  ask(text: string, language?: string): Promise<AskResponse> {
    return this.http.post<AskResponse>('/assistant/ask', { text, language: language ?? null });
  }

  brief(): Promise<BriefResponse> {
    return this.http.get<BriefResponse>('/assistant/brief');
  }

  /** Newest-first page; pass the oldest id already shown as `before` for older messages. */
  listMessages(limit = 50, before?: number): Promise<AssistantMessagesPage> {
    const params: Record<string, string> = { limit: String(limit) };
    if (before !== undefined) params['before'] = String(before);
    return this.http.get<AssistantMessagesPage>('/assistant/messages', params);
  }

  /** Append one turn (1–2 messages). */
  appendMessages(messages: NewAssistantMessage[]): Promise<AssistantMessage[]> {
    return this.http.post<AssistantMessage[]>('/assistant/messages', { messages });
  }

  clearMessages(): Promise<void> {
    return this.http.delete<void>('/assistant/messages');
  }
}
