import type { Glyph, PersonaId } from './personas';

export type TurnSource = 'pen' | 'typed';

export interface Notebook {
  id: string;
  userId: string;
  title: string;
  targetMinutes?: number | null;
  createdAt: string;
}

export interface Page {
  id: string;
  notebookId: string;
  index: number;
}

export interface Turn {
  id: string;
  pageId: string;
  seq: number;
  source: TurnSource;
  userPngUrl: string;
  transcript: string;
  glyph: Glyph | null;
  persona: PersonaId;
  replyText: string;
  /** Mutable display copy of the user's thought; starts as the transcript. */
  beatText: string;
  rewriteAccepted?: boolean;
  latencyMs?: number | null;
  createdAt: string;
}
