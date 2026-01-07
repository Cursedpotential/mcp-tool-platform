/**
 * Dynamic Lexicon Importer
 * 
 * Fetches and imports linguistic lexicons from GitHub repositories
 * Supports: HurtLex, MCL patterns, and custom lexicons
 * 
 * Architecture:
 * - Extensible: Add new lexicons via configuration
 * - Filtered: Language-specific filtering (English only by default)
 * - Versioned: Track lexicon versions and updates
 * - Conflict resolution: Handle duplicate patterns across lexicons
 */

import { getDb } from '../../db';
import { behavioralPatterns } from '../../../drizzle/schema';

export interface LexiconConfig {
  name: string;
  source: 'github' | 'url' | 'local';
  repo?: string; // For GitHub: 'owner/repo'
  path?: string; // File path within repo or URL
  format: 'csv' | 'json' | 'txt';
  language_filter?: string; // 'en', 'es', etc.
  category_mapping?: Record<string, string>; // Map lexicon categories to our categories
  priority?: number; // Higher = takes precedence in conflicts
  enabled?: boolean;
}

export const LEXICON_REGISTRY: LexiconConfig[] = [
  {
    name: 'HurtLex',
    source: 'github',
    repo: 'valeriobasile/hurtlex',
    path: 'lexica/EN/1.2/hurtlex_EN.tsv',
    format: 'csv',
    language_filter: 'en',
    category_mapping: {
      'negative_stereotypes_ethnic': 'hate_speech',
      'profanity': 'profanity',
      'hate_speech': 'hate_speech',
      'derogatory': 'derogatory',
      'offensive': 'offensive',
      'slurs': 'slurs',
      'sexual': 'sexual_content',
      'violence': 'violence',
    },
    priority: 10,
    enabled: true,
  },
  // Add more lexicons here
];

export interface LexiconEntry {
  term: string;
  category: string;
  severity?: number;
  source_lexicon: string;
  source_category?: string;
  language?: string;
  metadata?: Record<string, any>;
}

