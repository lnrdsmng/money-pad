/**
 * Prepares chapter HTML for rendering in reader and preview views.
 * Preserves author formatting such as empty paragraphs/lines created by pressing Enter twice.
 */
import DOMPurify from 'dompurify';

export function formatChapterHtml(html: string): string {
  if (!html) return '';

  // TipTap/ProseMirror serializes empty paragraphs as <p></p>.
  // In standard HTML rendering, <p></p> has 0 height and collapses with adjacent margins.
  // Converting <p></p> or whitespace-only <p> </p> to <p><br></p> ensures all browsers
  // preserve the full blank line gap created by the author.
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'h4',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr', 'mark', 'span', 'div', 'a', 'img'],
    ALLOWED_ATTR: ['href', 'title', 'rel', 'src', 'alt', 'width', 'height'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  }).replace(/<p>(\s*)<\/p>/gi, '<p><br></p>');
}
