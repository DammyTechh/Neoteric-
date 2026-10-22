/**
 * Turns a stored prose setting into paragraphs.
 *
 * `about.body` has been through several shapes — a JSON array, a JSON string
 * with real blank lines, and (when a newline is lost somewhere between the SQL
 * editor and the database) one unbroken blob. The Who We Are section renders
 * one row per paragraph, so a blob collapses the whole section onto a single
 * row, which is how four paragraphs ended up looking like one slab of text.
 *
 * Rather than trusting one shape, this accepts all of them and guarantees a
 * sensible number of paragraphs back. The section can then never degrade to a
 * single row, whatever the database happens to hold.
 */
export function toParagraphs(value: unknown, target = 4): string[] {
  // Already a list — the least fragile shape, and what the migrations now store.
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (typeof value !== 'string') return [];

  /*
   * A literal backslash-n means the escape survived as two characters instead
   * of becoming a newline — a JSON string that was quoted one time too many.
   * Reading it as the newline it was meant to be is more useful than printing
   * "\n" to a visitor.
   */
  const text = value.replace(/\\r\\n|\\n/g, '\n').trim();
  if (!text) return [];

  // Blank-line separated: the documented shape.
  const byBlankLine = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (byBlankLine.length > 1) return byBlankLine;

  // Single newlines, for text pasted from a word processor.
  const byLine = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  if (byLine.length > 1) return byLine;

  // One unbroken blob: fall back to grouping sentences.
  return groupSentences(text, target);
}

/**
 * Splits one blob into roughly equal paragraphs on sentence boundaries.
 *
 * Balanced by character count rather than sentence count, because the
 * sentences in this copy vary from eight words to forty and an even split by
 * count produces one line beside one full column.
 */
function groupSentences(text: string, target: number): string[] {
  const sentences =
    text.match(/[^.!?]+[.!?]+(?=\s|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [];

  if (sentences.length <= 1) return [text];
  if (sentences.length <= target) return sentences;

  const total = sentences.reduce((sum, s) => sum + s.length, 0);
  const share = total / target;

  const groups: string[][] = [];
  let current: string[] = [];
  let consumed = 0;

  sentences.forEach((sentence, index) => {
    current.push(sentence);
    consumed += sentence.length;

    const groupsLeft = target - groups.length - 1;
    const sentencesLeft = sentences.length - index - 1;

    // Close this group once it has taken its share — but only while enough
    // sentences remain to give every later group at least one.
    if (
      groupsLeft > 0 &&
      consumed >= share * (groups.length + 1) &&
      sentencesLeft >= groupsLeft
    ) {
      groups.push(current);
      current = [];
    }
  });

  if (current.length > 0) groups.push(current);

  return groups.map((group) => group.join(' '));
}
