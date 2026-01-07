/**
 * HurtLex Fetcher
 * 
 * Fetches the HurtLex lexicon from GitHub on demand and caches it in the database.
 * HurtLex is a multilingual lexicon of hurtful language for hate speech detection.
 * 
 * Source: https://github.com/valeriobasile/hurtlex
 */

import { getDb } from '../../db';
import { hurtlexTerms, hurtlexSyncStatus, hurtlexCategories } from '../../../drizzle/schema';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface HurtLexTerm {
  term: string;
  category: string;
  language: string;
  level?: string;
  pos?: string;
}

export interface HurtLexCategory {
  code: string;
  name: string;
  description: string;
}

export interface SyncStatus {
  language: string;
  status: 'pending' | 'syncing' | 'success' | 'error';
  lastSyncAt?: string;
  termCount: number;
  errorMessage?: string;
}

// ============================================================================
// CATEGORY DEFINITIONS
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
const SUPPORTED_LANGUAGES = ['EN', 'IT', 'ES', 'DE', 'FR', 'PT', 'RO', 'SL', 'HR', 'SQ', 'NL', 'PL'];

// ============================================================================
// FETCHER CLASS
// ============================================================================

export class HurtLexFetcher {
  
  /**
   * Get sync status for a language
   */
  async getSyncStatus(language: string): Promise<SyncStatus | null> {
    const db = await getDb();
    if (!db) return null;
    
    const result = await db
      .select()
      .from(hurtlexSyncStatus)
      .where(eq(hurtlexSyncStatus.language, language.toUpperCase()))
      .limit(1);
    
    if (result.length === 0) return null;
    
    const row = result[0];
    return {
      language: row.language,
      status: row.status as SyncStatus['status'],
      lastSyncAt: row.lastSyncAt || undefined,
      termCount: row.termCount,
      errorMessage: row.errorMessage || undefined
    };
  }

  /**
   * Get all sync statuses
   */
  async getAllSyncStatuses(): Promise<SyncStatus[]> {
    const db = await getDb();
    if (!db) return [];
    
    const results = await db.select().from(hurtlexSyncStatus);
    
    return results.map(row => ({
      language: row.language,
      status: row.status as SyncStatus['status'],
      lastSyncAt: row.lastSyncAt || undefined,
      termCount: row.termCount,
      errorMessage: row.errorMessage || undefined
    }));
  }

