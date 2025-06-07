
'use server';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import type { MailOptions } from 'nodemailer/lib/sendmail-transport';

interface Attachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  encoding?: string;
}

const GMAIL_SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL;
const GMAIL_OAUTH_CLIENT_ID = process.env.GMAIL_OAUTH_CLIENT_ID;
const GMAIL_OAUTH_CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET;
const GMAIL_OAUTH_REFRESH_TOKEN = process.env.GMAIL_OAUTH_REFRESH_TOKEN;

let oauth2Client: typeof google.auth.OAuth2.prototype | null = null;

if (GMAIL_OAUTH_CLIENT_ID && GMAIL_OAUTH_CLIENT_SECRET && GMAIL_OAUTH_REFRESH_TOKEN) {
  oauth2Client = new google.auth.OAuth2(
    GMAIL_OAUTH_CLIENT_ID,
    GMAIL_OAUTH_CLIENT_SECRET
    // No redirect URI needed for server-to-server OAuth2 with refresh token
  );
  oauth2Client.setCredentials({
    refresh_token: GMAIL_OAUTH_REFRESH_TOKEN,
  });
  console.log("[EmailService] Google OAuth2 client initialized successfully.");
} else {
  console.error("[EmailService] Critical error: Missing one or more Gmail OAuth environment variables for OAuth2 client. Email service may not be fully operational.");
}

export async function sendEmailService(
  to: string,
  subject: string,
  html: string,
  attachments?: Attachment[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!GMAIL_SENDER_EMAIL) {
    return { success: false, error: "Sender email (GMAIL_SENDER_EMAIL) is not configured." };
  }
  if (!oauth2Client) {
    return { success: false, error: "Email service OAuth2 client is not configured due to missing environment variables." };
  }
  if (!GMAIL_OAUTH_CLIENT_ID || !GMAIL_OAUTH_CLIENT_SECRET || !GMAIL_OAUTH_REFRESH_TOKEN) {
      return { success: false, error: "Email service is missing OAuth credentials (ID, Secret, or Refresh Token)." };
  }

  try {
    const accessTokenResponse = await oauth2Client.getAccessToken();
    const accessToken = accessTokenResponse.token;

    if (!accessToken) {
      console.error('[EmailService] Failed to obtain access token.');
      return { success: false, error: 'Failed to obtain access token for sending email.' };
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: GMAIL_SENDER_EMAIL,
        clientId: GMAIL_OAUTH_CLIENT_ID,
        clientSecret: GMAIL_OAUTH_CLIENT_SECRET,
        refreshToken: GMAIL_OAUTH_REFRESH_TOKEN, // Still useful for nodemailer if it needs to re-verify or for other operations
        accessToken: accessToken,
      },
    });

    const mailOptions: MailOptions = {
      from: `"PrintFlow System" <${GMAIL_SENDER_EMAIL}>`, // Using GMAIL_SENDER_EMAIL
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

    const info = await transporter.sendMail(mailOptions);
    console.log('[EmailService] Email sent successfully: %s', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error: any) {
    console.error('[EmailService] Error sending email:', error);
    // Check for specific OAuth errors that might indicate token issues
    if (error.response && error.response.data && error.response.data.error === 'invalid_grant') {
        console.error('[EmailService] OAuth2 invalid_grant error. Refresh token might be invalid or revoked.');
        return { success: false, error: 'OAuth2 token error (invalid_grant). Please check credentials and re-authorize if necessary.' };
    }
    return { success: false, error: error.message || 'Failed to send email via emailService.' };
  }
}
