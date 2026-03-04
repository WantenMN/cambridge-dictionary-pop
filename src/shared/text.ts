const ALLOWED_NON_ASCII = new Set(["“", "”", "’", "‘", "…", "–", "—"]);

export const isAsciiOnly = (text: string): boolean => {
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    if (charCode > 127 && !ALLOWED_NON_ASCII.has(text[i])) {
      return false;
    }
  }
  return true;
};

export const countWords = (text: string): number =>
  text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

export const isValidSelectionText = (
  text: string | undefined,
  maxWords = 5,
): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (!isAsciiOnly(trimmed)) return false;
  return countWords(trimmed) <= maxWords;
};
