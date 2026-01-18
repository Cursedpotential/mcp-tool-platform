/**
 * HurtLex Stream Service
 *
 * Streaming-only HurtLex query service - NO local storage.
 * Fetches from GitHub on demand and streams results.
 *
 * Source: https://github.com/valeriobasile/hurtlex
 */

import { query } from '../../core/db';

// ============================================================================
// TYPES
// ============================================================================

export interface HurtLexTerm {
  term: string;
  category: string;
  categoryName: string;
  language: string;
  level?: string;
  pos?: string;
}

export interface HurtLexCategory {
  code: string;
  name: string;
  description: string;
  termCount?: number;
}

// ============================================================================
// CATEGORY DEFINITIONS (Hardcoded - no DB needed)
// ============================================================================

export const HURTLEX_CATEGORIES: HurtLexCategory[] = [
  { code: 'PS', name: 'Negative Stereotypes - Ethnic Slurs', description: 'Ethnic slurs and negative stereotypes about ethnic groups' },
  { code: 'RCI', name: 'Locations & Demonyms', description: 'Locations and demonyms used as insults' },
  { code: 'PA', name: 'Professions & Occupations', description: 'Professions and occupations used as insults' },
  { code: 'DDF', name: 'Physical Disabilities & Diversity', description: 'Terms related to physical disabilities used pejoratively' },
  { code: 'DDP', name: 'Cognitive Disabilities & Diversity', description: 'Terms related to cognitive disabilities used pejoratively' },
  { code: 'DMC', name: 'Moral & Behavioral Defects', description: 'Terms describing moral or behavioral defects' },
  { code: 'IS', name: 'Words Related to Social & Economic Disadvantage', description: 'Terms related to social and economic disadvantage' },
  { code: 'OR', name: 'Plants', description: 'Plant names used as insults' },
  { code: 'AN', name: 'Animals', description: 'Animal names used as insults' },
  { code: 'ASM', name: 'Male Genitalia', description: 'Male genitalia terms used as insults' },
  { code: 'ASF', name: 'Female Genitalia', description: 'Female genitalia terms used as insults' },
  { code: 'PR', name: 'Prostitution', description: 'Terms related to prostitution' },
  { code: 'OM', name: 'Homosexuality (Male)', description: 'Derogatory terms for male homosexuality' },
  { code: 'QAS', name: 'Homosexuality (Generic)', description: 'Generic derogatory terms for homosexuality' },
  { code: 'CDS', name: 'Derogatory Words', description: 'General derogatory words' },
  { code: 'RE', name: 'Felonies & Related Words', description: 'Terms related to felonies and crimes' },
  { code: 'SVP', name: 'Words Related to Prostitution', description: 'Additional terms related to prostitution' }
];

// ============================================================================
// GITHUB URLS
// ============================================================================

const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/valeriobasile/hurtlex/master/lexica';
const ENGLISH_URL = `${GITHUB_BASE_URL}/EN/1.2/hurtlex_EN.tsv`; // Inclusive level

// ============================================================================
// CACHED TERMS (In-memory, no DB storage)
// ============================================================================

let _cachedTerms: HurtLexTerm[] | null = null;
let _cacheTimestamp: number = 0;
const CACHE_TTL = 3600000; // 1 hour cache

// ============================================================================
// STREAMING SERVICE
// ============================================================================

export class HurtLexStreamService {

  /**
   * Get category info by code
   */
  getCategory(code: string): HurtLexCategory | undefined {
    return HURTLEX_CATEGORIES.find(c => c.code === code);
  }

  /**
   * Get all categories
   */
  getAllCategories(): HurtLexCategory[] {
    return [...HURTLEX_CATEGORIES];
  }

