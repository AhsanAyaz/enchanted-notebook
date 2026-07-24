import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERSONA,
  GLYPH_TO_PERSONA,
  isPersonaId,
  PERSONA_META,
  personaForGlyph,
} from './personas';

describe('personaForGlyph', () => {
  it('maps every glyph to its persona', () => {
    expect(personaForGlyph('!')).toBe('editor');
    expect(personaForGlyph('?')).toBe('skeptic');
    expect(personaForGlyph('~')).toBe('coach');
    expect(personaForGlyph('*')).toBe('storyteller');
    expect(personaForGlyph('#')).toBe('timekeeper');
  });

  it('falls back to the Editor when no glyph', () => {
    expect(personaForGlyph(null)).toBe(DEFAULT_PERSONA);
    expect(personaForGlyph(undefined)).toBe(DEFAULT_PERSONA);
  });

  it('validates persona hints strictly', () => {
    expect(isPersonaId('skeptic')).toBe(true);
    expect(isPersonaId('editor')).toBe(true);
    expect(isPersonaId('wizard')).toBe(false);
    expect(isPersonaId(null)).toBe(false);
    expect(isPersonaId(undefined)).toBe(false);
    expect(isPersonaId(42)).toBe(false);
  });

  it('has meta for every persona with consistent glyphs', () => {
    for (const [glyph, persona] of Object.entries(GLYPH_TO_PERSONA)) {
      expect(PERSONA_META[persona].glyph).toBe(glyph);
      expect(PERSONA_META[persona].wordCap).toBeGreaterThan(0);
    }
  });
});
