export type Glyph = '!' | '?' | '~' | '*' | '#';

export type PersonaId =
  | 'editor'
  | 'skeptic'
  | 'coach'
  | 'storyteller'
  | 'timekeeper';

export const GLYPH_TO_PERSONA: Record<Glyph, PersonaId> = {
  '!': 'editor',
  '?': 'skeptic',
  '~': 'coach',
  '*': 'storyteller',
  '#': 'timekeeper',
};

export const DEFAULT_PERSONA: PersonaId = 'editor';

export interface PersonaMeta {
  id: PersonaId;
  label: string;
  glyph: Glyph;
  /** Hard cap for reply length — handwriting is slow, brevity is a feature. */
  wordCap: number;
  /** quill-ink builtin font pack id (3 packs shared across 5 personas). */
  font: 'caveat' | 'dancing-script' | 'shadows-into-light';
  inkColor: string;
  /** Pen speed in px/s for the handwriting animation. */
  penSpeed: number;
}

export const PERSONA_META: Record<PersonaId, PersonaMeta> = {
  editor: {
    id: 'editor',
    label: 'The Editor',
    glyph: '!',
    wordCap: 60,
    font: 'caveat',
    inkColor: '#232a4d',
    penSpeed: 900,
  },
  skeptic: {
    id: 'skeptic',
    label: 'The Skeptic',
    glyph: '?',
    wordCap: 80,
    font: 'shadows-into-light',
    inkColor: '#7a3325',
    penSpeed: 1200,
  },
  coach: {
    id: 'coach',
    label: 'The Coach',
    glyph: '~',
    wordCap: 60,
    font: 'dancing-script',
    inkColor: '#2e6b3f',
    penSpeed: 650,
  },
  storyteller: {
    id: 'storyteller',
    label: 'The Storyteller',
    glyph: '*',
    wordCap: 80,
    font: 'caveat',
    inkColor: '#5b3a8c',
    penSpeed: 800,
  },
  timekeeper: {
    id: 'timekeeper',
    label: 'The Timekeeper',
    glyph: '#',
    wordCap: 60,
    font: 'shadows-into-light',
    inkColor: '#4a4a4a',
    penSpeed: 1000,
  },
};

export function personaForGlyph(glyph: Glyph | null | undefined): PersonaId {
  return glyph ? GLYPH_TO_PERSONA[glyph] ?? DEFAULT_PERSONA : DEFAULT_PERSONA;
}

export function isPersonaId(value: unknown): value is PersonaId {
  return typeof value === 'string' && value in PERSONA_META;
}

/** Conference speaking pace used for time estimates. */
export const SPEAKING_WPM = 130;

/** The user's own hand — manuscript beats and replay export share it. */
export const USER_HAND = {
  font: 'caveat',
  inkColor: '#2f2f33',
  penSpeed: 900,
} as const;
