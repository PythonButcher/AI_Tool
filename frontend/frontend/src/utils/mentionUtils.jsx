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
    if(lastAtIndex === -1) {
        return null;
    }
    // Make space before '@' is a space or start of text
    const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
    if(lastAtIndex > 0 && charBeforeAt && charBeforeAt.trim() !== '') {
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
/**
 * Extracts all mention tokens from a text string.
 * @param {string} text - e.g. "Analyze @Sales2023 and @Marketing_Data"
 * @returns {string[]} - e.g. ["Sales2023", "Marketing_Data"]
 */
export function extractTokens(text){
    if (!text) return [];


    const matches = text.match(/@(\w+)/g);

    if(!matches) {
        return []
    }

    // The match includes the '@' (e.g. "@Sales"), so we slice it off
    return matches.map(token => token.substring(1));

}


export function tokenToDataset() {

}




