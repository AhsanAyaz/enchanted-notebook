import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

export const ai = genkit({
  plugins: [googleAI()],
});

export const model = () =>
  googleAI.model(process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash');
