/**
 * Utility to extract a clean referral username or code from raw user input,
 * which may be a plain username, a query string, or a full shareable referral URL.
 */
export function parseReferralInput(value: string): string {
  let trimmed = value.trim();
  if (!trimmed) return '';

  const refParamMatch = trimmed.match(/[?&]ref=([^&#\s]+)/i);
  if (refParamMatch && refParamMatch[1]) {
    try {
      trimmed = decodeURIComponent(refParamMatch[1]).trim();
    } catch {
      trimmed = refParamMatch[1].trim();
    }
  } else {
    try {
      const url = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
      const ref = url.searchParams.get('ref');
      if (ref) trimmed = ref.trim();
    } catch {
      // Not a parseable URL, treat as raw code
    }
  }

  // Strip trailing slashes, URL fragment markers, or whitespace
  return trimmed.replace(/[/#]+$/, '');
}
