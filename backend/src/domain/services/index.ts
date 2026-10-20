/**
 * Outbound service contracts — the things the application needs from the
 * outside world. Implementations live in `infrastructure/`.
 */

export interface SendMailInput {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Template identifier, recorded in `email_logs` for traceability. */
  template: string;
  metadata?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface SendMailResult {
  messageId: string | null;
  accepted: string[];
  rejected: string[];
  skipped: boolean;
}

export interface IMailer {
  send(input: SendMailInput): Promise<SendMailResult>;

  /**
   * Sends without throwing, returning null on failure.
   *
   * For mail that is a side effect rather than the point — a contact-form
   * notification, a sign-in alert. The enquiry is already stored by then, and
   * an SMTP hiccup must not turn a successful submission into an error page.
   */
  sendQuietly(input: SendMailInput): Promise<SendMailResult | null>;

  verifyConnection(): Promise<boolean>;

  /** Releases the connection pool during graceful shutdown. */
  close(): Promise<void>;
}

export interface StoredFile {
  path: string;
  publicUrl: string;
  bucket: string;
}

export interface IFileStorage {
  upload(input: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    folder?: string;
  }): Promise<StoredFile>;
  remove(path: string): Promise<void>;
  signedUrl(path: string, expiresInSeconds: number): Promise<string>;
  ensureBucket(): Promise<void>;
}
