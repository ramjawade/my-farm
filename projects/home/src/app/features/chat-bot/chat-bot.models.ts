export type ChatMessageRole = 'bot' | 'farmer';

/** A tappable quick reply, built from the farmer's own data (#256). */
export interface ChatQuickReply {
  label: string;
  value: string;
}

export interface ChatMessage {
  role: ChatMessageRole;
  text: string;
  /** Only bot messages carry chips. */
  chips?: ChatQuickReply[];
  /** Set on the bot message that means "ready" — renders the Review & Save action. */
  showReviewAction?: boolean;
}
