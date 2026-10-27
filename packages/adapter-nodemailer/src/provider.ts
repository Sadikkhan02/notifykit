import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailProvider, ProviderResult } from 'notifykit/interfaces';
import { mapNodemailerError } from './error-mapper.js';
import type { NodemailerConfig } from './types.js';

/**
 * Nodemailer email provider adapter implementing the NotifyKit EmailProvider contract.
 */
export class NodemailerEmailProvider implements EmailProvider {
  readonly name = 'nodemailer';
  private readonly config: NodemailerConfig;
  private transporterInstance: Transporter | null = null;

  constructor(config: NodemailerConfig = {}) {
    this.config = config;
    if (config.transporter) {
      this.transporterInstance = config.transporter;
    }
  }

  /**
   * Lazily resolves and caches the Nodemailer transporter instance.
   */
  private getTransporter(): Transporter | null {
    if (this.transporterInstance) {
      return this.transporterInstance;
    }

    const host = this.config.host ?? process.env.SMTP_HOST;
    if (!host) {
      return null;
    }

    const rawPort =
      this.config.port ?? (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined);
    const port = rawPort && !Number.isNaN(rawPort) ? rawPort : 587;
    const secure = this.config.secure ?? port === 465;

    let auth = this.config.auth;
    if (!auth && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      auth = {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      };
    }

    this.transporterInstance = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: auth ? { user: auth.user, pass: auth.pass } : undefined,
    });

    return this.transporterInstance;
  }

  /**
   * Sends an email via the configured Nodemailer transporter.
   *
   * @param opts Email delivery parameters (to, from, subject, html, text)
   * @returns Standardized ProviderResult with retryability classification
   */
  async sendEmail(opts: {
    to: string;
    from: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<ProviderResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return {
        success: false,
        error: 'SMTP host is not configured. Set SMTP_HOST in environment or pass host in config.',
        retryable: false,
      };
    }

    const fromAddress =
      opts.from || this.config.from || process.env.SMTP_FROM || 'noreply@notifykit.dev';

    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err) {
      return mapNodemailerError(err);
    }
  }
}
