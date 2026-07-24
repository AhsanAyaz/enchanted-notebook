import { z } from 'genkit';
import { ai, model } from './genkit';

export const VisionResultSchema = z.object({
  transcript: z
    .string()
    .describe('Everything handwritten on the page, transcribed faithfully.'),
  glyph: z
    .enum(['!', '?', '~', '*', '#'])
    .nullable()
    .describe(
      'A single small symbol drawn in the LEFT MARGIN, set apart from the text. Null if none.',
    ),
  sketchDescription: z
    .string()
    .nullable()
    .describe(
      'Short description of any diagrams, arrows or sketches. Null if none.',
    ),
});

export type VisionResult = z.infer<typeof VisionResultSchema>;

const VISION_PROMPT = `You are reading a page from a speaker's handwritten backstage notebook.
Transcribe the handwriting exactly as written — keep abbreviations and half-formed phrasing.
Look for a persona glyph: a single small symbol (! ? ~ * #) drawn in the left margin,
visually separate from the sentence text. Punctuation at the end of a sentence is NOT a glyph.
Describe any diagrams or arrows briefly. If handwriting is illegible, transcribe your best guess.`;

export async function runVisionPass(pngBase64: string): Promise<VisionResult> {
  const { output } = await ai.generate({
    model: model(),
    messages: [
      {
        role: 'user',
        content: [
          { media: { url: `data:image/png;base64,${pngBase64}` } },
          { text: VISION_PROMPT },
        ],
      },
    ],
    output: { schema: VisionResultSchema },
  });
  if (!output) throw new Error('Vision pass returned no structured output');
  return output;
}
