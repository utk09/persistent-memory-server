/**
 * Improved scored full-text search for the JSON backend.
 *
 * Features vs the old searchMatches():
 *  - "quoted phrase"  → exact phrase required (highest score)
 *  - -negativeterm    → hard-excludes entries containing the term
 *  - Regular terms    → all must appear somewhere; scored by location
 *  - Results sorted by score descending; zero-score entries excluded
 */

type Scored<T> = { item: T; score: number };

function parseQuery(rawQuery: string): {
  phrases: string[];
  negative: string[];
  terms: string[];
} {
  const phrases: string[] = [];
  const negative: string[] = [];
  const terms: string[] = [];

  // Extract quoted phrases first
  let q = rawQuery;
  const phraseRegex = /"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = phraseRegex.exec(rawQuery)) !== null) {
    phrases.push(m[1].toLowerCase());
  }
  q = q.replace(/"[^"]+"/g, " ");

  // Remaining tokens: -negative or regular terms
  for (const token of q.split(/\s+/).filter(Boolean)) {
    if (token.startsWith("-") && token.length > 1) {
      negative.push(token.slice(1).toLowerCase());
    } else {
      terms.push(token.toLowerCase());
    }
  }

  return { phrases, negative, terms };
}

export function scoreSearch<T extends { title: string; content: string }>(
  items: T[],
  rawQuery: string,
): T[] {
  if (!rawQuery.trim()) return items;

  const { phrases, negative, terms } = parseQuery(rawQuery);

  const scored: Scored<T>[] = items.map((item) => {
    const titleLower = item.title.toLowerCase();
    const contentLower = item.content.toLowerCase();

    // Hard exclude: any negative term in title or content
    for (const neg of negative) {
      if (titleLower.includes(neg) || contentLower.includes(neg)) {
        return { item, score: 0 };
      }
    }

    let score = 0;

    // Quoted phrases: required — if any phrase is absent, exclude entirely
    for (const phrase of phrases) {
      if (titleLower.includes(phrase)) {
        score += 100;
      } else if (contentLower.includes(phrase)) {
        score += 30;
      } else {
        return { item, score: 0 }; // phrase required but missing
      }
    }

    // Regular terms: all must appear somewhere (title or content)
    for (const term of terms) {
      const inTitle = titleLower.includes(term);
      const inContent = contentLower.includes(term);
      if (!inTitle && !inContent) {
        return { item, score: 0 };
      }
      if (inTitle) score += 10;
      if (inContent) score += 3;
    }

    // Bonus: consecutive terms form a phrase match
    if (terms.length > 1) {
      const joined = terms.join(" ");
      if (titleLower.includes(joined)) score += 50;
      else if (contentLower.includes(joined)) score += 15;
    }

    // If query had no phrases and no terms (only negatives), include everything not excluded
    if (phrases.length === 0 && terms.length === 0) score = 1;

    return { item, score };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}
