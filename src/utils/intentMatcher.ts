import type { Product } from '../types';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'for', 'with', 'in', 'on', 'of', 'to', 'and', 'or', 'by',
  'at', 'is', 'are', 'my', 'i', 'want', 'need', 'looking', 'buy', 'get',
]);

function tokenizeQuery(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .trim()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((t) => !STOP_WORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));
  return [...new Set(tokens)];
}

function tokenizeText(text: string): Set<string> {
  return new Set(
    text
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t)),
  );
}

export type RankedProduct<P> = P & {
  relevanceScore: number;
  matchedTokenCount: number;
};

export function rankProductsByIntent<P extends Product>(
  query: string,
  products: P[],
): RankedProduct<P>[] {
  const queryTokens = tokenizeQuery(query);
  if (queryTokens.length === 0) return [];

  const cleanedQuery = queryTokens.join(' ');
  const phraseBonus = queryTokens.length >= 2 ? 100 : 0;

  const ranked: RankedProduct<P>[] = [];

  for (const product of products) {
    const titleText = String(product.title || '').toLowerCase();
    const brandText = String(product.brandName || '').toLowerCase();
    const variantText = [...(product.colors || []), ...(product.sizes || []), ...(product.keywords || [])]
      .join(' ')
      .toLowerCase();
    const descText = String(product.teaser || '').toLowerCase();

    const titleTokens = tokenizeText(titleText);
    const brandVariantTokens = tokenizeText(brandText + ' ' + variantText);
    const descTokens = tokenizeText(descText);

    let score = 0;
    let matchedTokenCount = 0;

    if (phraseBonus > 0 && titleText.includes(cleanedQuery)) {
      score += phraseBonus;
    }

    for (const token of queryTokens) {
      if (titleTokens.has(token)) {
        score += 30;
        matchedTokenCount += 1;
      } else if (brandVariantTokens.has(token)) {
        score += 20;
        matchedTokenCount += 1;
      } else if (descTokens.has(token)) {
        score += 10;
        matchedTokenCount += 1;
      }
    }

    if (matchedTokenCount === 0) continue;

    if (queryTokens.length > 1 && matchedTokenCount === queryTokens.length) {
      score += 50;
    }

    ranked.push({ ...product, relevanceScore: score, matchedTokenCount });
  }

  ranked.sort(
    (a, b) =>
      b.relevanceScore - a.relevanceScore ||
      b.matchedTokenCount - a.matchedTokenCount ||
      b.autoBounty - a.autoBounty,
  );

  return ranked;
}
