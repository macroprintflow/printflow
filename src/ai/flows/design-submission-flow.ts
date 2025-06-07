
'use server';
/**
 * @fileOverview A Genkit flow to handle design submissions for approval.
 *
 * - submitDesignForApproval - A function that processes a new design submission.
 * - SubmitDesignInput - The input type for the submitDesignForApproval function.
 * - SubmitDesignOutput - The return type for the submitDesignForApproval function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const SubmitDesignInputSchema = z.object({
  pdfName: z.string().describe("The original name of the PDF file."),
  jobName: z.string().describe("The name of the job this design is for."),
  customerName: z.string().describe("The name of the customer for this job."),
  pdfDataUri: z
    .string()
    .describe(
      "The PDF file content as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
});
export type SubmitDesignInput = z.infer<typeof SubmitDesignInputSchema>;

export const SubmitDesignOutputSchema = z.object({
  submissionId: z.string().describe("A unique identifier for this design submission."),
  pdfName: z.string().describe("The name of the PDF file."),
  jobName: z.string().describe("The job name."),
  customerName: z.string().describe("The customer name."),
  status: z.string().describe("The initial status of the submission (e.g., 'pending')."),
  message: z.string().optional().describe("A confirmation or status message."),
});
export type SubmitDesignOutput = z.infer<typeof SubmitDesignOutputSchema>;


export async function submitDesignForApproval(input: SubmitDesignInput): Promise<SubmitDesignOutput> {
  return submitDesignFlow(input);
}

const submitDesignPrompt = ai.definePrompt({
  name: 'submitDesignPrompt',
  input: {schema: SubmitDesignInputSchema},
  output: {
    schema: z.object({ // Simplified output from LLM for this step
        confirmationMessage: z.string().describe("A brief confirmation message acknowledging the submission details.")
    })
  },
  prompt: `A new design has been submitted for approval with the following details:
- PDF Name: {{pdfName}}
- Job Name: {{jobName}}
- Customer: {{customerName}}
- Attached PDF: {{media url=pdfDataUri}}

Please provide a brief confirmation message acknowledging these details.
The PDF itself has been received. This prompt is just for record-keeping and confirmation message generation.
Example confirmation: "Design '{{pdfName}}' for job '{{jobName}}' received and is pending approval."
`,
});

const submitDesignFlow = ai.defineFlow(
  {
    name: 'submitDesignFlow',
    inputSchema: SubmitDesignInputSchema,
    outputSchema: SubmitDesignOutputSchema,
  },
  async (input) => {
    console.log('[DesignSubmission AI Flow] Received design submission:', input.pdfName, input.jobName);

    // In a real application, you would save the PDF (e.g., to Firebase Storage)
    // and store submission details in a database (e.g., Firestore).
    // For this prototype, we'll generate a unique ID and simulate processing.

    const submissionId = `ds-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Call the LLM to generate a confirmation message (optional, can be static)
    let llmConfirmationMessage = `Design '${input.pdfName}' for job '${input.jobName}' received and is pending approval.`;
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
      submissionId,
      pdfName: input.pdfName,
      jobName: input.jobName,
      customerName: input.customerName,
      status: "pending",
      message: llmConfirmationMessage,
    };
    
    console.log('[DesignSubmission AI Flow] Processed submission:', result);
    return result;
  }
);

    