import nodemailer from 'nodemailer';
import { logger } from './logger.js';
import { prisma } from '../config/database.js';

/**
 * Replace placeholders like {{var}} in string with values from variables object.
 */
const parseTemplate = (template: string, variables: Record<string, string>): string => {
  let parsed = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    parsed = parsed.replace(regex, value);
  }
  return parsed;
};

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

/**
 * Send email based on template type or fallback strings with optional attachments.
 */
export const sendEmail = async (
  to: string,
  subjectFallback: string,
  textFallback: string,
  htmlFallback?: string,
  templateType?: string,
  language: string = "en",
  variables?: Record<string, string>,
  attachments?: EmailAttachment[]
) => {
  try {
    let finalSubject = subjectFallback;
    let finalText = textFallback;
    let finalHtml = htmlFallback || textFallback;

    // If templateType provided, try to find and parse template
    if (templateType) {
      const template = await prisma.mailTemplate.findUnique({
        where: { type_language: { type: templateType, language: language } }
      });
      if (template) {
        finalSubject = variables ? parseTemplate(template.subject, variables) : template.subject;
        finalText = variables ? parseTemplate(template.bodyText, variables) : template.bodyText;
        finalHtml = variables ? parseTemplate(template.bodyHtml, variables) : template.bodyHtml;
      }
    }

    const mailConfig = await prisma.mailConfig.findFirst({
      orderBy: { id: "desc" },
    });

    if (!mailConfig || !mailConfig.isActive) {
      logger.info('No active mail configuration found. Gracefully logging email to console.');
      logger.info(`--- EMAIL START ---`);
      logger.info(`To: ${to}`);
      logger.info(`Subject: ${finalSubject}`);
      if (attachments?.length) {
        logger.info(`Attachments: ${attachments.map(a => a.filename).join(', ')}`);
      }
      logger.info(`Text Body:\n${finalText}`);
      logger.info(`--- EMAIL END ---`);
      return null;
    }

    const transporter = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.port === 465, // true for 465, false for other ports
      auth: {
        user: mailConfig.username,
        pass: mailConfig.password,
      },
    });

    const mailOptions: any = {
      from: mailConfig.fromAddress,
      to,
      subject: finalSubject,
      text: finalText,
      html: finalHtml,
    };

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Message sent: ${info.messageId}`);
    return info;

  } catch (error) {
    logger.error('Error sending email:', error);
    throw error;
  }
};
