import type { Glyph, PersonaId } from './personas';

/** Context sent alongside the committed page PNG on POST /turns. */
export interface TurnContext {
  notebookId: string;
  pageId: string;
  talkTitle: string;
  targetMinutes?: number | null;
  /** Explicit persona pick (wax-stamp rail). Wins over the vision-detected glyph. */
  personaHint?: PersonaId | null;
  /** Last N turns on this page/notebook, oldest first. */
  recentTurns: Array<{
    persona: PersonaId;
    transcript: string;
    replyText: string;
  }>;
}

export interface TurnMetaEvent {
  type: 'meta';
  transcript: string;
  glyph: Glyph | null;
  persona: PersonaId;
  sketchDescription: string | null;
}

export interface TurnSentenceEvent {
  type: 'sentence';
  text: string;
}

export interface TurnDoneEvent {
  type: 'done';
  turnId: string;
  replyText: string;
  latencyMs: number;
}

export interface TurnErrorEvent {
  type: 'error';
  message: string;
}

export type TurnEvent =
  | TurnMetaEvent
  | TurnSentenceEvent
  | TurnDoneEvent
  | TurnErrorEvent;
