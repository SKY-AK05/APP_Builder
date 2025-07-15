'use server';

/**
 * @fileOverview An AI agent that determines if a user request contains important requirements.
 *
 * - determineImportantRequirement - A function that determines if a user request contains important requirements.
 * - DetermineImportantRequirementInput - The input type for the determineImportantRequirement function.
 * - DetermineImportantRequirementOutput - The return type for the determineImportantRequirement function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetermineImportantRequirementInputSchema = z.object({
  userRequest: z.string().describe('The user request to analyze.'),
});
export type DetermineImportantRequirementInput = z.infer<
  typeof DetermineImportantRequirementInputSchema
>;

const DetermineImportantRequirementOutputSchema = z.object({
  hasImportantRequirement: z
    .boolean()
    .describe(
      'Whether the user request contains important requirements that need to be addressed.'
    ),
  reasoning: z
    .string()
    .describe('The reasoning behind the determination.'),
});
export type DetermineImportantRequirementOutput = z.infer<
  typeof DetermineImportantRequirementOutputSchema
>;

export async function determineImportantRequirement(
  input: DetermineImportantRequirementInput
): Promise<DetermineImportantRequirementOutput> {
  return determineImportantRequirementFlow(input);
}

const prompt = ai.definePrompt({
  name: 'determineImportantRequirementPrompt',
  input: {schema: DetermineImportantRequirementInputSchema},
  output: {schema: DetermineImportantRequirementOutputSchema},
  prompt: `You are an AI assistant that determines if a user request for building an application contains important requirements that need to be addressed.

  Analyze the following user request:
  {{userRequest}}

  Determine if the request contains important requirements. Important requirements are specific, actionable details necessary for the successful creation of the application.

  Respond with a JSON object in the following format:
  {
    "hasImportantRequirement": true or false,
    "reasoning": "Explanation of why the request does or does not contain important requirements."
  }

  Example 1:
  User Request: "I want to build a social media app."
  Output:
  {
    "hasImportantRequirement": false,
    "reasoning": "The request is too vague. It does not specify any specific features or functionalities needed for the app."
  }

  Example 2:
  User Request: "I want to build an e-commerce app where users can browse products, add them to a cart, and checkout using Stripe."
  Output:
  {
    "hasImportantRequirement": true,
    "reasoning": "The request specifies key features such as browsing products, adding to cart, and integrating with Stripe for checkout, which are important requirements."
  }`,
});

const determineImportantRequirementFlow = ai.defineFlow(
  {
    name: 'determineImportantRequirementFlow',
    inputSchema: DetermineImportantRequirementInputSchema,
    outputSchema: DetermineImportantRequirementOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
