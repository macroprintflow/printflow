
'use server';
/**
 * @fileOverview A Genkit flow to handle design submissions for approval.
 *
 * - submitDesignForApproval - A function that processes a new design submission.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit'; // z is used by ai.definePrompt for inline schema definition
import { SubmitDesignInputSchema, type SubmitDesignInput, SubmitDesignOutputSchema, type SubmitDesignOutput } from '@/lib/definitions';
import { addDesignSubmissionInternal } from '@/lib/actions/jobActions';


export async function submitDesignForApproval(input: SubmitDesignInput): Promise<SubmitDesignOutput> {
  return submitDesignFlow(input);
}

const submitDesignPrompt = ai.definePrompt({
  name: 'submitDesignPrompt',
  input: {schema: SubmitDesignInputSchema}, 
  output: {
    schema: z.object({ 
        confirmationMessage: z.string().describe("A brief confirmation message acknowledging the submission details.")
    })
  },
  prompt: `A new design has been submitted for approval with the following details:
- PDF Name: {{pdfName}}
- Job Name: {{jobName}}
- Customer: {{customerName}}
- Plate Type: {{plateType}}
{{#if colorProfile}}- Color Profile: {{colorProfile}}{{#if otherColorProfileDetail}} ({{otherColorProfileDetail}}){{/if}}{{/if}}
- Attached PDF: {{media url=pdfDataUri}}

Please provide a brief confirmation message acknowledging these details.
The PDF itself has been received. This prompt is just for record-keeping and confirmation message generation.
Example confirmation: "Design '{{pdfName}}' for job '{{jobName}}' ({{plateType}} plates) received and is pending approval."
`,
});

const submitDesignFlow = ai.defineFlow(
  {
    name: 'submitDesignFlow',
    inputSchema: SubmitDesignInputSchema, 
    outputSchema: SubmitDesignOutputSchema, 
  },
  async (input) => {
    console.log('[DesignSubmission AI Flow] Received design submission:', input.pdfName, input.jobName, input.plateType);

    // Persist the submission to our mock database
    const persistedSubmission = await addDesignSubmissionInternal({
      pdfName: input.pdfName,
      jobName: input.jobName,
      customerName: input.customerName,
      pdfDataUri: input.pdfDataUri,
      plateType: input.plateType,
      colorProfile: input.colorProfile,
      otherColorProfileDetail: input.otherColorProfileDetail,
    });
    
    // Call the LLM to generate a confirmation message
    let llmConfirmationMessage = `Design '${input.pdfName}' for job '${input.jobName}' (${input.plateType} plates) received and is pending approval.`;
    try {
        const {output: promptOutput} = await submitDesignPrompt(input);
        if (promptOutput?.confirmationMessage) {
            llmConfirmationMessage = promptOutput.confirmationMessage;
        }
    } catch (error) {
        console.warn("[DesignSubmission AI Flow] Error calling LLM for confirmation message:", error);
        // Proceed with a default message
    }

    const result: SubmitDesignOutput = {
      submissionId: persistedSubmission.id, 
      pdfName: persistedSubmission.pdfName,
      jobName: persistedSubmission.jobName,
      customerName: persistedSubmission.customerName,
      status: persistedSubmission.status, 
      message: llmConfirmationMessage,
      plateType: persistedSubmission.plateType,
      colorProfile: persistedSubmission.colorProfile,
      otherColorProfileDetail: persistedSubmission.otherColorProfileDetail,
    };
    
    console.log('[DesignSubmission AI Flow] Processed submission and stored in mock DB:', result);
    return result;
  }
);
    
