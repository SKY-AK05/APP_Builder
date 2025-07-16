'use server';

/**
 * @fileOverview An AI agent that enhances a vague user prompt into a detailed one.
 *
 * - enhanceUserPrompt - A function that takes a vague user request and enriches it.
 * - EnhanceUserPromptInput - The input type for the enhanceUserPrompt function.
 * - EnhanceUserPromptOutput - The return type for the enhanceUserPrompt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnhanceUserPromptInputSchema = z.object({
  userRequest: z.string().describe('The user request to enhance.'),
});
export type EnhanceUserPromptInput = z.infer<
  typeof EnhanceUserPromptInputSchema
>;

const EnhanceUserPromptOutputSchema = z.object({
  enhancedPrompt: z
    .string()
    .describe('The enhanced, detailed prompt for the application.'),
});
export type EnhanceUserPromptOutput = z.infer<
  typeof EnhanceUserPromptOutputSchema
>;

export async function enhanceUserPrompt(
  input: EnhanceUserPromptInput
): Promise<EnhanceUserPromptOutput> {
  return enhanceUserPromptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'enhanceUserPromptPrompt',
  input: {schema: EnhanceUserPromptInputSchema},
  output: {schema: EnhanceUserPromptOutputSchema},
  prompt: `You are an expert app product manager. The user has provided a vague request for an application. Your task is to enhance this request by adding specific, common-sense features to make it a detailed and actionable prompt for a developer.

The enhanced prompt should be a single, concise paragraph.

**User Request:**
"{{userRequest}}"

**Example 1:**
User Request: "a to-do app"
Enhanced Prompt: "A to-do list app where users can add new tasks via a floating action button, see a list of their current tasks, mark tasks as complete by tapping a checkbox, and delete tasks by swiping them away."

**Example 2:**
User Request: "a weather app"
Enhanced Prompt: "A weather application that shows the current temperature, humidity, and wind speed for the user's current location. It should also display a 5-day forecast with icons for each day's weather conditions."

Generate the enhanced prompt for the provided user request.`,
});

const enhanceUserPromptFlow = ai.defineFlow(
  {
    name: 'enhanceUserPromptFlow',
    inputSchema: EnhanceUserPromptInputSchema,
    outputSchema: EnhanceUserPromptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
