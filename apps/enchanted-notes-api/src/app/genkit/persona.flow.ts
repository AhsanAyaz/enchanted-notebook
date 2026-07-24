import type { PersonaId, TurnContext } from '@enchanted/notes-domain';
import { ai, model } from './genkit';
import { buildPersonaPrompt } from './prompts';

/** Stream the persona's reply as raw text deltas. */
export async function* runPersonaPass(
  persona: PersonaId,
  transcript: string,
  sketchDescription: string | null,
  ctx: TurnContext,
): AsyncGenerator<string> {
  const { system, prompt } = buildPersonaPrompt(
    persona,
    transcript,
    sketchDescription,
    ctx,
  );

  const { stream } = ai.generateStream({
    model: model(),
    system,
    prompt,
  });

  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}
