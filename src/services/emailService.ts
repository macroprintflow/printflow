
'use server';
import nodemailer from 'nodemailer';
import type { MailOptions } from 'nodemailer/lib/sendmail-transport';

interface Attachment {
  filename: string;
  content: Buffer | string; // Buffer for binary data, string for plain text/html (if not already part of html body)
  contentType: string;
  encoding?: string; // e.g., 'base64' if content is a base64 string not yet a buffer
}

const GMAIL_SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL;
const GMAIL_OAUTH_CLIENT_ID = process.env.GMAIL_OAUTH_CLIENT_ID;
const GMAIL_OAUTH_CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET;
const GMAIL_OAUTH_REFRESH_TOKEN = process.env.GMAIL_OAUTH_REFRESH_TOKEN;

let transporter: nodemailer.Transporter | null = null;

if (GMAIL_SENDER_EMAIL && GMAIL_OAUTH_CLIENT_ID && GMAIL_OAUTH_CLIENT_SECRET && GMAIL_OAUTH_REFRESH_TOKEN) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: GMAIL_SENDER_EMAIL,
      clientId: GMAIL_OAUTH_CLIENT_ID,
      clientSecret: GMAIL_OAUTH_CLIENT_SECRET,
      refreshToken: GMAIL_OAUTH_REFRESH_TOKEN,
    },
  });
  console.log("[EmailService] Nodemailer transporter initialized successfully.");
} else {
  console.error("[EmailService] Critical error: Missing one or more Gmail OAuth environment variables. Email service will not be operational.");
}


export async function sendEmailService(
  to: string,
  subject: string,
  html: string,
  attachments?: Attachment[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!transporter) {
    return { success: false, error: "Email service is not configured due to missing environment variables." };
  }
  if (!GMAIL_SENDER_EMAIL){
     return { success: false, error: "Sender email is not configured." };
  }

  const mailOptions: MailOptions = {
    from: `"PrintFlow System" <${GMAIL_SENDER_EMAIL}>`,
    to,
    subject,
    html,
    attachments: attachments?.map(att => ({
      filename: att.filename,
      content: att.content, 
      contentType: att.contentType,
      encoding: att.encoding,
    })),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[EmailService] Email sent successfully: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('[EmailService] Error sending email:', error);
    return { success: false, error: error.message || 'Failed to send email via emailService.' };
  }
}
