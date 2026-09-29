export type ChatMessageRole = 'bot' | 'farmer';

/** A tappable quick reply, built from the farmer's own data (#256). */
export interface ChatQuickReply {
  label: string;
  value: string;
  /** `suggestion` chips are example questions: tapping one sends it as a fresh message. */
  kind?: 'suggestion';
}

/** What a saved message was: plain text, the daily brief, or an answer to a question. */
export type ChatMessageKind = 'text' | 'brief' | 'answer';

export interface ChatMessage {
  role: ChatMessageRole;
  text: string;
  /** Set on the daily brief, so "already shown today?" can be answered from history. */
  kind?: ChatMessageKind;
  /** ISO time; only messages restored from history carry it (new ones are "now"). */
  createdAt?: string;
  /** Only bot messages carry chips. */
  chips?: ChatQuickReply[];
  /** Set on the bot message that means "ready" — renders the Review & Save action. */
  showReviewAction?: boolean;
}
