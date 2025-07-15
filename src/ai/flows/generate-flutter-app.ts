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
  userPrompt: z
    .string()
    .describe('The user prompt describing the desired Flutter application.'),
});
export type GenerateFlutterAppInput = z.infer<
  typeof GenerateFlutterAppInputSchema
>;

const GenerateFlutterAppOutputSchema = z.object({
  pubspec: z
    .string()
    .describe('The generated pubspec.yaml content for the application.'),
  mainDart: z
    .string()
    .describe('The generated Flutter code for the application in a single main.dart file.'),
});
export type GenerateFlutterAppOutput = z.infer<
  typeof GenerateFlutterAppOutputSchema
>;

export async function generateFlutterApp(
  input: GenerateFlutterAppInput
): Promise<GenerateFlutterAppOutput> {
  return generateFlutterAppFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFlutterAppPrompt',
  input: {schema: GenerateFlutterAppInputSchema},
  output: {schema: GenerateFlutterAppOutputSchema},
  prompt: `You are an expert senior Flutter developer tasked with creating a beautiful, production-worthy application.

**System Constraints:**
- You must generate a complete Flutter project structure, including a \`pubspec.yaml\` and a \`main.dart\` file.
- The \`main.dart\` file must contain valid, complete, and syntactically correct Dart code.
- The \`pubspec.yaml\` file should include a basic setup and any necessary dependencies if the user's prompt requires them (e.g., http, provider). Keep dependencies to a minimum.
- The app should be visually appealing and follow Material Design 3 principles. Use a professional color scheme and layout.
- Implement a clear structure within \`main.dart\`, separating widgets into their own classes where appropriate. Do not create one single giant widget.
- Ensure the code is clean, readable, and well-commented where necessary to explain complex logic.
- Do not use any placeholder code or comments like "// Your code here". The generated code must be fully complete.
- The response must be a single, valid JSON object containing the 'pubspec' and 'mainDart' keys.

**User Description:**
{{{userPrompt}}}

Generate the complete content for both \`pubspec.yaml\` and \`main.dart\`.
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
