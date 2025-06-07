
'use server';
/**
 * @fileOverview A Genkit flow to send an email to the plate manufacturer with design details and PDF attachment.
 *
 * - sendPlateEmail - A function that handles composing and sending the email.
 * - SendPlateEmailInput - The input type for the flow.
 * - SendPlateEmailOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { sendEmailService } from '@/services/emailService';
import type { PlateTypeValue, ColorProfileValue } from '@/lib/definitions';

const PLATE_MAKER_EMAIL = process.env.PLATE_MAKER_EMAIL;

export const SendPlateEmailInputSchema = z.object({
  jobName: z.string().describe("Name of the job."),
  customerName: z.string().describe("Name of the customer."),
  pdfName: z.string().describe("Filename of the PDF design."),
  pdfDataUri: z.string().describe("The PDF design as a data URI."),
  colorProfile: z.enum(['cmyk', 'cmyk_white', 'other']).optional().describe("Color profile for the plates."),
  otherColorProfileDetail: z.string().optional().describe("Details if color profile is 'other'."),
  plateType: z.enum(['new', 'old']).default('new').describe("Plate type, typically 'new' for this flow."),
  // jobCardNumber is optional and might not always be available when sending from 'For Approval'
  jobCardNumber: z.string().optional().describe("Job card number, if available."), 
});
export type SendPlateEmailInput = z.infer<typeof SendPlateEmailInputSchema>;

export const SendPlateEmailOutputSchema = z.object({
  success: z.boolean().describe("Whether the email was sent successfully."),
  message: z.string().describe("A message indicating the outcome of the email sending attempt."),
  messageId: z.string().optional().describe("The message ID from the email provider if successful."),
});
export type SendPlateEmailOutput = z.infer<typeof SendPlateEmailOutputSchema>;

export async function sendPlateEmail(input: SendPlateEmailInput): Promise<SendPlateEmailOutput> {
  return sendPlateEmailFlow(input);
}

const sendPlateEmailFlow = ai.defineFlow(
  {
    name: 'sendPlateEmailFlow',
    inputSchema: SendPlateEmailInputSchema,
    outputSchema: SendPlateEmailOutputSchema,
  },
  async (input) => {
    if (!PLATE_MAKER_EMAIL) {
      console.error("[SendPlateEmailFlow] Plate maker email (PLATE_MAKER_EMAIL) is not configured in environment variables.");
      return { success: false, message: "Plate maker email recipient is not configured in the system." };
    }

    const subject = `New Plate Order: ${input.jobName} (Customer: ${input.customerName}) ${input.jobCardNumber ? `- Job# ${input.jobCardNumber}` : ''}`;
    const htmlBody = `
      <p>Dear Plate Manufacturer,</p>
      <p>Please find attached the design PDF for a new plate order with the following details:</p>
      <ul>
        <li><strong>Job Name:</strong> ${input.jobName}</li>
        ${input.jobCardNumber ? `<li><strong>Job Card Number:</strong> ${input.jobCardNumber}</li>` : ''}
        <li><strong>Customer:</strong> ${input.customerName}</li>
        <li><strong>Design File:</strong> ${input.pdfName}</li>
        <li><strong>Plate Type:</strong> ${input.plateType}</li>
        ${input.colorProfile ? `<li><strong>Color Profile:</strong> ${input.colorProfile}${input.colorProfile === 'other' && input.otherColorProfileDetail ? ` (${input.otherColorProfileDetail})` : ''}</li>` : ''}
      </ul>
      <p>The PDF design is attached to this email.</p>
      <p>Thank you,<br/>PrintFlow System</p>
    `;

    let attachment;
    if (input.pdfDataUri && input.pdfDataUri.startsWith('data:application/pdf;base64,')) {
      const base64Content = input.pdfDataUri.split(',')[1];
      if (!base64Content) {
        console.error("[SendPlateEmailFlow] PDF Data URI is invalid (empty content).");
        return { success: false, message: "PDF Data URI is invalid (empty content), cannot attach file." };
      }
      attachment = {
        filename: input.pdfName,
        content: Buffer.from(base64Content, 'base64'),
        contentType: 'application/pdf',
      };
    } else {
      console.error("[SendPlateEmailFlow] PDF Data URI is missing or invalid for email attachment.");
      return { success: false, message: "PDF Data URI is missing or invalid, cannot attach file." };
    }

    const emailResult = await sendEmailService(
      PLATE_MAKER_EMAIL,
      subject,
      htmlBody,
      attachment ? [attachment] : undefined
    );

    if (emailResult.success) {
      return { success: true, message: `Email successfully sent to ${PLATE_MAKER_EMAIL}.`, messageId: emailResult.messageId };
    } else {
      return { success: false, message: `Failed to send email: ${emailResult.error || 'Unknown error'}` };
    }
  }
);
