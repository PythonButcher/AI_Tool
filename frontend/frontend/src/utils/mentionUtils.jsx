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

export function extractTokens(text, datasets = []) {
  if (!text || typeof text !== "string") return [];

  const names = [];
  let remainingText = text;

  if (datasets && datasets.length > 0) {
    // Sort datasets by length descending to match longest names first
    const sortedDatasets = [...datasets].sort((a, b) => b.name.length - a.name.length);
    for (const ds of sortedDatasets) {
      const token = `@${ds.name}`;
      if (remainingText.includes(token)) {
        names.push(ds.name);
        // Remove the matched token so we don't double-match substrings
        remainingText = remainingText.split(token).join('');
      }
    }
  }

  // Match any remaining @ tokens that consist of alphanumeric/underscore chars
  const matches = remainingText.match(/@([a-zA-Z0-9_]+)/g);
  if (matches) {
    const fallbackNames = matches.map(m => m.slice(1));
    fallbackNames.forEach(name => names.push(name));
  }

  return Array.from(new Set(names));
}





export function tokenToDataset(tokens, datasets) {
  // 1. Validate inputs
  if (!Array.isArray(tokens) || !Array.isArray(datasets)) {
    return [];
  }

}