  /**
   * Fetch HurtLex lexicon from GitHub for a specific language
   */
  async fetchFromGitHub(language: string, level: 'conservative' | 'inclusive' = 'inclusive'): Promise<HurtLexTerm[]> {
    const langUpper = language.toUpperCase();
    if (!SUPPORTED_LANGUAGES.includes(langUpper)) {
      throw new Error(`Language ${language} not supported. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
    }

    const levelCode = level === 'conservative' ? '1.0' : '1.2';
    const url = `${GITHUB_BASE_URL}/${langUpper}/hurtlex_${langUpper}_${levelCode}.tsv`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch HurtLex: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    // Skip header line
    const terms: HurtLexTerm[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length >= 3) {
        terms.push({
          term: parts[2].trim(),
          category: parts[0].trim(),
          language: langUpper,
          level: level,
          pos: parts[1].trim()
        });
      }
    }

    return terms;
  }

  /**
   * Sync HurtLex to database for a language
   */
  async syncToDatabase(language: string, userId: number, level: 'conservative' | 'inclusive' = 'inclusive'): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');
    
    const langUpper = language.toUpperCase();
    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Update sync status to syncing
    await db.insert(hurtlexSyncStatus).values({
      language: langUpper,
      status: 'syncing',
      termCount: 0,
      createdAt: nowStr,
      updatedAt: nowStr
    }).onDuplicateKeyUpdate({
      set: {
        status: 'syncing',
        updatedAt: nowStr
      }
    });

    try {
      // Fetch from GitHub
      const terms = await this.fetchFromGitHub(langUpper, level);

      // Delete existing terms for this language (non-custom only)
      await db
        .delete(hurtlexTerms)
        .where(and(
          eq(hurtlexTerms.language, langUpper),
          eq(hurtlexTerms.isCustom, 'false')
        ));

      // Insert new terms in batches
      const batchSize = 100;
      for (let i = 0; i < terms.length; i += batchSize) {
        const batch = terms.slice(i, i + batchSize);
        await db.insert(hurtlexTerms).values(
          batch.map(t => ({
            userId,
            term: t.term,
            category: t.category,
            language: t.language,
            level: t.level || null,
            pos: t.pos || null,
            isActive: 'true' as const,
            isCustom: 'false' as const,
            matchCount: 0,
            createdAt: nowStr,
            updatedAt: nowStr
          }))
        );
      }

      // Update sync status to success
      await db
        .update(hurtlexSyncStatus)
        .set({
          status: 'success',
          lastSyncAt: nowStr,
          termCount: terms.length,
          sourceUrl: `${GITHUB_BASE_URL}/${langUpper}/hurtlex_${langUpper}_${level === 'conservative' ? '1.0' : '1.2'}.tsv`,
          errorMessage: null,
          updatedAt: nowStr
        })
        .where(eq(hurtlexSyncStatus.language, langUpper));

      // Update category counts
      await this.updateCategoryCounts(userId, langUpper);

      return terms.length;
    } catch (error) {
      // Update sync status to error
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await db
        .update(hurtlexSyncStatus)
        .set({
          status: 'error',
          errorMessage: errorMsg,
          updatedAt: nowStr
        })
        .where(eq(hurtlexSyncStatus.language, langUpper));

      throw error;
    }
  }

  /**
   * Update category term counts
   */
  private async updateCategoryCounts(userId: number, language: string): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Ensure all categories exist
    for (const cat of HURTLEX_CATEGORIES) {
      await db.insert(hurtlexCategories).values({
        userId,
        code: cat.code,
        name: cat.name,
        description: cat.description,
        isActive: 'true',
        termCount: 0,
        createdAt: nowStr,
        updatedAt: nowStr
      }).onDuplicateKeyUpdate({
        set: { updatedAt: nowStr }
      });
    }

    // Count terms per category
    const terms = await db
      .select()
      .from(hurtlexTerms)
      .where(eq(hurtlexTerms.language, language));

    const counts = new Map<string, number>();
    for (const term of terms) {
      counts.set(term.category, (counts.get(term.category) || 0) + 1);
    }

    // Update counts
    for (const [category, count] of Array.from(counts.entries())) {
      await db
        .update(hurtlexCategories)
        .set({ termCount: count, updatedAt: nowStr })
        .where(and(
          eq(hurtlexCategories.userId, userId),
          eq(hurtlexCategories.code, category)
        ));
    }
  }

  /**
   * Get terms for analysis
   */
  async getTerms(language: string, categories?: string[]): Promise<HurtLexTerm[]> {
    const db = await getDb();
    if (!db) return [];

    let query = db
      .select()
      .from(hurtlexTerms)
      .where(and(
        eq(hurtlexTerms.language, language.toUpperCase()),
        eq(hurtlexTerms.isActive, 'true')
      ));

    const results = await query;
    
    if (categories && categories.length > 0) {
      return results
        .filter(r => categories.includes(r.category))
        .map(r => ({
          term: r.term,
          category: r.category,
          language: r.language,
          level: r.level || undefined,
          pos: r.pos || undefined
        }));
    }

    return results.map(r => ({
      term: r.term,
      category: r.category,
      language: r.language,
      level: r.level || undefined,
      pos: r.pos || undefined
    }));
  }

  /**
   * Add custom term
   */
  async addCustomTerm(userId: number, term: HurtLexTerm): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');

    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await db.insert(hurtlexTerms).values({
      userId,
      term: term.term,
      category: term.category,
      language: term.language.toUpperCase(),
      level: term.level || null,
      pos: term.pos || null,
      isActive: 'true',
      isCustom: 'true',
      matchCount: 0,
      createdAt: nowStr,
      updatedAt: nowStr
    });
  }

  /**
   * Toggle term active status
   */
  async toggleTerm(termId: number, isActive: boolean): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');

    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await db
      .update(hurtlexTerms)
      .set({ 
        isActive: isActive ? 'true' : 'false',
        updatedAt: nowStr
      })
      .where(eq(hurtlexTerms.id, termId));
  }

  /**
   * Get categories with counts
   */
  async getCategories(userId: number): Promise<(HurtLexCategory & { termCount: number; isActive: boolean })[]> {
    const db = await getDb();
    if (!db) return [];

    const results = await db
      .select()
      .from(hurtlexCategories)
      .where(eq(hurtlexCategories.userId, userId));

    return results.map(r => ({
      code: r.code,
      name: r.name,
      description: r.description || '',
      termCount: r.termCount,
      isActive: r.isActive === 'true'
    }));
  }

  /**
   * Toggle category active status
   */
  async toggleCategory(userId: number, categoryCode: string, isActive: boolean): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');

    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await db
      .update(hurtlexCategories)
      .set({ 
        isActive: isActive ? 'true' : 'false',
        updatedAt: nowStr
      })
      .where(and(
        eq(hurtlexCategories.userId, userId),
        eq(hurtlexCategories.code, categoryCode)
      ));
  }
}

// Export singleton
export const hurtlexFetcher = new HurtLexFetcher();
