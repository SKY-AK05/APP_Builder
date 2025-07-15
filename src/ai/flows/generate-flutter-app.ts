'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating Flutter applications through conversation with AI.
 *
 * - generateFlutterApp - A function that initiates the Flutter app generation process.
 * - GenerateFlutterAppInput - The input type for the generateFlutterApp function.
 * - GenerateFlutterAppOutput - The return type for the generateFlutterAppOutput function.
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
  prompt: `You are an expert senior Flutter developer tasked with creating a beautiful, production-worthy application.

**System Constraints:**
- You must generate a complete, single-file Flutter application.
- The entire code must be valid Dart for a single \`main.dart\` file.
- Do not use any external packages or dependencies that require a \`pubspec.yaml\` file. All code must rely on the standard Flutter SDK.
- The app should be visually appealing and follow Material Design 3 principles.
- Use appropriate widgets to create a rich, fully-featured user interface.
- Implement a clear structure, separating widgets into their own classes where appropriate, even within the single file.
- Ensure the code is clean, readable, and well-commented where necessary to explain complex logic.
- The app should be stateful if the user's request implies interaction or data changes.

**User Description:** 
{{{userPrompt}}}

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
