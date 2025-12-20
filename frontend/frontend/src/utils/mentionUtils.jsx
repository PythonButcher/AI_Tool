/**
 * Checks if the user is actively typing a mention token.
 * @param {string} text - The full text from the input/textarea.
 * @param {number} cursorPosition - The current cursor position (selectionStart).
 * @returns {string | null} - The search query (text after @) if active, otherwise null.
 */


export const detectToken = (text, cursorPosition) => {
  const textBeforeCursor = text.substring(0, cursorPosition);

  // find the '@' symbol before the cursor
  const lastAtIndex = textBeforeCursor.lastIndexOf('@');

  // If no '@' was found, were not in a mention
  if (lastAtIndex === -1) {
    return null;
  }
  // Make space before '@' is a space or start of text
  const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
  if (lastAtIndex > 0 && charBeforeAt && charBeforeAt.trim() !== '') {
    return null;
  }
  // Get text from '@' to cursor. Potential Token.
  const query = textBeforeCursor.substring(lastAtIndex + 1);
  // Check if the query contains *any* whitespace (space, tab, newline)
  const hasBreakingChar = /\s/.test(query);

  if (hasBreakingChar) {
    // The user typed "@bob smith". The active mention is broken.
    return null;
  }

  return query;
}

export function extractTokens(text) {
  if (!text || typeof text !== "string") return [];

  // Match @ followed by valid dataset name characters (alphanumeric, underscores)
  // Stops at punctuation, spaces, or end of string.
  // Example: "Compare @Sales_2023, and @Marketing." -> captures "Sales_2023", "Marketing"
  const matches = text.match(/@([a-zA-Z0-9_]+)/g);

  if (!matches) return [];

  // Remove '@', dedupe
  const names = matches.map(m => m.slice(1));
  return Array.from(new Set(names));
}





export function tokenToDataset(tokens, datasets) {
  // 1. Validate inputs
  if (!Array.isArray(tokens) || !Array.isArray(datasets)) {
    return [];
  }

}




