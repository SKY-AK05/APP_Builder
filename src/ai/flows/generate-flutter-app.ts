'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating Flutter applications through conversation with AI.
 *
 * - generateFlutterApp - A function that initiates the Flutter app generation process.
 * - GenerateFlutterAppInput - The input type for the generateFlutterApp function.
 * - GenerateFlutterAppOutput - The return type for the generateFlutterApp function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFlutterAppInputSchema = z.object({
  userPrompt: z.string().describe('The user prompt describing the desired Flutter application.'),
});
export type GenerateFlutterAppInput = z.infer<typeof GenerateFlutterAppInputSchema>;

const GenerateFlutterAppOutputSchema = z.object({
  flutterCode: z.string().describe('The generated Flutter code for the application in a single file.'),
});
export type GenerateFlutterAppOutput = z.infer<typeof GenerateFlutterAppOutputSchema>;

export async function generateFlutterApp(input: GenerateFlutterAppInput): Promise<GenerateFlutterAppOutput> {
  return generateFlutterAppFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFlutterAppPrompt',
  input: {schema: GenerateFlutterAppInputSchema},
  output: {schema: GenerateFlutterAppOutputSchema},
  prompt: `You are an expert Flutter developer. You will generate a complete, single-file Flutter application based on the user's description. The generated code must be valid Dart code for a single main.dart file.

User Description: {{{userPrompt}}}

Generate the complete Flutter code for main.dart:
`,
});

const generateFlutterAppFlow = ai.defineFlow(
  {
    name: 'generateFlutterAppFlow',
    inputSchema: GenerateFlutterAppInputSchema,
    outputSchema: GenerateFlutterAppOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
