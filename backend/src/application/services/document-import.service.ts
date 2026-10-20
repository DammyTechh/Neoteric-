import mammoth from 'mammoth';
import { AppError } from '@shared/errors/AppError';
import { createLogger } from '@shared/logger';
import { deriveExcerpt, sanitizeArticleHtml } from '@shared/utils/sanitize';

const log = createLogger('document-import');

export interface ImportedDocument {
  /** Sanitised HTML, ready to become the article body. */
  html: string;
  /** First couple of hundred characters, for the excerpt field. */
  excerpt: string | null;
  /** Images found inside the document, already extracted. */
  images: { buffer: Buffer; mimeType: string; placeholder: string }[];
  /** Non-fatal problems worth showing the editor. */
  warnings: string[];
}

/**
 * Turns an uploaded document into article content.
 *
 * This is what makes "no Drive redirects" actually achievable. The 27 articles
 * carried over from v1 exist only as Word files and PDFs on Google Drive. The
 * firm uploads one here and it becomes the page — editable afterwards like
 * anything else, not an embedded foreign object the reader has to squint at.
 *
 * Word files convert to real HTML. PDFs cannot be converted faithfully
 * (a PDF describes glyph positions, not headings and paragraphs), so those are
 * served inline by the article page's viewer instead, which is still on our
 * site rather than Drive's.
 */
export class DocumentImportService {
  /** MIME types this service can turn into HTML. */
  static readonly CONVERTIBLE = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];

  static isConvertible(mimeType: string): boolean {
    return DocumentImportService.CONVERTIBLE.includes(mimeType);
  }

  static isInlineViewable(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }

  /**
   * Converts a .docx buffer to sanitised article HTML.
   *
   * Word's own markup is a thicket of spans and inline styles, so the style map
   * below deliberately collapses it to semantic tags — the article then inherits
   * the site's typography instead of carrying Word's into the page.
   */
  async fromWord(buffer: Buffer, originalName: string): Promise<ImportedDocument> {
    if (buffer.length === 0) {
      throw AppError.unprocessable('That document is empty');
    }

    const images: ImportedDocument['images'] = [];

    try {
      const result = await mammoth.convertToHtml(
        { buffer },
        {
          styleMap: [
            // Word's Title style maps to h2, not h1: the article page already
            // renders the title as the page's single h1, and the sanitiser
            // strips h1 from bodies — which would leave this text unwrapped.
            "p[style-name='Title'] => h2:fresh",
            "p[style-name='Subtitle'] => p:fresh",
            "p[style-name='Heading 1'] => h2:fresh",
            "p[style-name='Heading 2'] => h3:fresh",
            "p[style-name='Heading 3'] => h4:fresh",
            "p[style-name='Quote'] => blockquote:fresh",
            "p[style-name='Intense Quote'] => blockquote:fresh",
          ],
          // Images are pulled out rather than inlined as base64: a document with
          // a few photographs would otherwise produce a megabytes-long row that
          // is slow to load and impossible to edit.
          convertImage: mammoth.images.imgElement(async (image) => {
            const imageBuffer = await image.read();
            const placeholder = `__neoteric_image_${images.length}__`;

            images.push({
              buffer: Buffer.from(imageBuffer),
              mimeType: image.contentType ?? 'image/png',
              placeholder,
            });

            // `altText` is present at runtime but missing from mammoth's
            // published types, so it is read defensively rather than asserted.
            const altText = (image as { altText?: string }).altText;

            return { src: placeholder, alt: altText ?? '' };
          }),
        },
      );

      const html = sanitizeArticleHtml(result.value);

      if (!html) {
        throw AppError.unprocessable(
          'No readable text was found in that document. If it is a scan, the text will need to be typed or pasted in.',
        );
      }

      const warnings = result.messages
        .filter((message) => message.type === 'warning')
        .map((message) => message.message)
        // Word documents produce dozens of near-identical style warnings;
        // showing the editor all of them is noise, not information.
        .filter((message, index, all) => all.indexOf(message) === index)
        .slice(0, 10);

      log.info(
        { originalName, bytes: buffer.length, images: images.length, warnings: warnings.length },
        'document converted',
      );

      return { html, excerpt: deriveExcerpt(html, 200), images, warnings };
    } catch (error) {
      if (error instanceof AppError) throw error;

      log.error({ err: error, originalName }, 'document conversion failed');
      throw AppError.unprocessable(
        'That file could not be read as a Word document. Please check it opens correctly and try again.',
      );
    }
  }

  /**
   * Replaces the extracted-image placeholders with the URLs they were stored at.
   *
   * Called after the images have gone into the media library, so the finished
   * body points at our own storage rather than carrying the bytes inline.
   */
  replaceImagePlaceholders(html: string, replacements: Map<string, string>): string {
    let output = html;

    for (const [placeholder, url] of replacements) {
      output = output.split(placeholder).join(url);
    }

    // Any placeholder left behind means its upload failed; drop the broken
    // image rather than rendering a visibly dead one on the article page.
    return output.replace(/<img[^>]*src="__neoteric_image_\d+__"[^>]*>/g, '');
  }
}
