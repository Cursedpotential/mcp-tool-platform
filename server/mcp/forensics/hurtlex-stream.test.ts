/**
 * HurtLex Stream Tests
 * Tests the streaming HurtLex service (no local storage)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { hurtlexStream } from './hurtlex-stream';

describe('HurtLex Stream Tests', () => {
  it('should fetch terms without local storage', async () => {
    const terms = await hurtlexStream.fetchTerms();
    expect(terms.length).toBeGreaterThan(0);
    expect(terms[0]).toHaveProperty('term');
    expect(terms[0]).toHaveProperty('category');
    expect(terms[0]).toHaveProperty('language');
    expect(terms[0].language).toBe('EN');
  }, 30000); // 30 second timeout for network request

  it('should filter terms by categories', async () => {
    // Use lowercase to match the data
    const filteredTerms = await hurtlexStream.fetchTerms(['ps', 'asm']); // Ethnic slurs + Male genitalia
    expect(filteredTerms.length).toBeGreaterThan(0);

    // All terms should be in the requested categories
    const categories = new Set(filteredTerms.map(t => t.category));
    expect(categories.size).toBeGreaterThan(0); // At least one category should be present
    expect(filteredTerms.every(t => ['ps', 'asm'].includes(t.category))).toBe(true);
  }, 30000);

  it('should search terms by query', async () => {
    const results = await hurtlexStream.searchTerms('stupid');
    expect(results.length).toBeGreaterThan(0);

    // All results should contain the search term
    results.forEach(term => {
      expect(term.term.toLowerCase()).toContain('stupid');
    });
  }, 30000);

  it('should match text against HurtLex terms', async () => {
    const testText = "You are so stupid and worthless. You're an idiot.";
    const matches = await hurtlexStream.matchText(testText);

    expect(matches.length).toBeGreaterThan(0);

    // Should find matches for offensive words
    const matchedTerms = matches.map(m => m.term.term);
    expect(matchedTerms.some(term => term.includes('stupid') || term.includes('worthless') || term.includes('idiot'))).toBe(true);
  }, 30000);

  it('should get category counts', async () => {
    const counts = await hurtlexStream.getCategoryCounts();
    expect(counts.size).toBeGreaterThan(0);

    // Should have counts for various categories
    const categoryNames = Array.from(counts.keys());
    expect(categoryNames.length).toBeGreaterThan(5); // At least 5 categories
  }, 30000);

  it('should cache terms in memory', async () => {
    // Clear any existing cache
    hurtlexStream.clearCache();
    expect(hurtlexStream.getCacheStatus().cached).toBe(false);

    // First call should fetch from GitHub and cache
    await hurtlexStream.fetchTerms();
    expect(hurtlexStream.getCacheStatus().cached).toBe(true);
    expect(hurtlexStream.getCacheStatus().termCount).toBeGreaterThan(8000);

    // Second call should use cache
    const terms = await hurtlexStream.fetchTerms();
    expect(terms.length).toBeGreaterThan(8000);
  }, 30000);

  it('should get cache status', () => {
    const status = hurtlexStream.getCacheStatus();
    expect(status).toHaveProperty('cached');
    expect(status).toHaveProperty('termCount');
    expect(status).toHaveProperty('age');
  });

  it('should clear cache', async () => {
    // Load cache
    await hurtlexStream.fetchTerms();
    expect(hurtlexStream.getCacheStatus().cached).toBe(true);

    // Clear cache
    hurtlexStream.clearCache();
    expect(hurtlexStream.getCacheStatus().cached).toBe(false);
  });

  it('should stream terms', async () => {
    const streamedTerms: any[] = [];
    for await (const term of hurtlexStream.streamTerms()) {
      streamedTerms.push(term);
      if (streamedTerms.length >= 10) break; // Just test first 10
    }

    expect(streamedTerms.length).toBe(10);
    streamedTerms.forEach(term => {
      expect(term).toHaveProperty('term');
      expect(term).toHaveProperty('category');
    });
  }, 30000);
});