  /**
   * Fetch terms from GitHub (streaming, no local storage)
   * Only fetches English, filters by categories if specified
   */
  async fetchTerms(categories?: string[]): Promise<HurtLexTerm[]> {
    // Check cache
    if (_cachedTerms && Date.now() - _cacheTimestamp < CACHE_TTL) {
      return this.filterTerms(_cachedTerms, categories);
    }

    console.log('[HurtLex] Fetching from GitHub (streaming, no local storage)...');

    const response = await fetch(ENGLISH_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch HurtLex: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());

    // Skip header, parse terms
    const terms: HurtLexTerm[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length >= 6) {
        const categoryCode = parts[2].trim(); // category is column 3 (index 2)
        const category = this.getCategory(categoryCode);

        terms.push({
          term: parts[4].trim().toLowerCase(), // lemma is column 5 (index 4)
          category: categoryCode,
          categoryName: category?.name || 'Unknown',
          language: 'EN',
          level: parts[5].trim(), // level is column 6 (index 5)
          pos: parts[1].trim() // pos is column 2 (index 1)
        });
      }
    }

    // Cache in memory (no DB!)
    _cachedTerms = terms;
    _cacheTimestamp = Date.now();

    console.log(`[HurtLex] Cached ${terms.length} English terms in memory`);

    return this.filterTerms(terms, categories);
  }

  /**
   * Filter terms by categories
   */
  private filterTerms(terms: HurtLexTerm[], categories?: string[]): HurtLexTerm[] {
    if (!categories || categories.length === 0) {
      return terms;
    }
    return terms.filter(t => categories.includes(t.category));
  }

  /**
   * Search terms (streaming, no DB query)
   */
  async searchTerms(query: string, categories?: string[]): Promise<HurtLexTerm[]> {
    const terms = await this.fetchTerms(categories);
    const lowerQuery = query.toLowerCase();

    return terms.filter(t =>
      t.term.includes(lowerQuery) ||
      t.categoryName.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Match text against HurtLex terms (streaming, no DB)
   * Returns unique matched terms with counts
   */
  async matchText(text: string, categories?: string[]): Promise<{ term: HurtLexTerm; count: number }[]> {
    const terms = await this.fetchTerms(categories);
    const lowerText = text.toLowerCase();

    const matches = new Map<string, HurtLexTerm>();

    // Find all matching terms
    for (const term of terms) {
      if (lowerText.includes(term.term)) {
        matches.set(term.term, term);
      }
    }

    // Count occurrences and return sorted by count
    const results: { term: HurtLexTerm; count: number }[] = [];

    for (const [_, matchedTerm] of matches) {
      const regex = new RegExp(this.escapeRegex(matchedTerm.term), 'gi');
      const count = (text.match(regex) || []).length;
      results.push({ term: matchedTerm, count });
    }

    // Sort by count descending
    return results.sort((a, b) => b.count - a.count);
  }

  /**
   * Get term count by category
   */
  async getCategoryCounts(categories?: string[]): Promise<Map<string, number>> {
    const terms = await this.fetchTerms(categories);
    const counts = new Map<string, number>();

    for (const term of terms) {
      counts.set(term.category, (counts.get(term.category) || 0) + 1);
    }

    return counts;
  }

  /**
   * Clear cache (force refetch on next request)
   */
  clearCache(): void {
    _cachedTerms = null;
    _cacheTimestamp = 0;
    console.log('[HurtLex] Cache cleared');
  }

  /**
   * Get cache status
   */
  getCacheStatus(): { cached: boolean; termCount: number; age: number | null } {
    const cached = _cachedTerms !== null && _cachedTerms.length > 0;
    const age = cached && _cacheTimestamp > 0
      ? Date.now() - _cacheTimestamp
      : null;

    return {
      cached,
      termCount: _cachedTerms?.length || 0,
      age
    };
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Stream terms for large datasets (generator)
   * Yields terms one at a time without loading all into memory
   */
  async *streamTerms(categories?: string[]): AsyncGenerator<HurtLexTerm, void, unknown> {
    // For large datasets, we'd stream from GitHub directly
    // For now, cache and stream from memory (sufficient for ~3000 terms)
    const terms = await this.fetchTerms(categories);
    for (const term of terms) {
      yield term;
    }
  }
}

// Export singleton
export const hurtlexStream = new HurtLexStreamService();

// Convenience exports
export const getHurtLexTerms = (categories?: string[]) => hurtlexStream.fetchTerms(categories);
export const searchHurtLex = (query: string, categories?: string[]) => hurtlexStream.searchTerms(query, categories);
export const matchHurtLex = (text: string, categories?: string[]) => hurtlexStream.matchText(text, categories);
export const getHurtLexCategories = () => hurtlexStream.getAllCategories();