export class LexiconImporter {
  /**
   * Import all enabled lexicons
   */
  async importAll(): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const config of LEXICON_REGISTRY) {
      if (!config.enabled) {
        console.log(`⏭️  Skipping disabled lexicon: ${config.name}`);
        continue;
      }

      try {
        console.log(`📥 Importing lexicon: ${config.name}`);
        const result = await this.importLexicon(config);
        results.imported += result.imported;
        results.skipped += result.skipped;
        console.log(`✅ ${config.name}: ${result.imported} imported, ${result.skipped} skipped`);
      } catch (error) {
        const errorMsg = `Failed to import ${config.name}: ${error}`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    return results;
  }

  /**
   * Import a single lexicon
   */
  async importLexicon(config: LexiconConfig): Promise<{
    imported: number;
    skipped: number;
  }> {
    // Fetch lexicon data
    const rawData = await this.fetchLexicon(config);
    
    // Parse based on format
    const entries = await this.parseLexicon(rawData, config);
    
    // Filter by language if specified
    const filtered = config.language_filter
      ? entries.filter(e => e.language === config.language_filter)
      : entries;
    
    console.log(`  📊 Fetched ${entries.length} entries, filtered to ${filtered.length}`);
    
    // Import into database
    return await this.importEntries(filtered, config);
  }

  /**
   * Fetch lexicon from source
   */
  private async fetchLexicon(config: LexiconConfig): Promise<string> {
    if (config.source === 'github') {
      // Fetch from GitHub raw content
      const url = `https://raw.githubusercontent.com/${config.repo}/master/${config.path}`;
      console.log(`  🌐 Fetching from: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.text();
    } else if (config.source === 'url') {
      const response = await fetch(config.path!);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } else {
      // Local file
      const fs = await import('fs/promises');
      return await fs.readFile(config.path!, 'utf-8');
    }
  }

  /**
   * Parse lexicon data based on format
   */
  private async parseLexicon(data: string, config: LexiconConfig): Promise<LexiconEntry[]> {
    if (config.format === 'csv') {
      return this.parseCSV(data, config);
    } else if (config.format === 'json') {
      return this.parseJSON(data, config);
    } else {
      return this.parseTXT(data, config);
    }
  }

  /**
   * Parse CSV/TSV format
   */
  private parseCSV(data: string, config: LexiconConfig): LexiconEntry[] {
    const lines = data.split('\n').filter(l => l.trim());
    const entries: LexiconEntry[] = [];
    
    // Detect delimiter (comma or tab)
    const delimiter = data.includes('\t') ? '\t' : ',';
    
    // Skip header row
    const rows = lines.slice(1);
    
    for (const row of rows) {
      const cols = row.split(delimiter);
      
      // HurtLex format: lemma, category, level, stereotyped_group, lang
      if (config.name === 'HurtLex') {
        const [lemma, category, level, , lang] = cols;
        
        if (!lemma || !category) continue;
        
        entries.push({
          term: lemma.trim().toLowerCase(),
          category: this.mapCategory(category.trim(), config),
          severity: level ? parseInt(level) : 5,
          source_lexicon: config.name,
          source_category: category.trim(),
          language: lang?.trim().toLowerCase() || 'en',
        });
      } else {
        // Generic CSV: term, category, severity (optional)
        const [term, category, severity] = cols;
        
        if (!term || !category) continue;
        
        entries.push({
          term: term.trim().toLowerCase(),
          category: this.mapCategory(category.trim(), config),
          severity: severity ? parseInt(severity) : 5,
          source_lexicon: config.name,
          source_category: category.trim(),
        });
      }
    }
    
    return entries;
  }

  /**
   * Parse JSON format
   */
  private parseJSON(data: string, config: LexiconConfig): LexiconEntry[] {
    const json = JSON.parse(data);
    const entries: LexiconEntry[] = [];
    
    // Assume array of objects with term, category, severity fields
    for (const item of json) {
      entries.push({
        term: item.term?.toLowerCase() || item.word?.toLowerCase(),
        category: this.mapCategory(item.category, config),
        severity: item.severity || 5,
        source_lexicon: config.name,
        source_category: item.category,
        language: item.language || 'en',
        metadata: item,
      });
    }
    
    return entries;
  }

  /**
   * Parse plain text format (one term per line)
   */
  private parseTXT(data: string, config: LexiconConfig): LexiconEntry[] {
    const lines = data.split('\n').filter(l => l.trim());
    const entries: LexiconEntry[] = [];
    
    for (const line of lines) {
      const term = line.trim().toLowerCase();
      if (!term) continue;
      
      entries.push({
        term,
        category: 'general', // Default category
        severity: 5,
        source_lexicon: config.name,
      });
    }
    
    return entries;
  }

  /**
   * Map lexicon category to our category system
   */
  private mapCategory(sourceCategory: string, config: LexiconConfig): string {
    if (!config.category_mapping) return sourceCategory;
    
    const mapped = config.category_mapping[sourceCategory.toLowerCase()];
    return mapped || sourceCategory;
  }

  /**
   * Import entries into database
   */
  private async importEntries(
    entries: LexiconEntry[],
    config: LexiconConfig
  ): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    
    // Batch insert (50 at a time)
    const batchSize = 50;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      const patterns = batch.map(entry => ({
        name: entry.term,
        category: entry.category,
        pattern: entry.term, // Exact match
        description: `From ${entry.source_lexicon}${entry.source_category ? ` (${entry.source_category})` : ''}`,
        severity: entry.severity || 5,
        isRegex: false,
        isEnabled: true,
        metadata: {
          source_lexicon: entry.source_lexicon,
          source_category: entry.source_category,
          language: entry.language,
          ...entry.metadata,
        },
      }));
      
      try {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        await db.insert(behavioralPatterns).values(patterns);
        imported += batch.length;
      } catch (error) {
        // Skip duplicates
        console.warn(`  ⚠️  Batch insert failed (likely duplicates): ${error}`);
        skipped += batch.length;
      }
    }
    
    return { imported, skipped };
  }

  /**
   * Update lexicon (re-import latest version)
   */
  async updateLexicon(lexiconName: string): Promise<void> {
    const config = LEXICON_REGISTRY.find(l => l.name === lexiconName);
    if (!config) {
      throw new Error(`Lexicon not found: ${lexiconName}`);
    }
    
    console.log(`🔄 Updating lexicon: ${lexiconName}`);
    
    // Delete existing entries from this lexicon
    // (Assuming we add a source_lexicon field to behavioralPatterns)
    // await db.delete(behavioralPatterns).where(eq(behavioralPatterns.metadata.source_lexicon, lexiconName));
    
    // Re-import
    await this.importLexicon(config);
  }
}

/**
 * Convenience function to import all lexicons
 */
export async function importAllLexicons() {
  const importer = new LexiconImporter();
  return await importer.importAll();
}
