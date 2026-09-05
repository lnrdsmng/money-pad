/**
 * Prepares chapter HTML for rendering in reader and preview views.
 * Preserves author formatting such as empty paragraphs/lines created by pressing Enter twice.
 */
export function formatChapterHtml(html: string): string {
  if (!html) return '';

  // TipTap/ProseMirror serializes empty paragraphs as <p></p>.
  // In standard HTML rendering, <p></p> has 0 height and collapses with adjacent margins.
  // Converting <p></p> or whitespace-only <p> </p> to <p><br></p> ensures all browsers
  // preserve the full blank line gap created by the author.
  return html.replace(/<p>(\s*)<\/p>/gi, '<p><br></p>');
}
