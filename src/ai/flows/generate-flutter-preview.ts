'use server';
/**
 * @fileOverview A Genkit flow to generate a preview image from Flutter code.
 *
 * - generateFlutterPreview - Generates a UI preview image for a given Flutter code.
 * - GenerateFlutterPreviewInput - The input type for the generateFlutterPreview function.
 * - GenerateFlutterPreviewOutput - The return type for the generateFlutterPreview function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFlutterPreviewInputSchema = z.object({
  flutterCode: z.string().describe('The Flutter code to generate a preview for.'),
});
export type GenerateFlutterPreviewInput = z.infer<typeof GenerateFlutterPreviewInputSchema>;

const GenerateFlutterPreviewOutputSchema = z.object({
  imageUrl: z.string().url().describe('The data URI of the generated preview image.'),
});
export type GenerateFlutterPreviewOutput = z.infer<typeof GenerateFlutterPreviewOutputSchema>;


export async function generateFlutterPreview(
  input: GenerateFlutterPreviewInput
): Promise<GenerateFlutterPreviewOutput> {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: `Based on the following Flutter code, generate a realistic image of what the application UI would look like on a mobile phone screen. The image should only contain the app UI, without any phone frame around it.
      
      Flutter Code:
      \`\`\`dart
      ${input.flutterCode}
      \`\`\`
      `,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media.url) {
        throw new Error('Image generation failed');
    }
  
    return {
      imageUrl: media.url,
    };
}
