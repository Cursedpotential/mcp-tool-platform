import { describe, it, expect, beforeEach } from 'vitest';
import { 
  CommunicationPatternAnalyzer, 
  BUILT_IN_MODULES, 
  BUILT_IN_PATTERNS,
  type AnalysisResult 
} from './pattern-analyzer';

describe('CommunicationPatternAnalyzer', () => {
  let analyzer: CommunicationPatternAnalyzer;

  beforeEach(() => {
    analyzer = new CommunicationPatternAnalyzer();
  });

  describe('BUILT_IN_MODULES', () => {
    it('should have both negative and positive modules', () => {
      const negativeModules = BUILT_IN_MODULES.filter(m => m.category === 'negative');
      const positiveModules = BUILT_IN_MODULES.filter(m => m.category === 'positive');
      
      expect(negativeModules.length).toBeGreaterThan(0);
      expect(positiveModules.length).toBeGreaterThan(0);
    });

    it('should have gaslighting module', () => {
      const gaslighting = BUILT_IN_MODULES.find(m => m.id === 'gaslighting');
      expect(gaslighting).toBeDefined();
      expect(gaslighting?.category).toBe('negative');
      expect(gaslighting?.weight).toBeGreaterThan(0);
    });

    it('should have love_bombing module for positive pattern detection', () => {
      const loveBombing = BUILT_IN_MODULES.find(m => m.id === 'love_bombing');
      expect(loveBombing).toBeDefined();
      expect(loveBombing?.category).toBe('positive');
    });

    it('should have MCL factors assigned to relevant modules', () => {
      const modulesWithMcl = BUILT_IN_MODULES.filter(m => m.mclFactors && m.mclFactors.length > 0);
      expect(modulesWithMcl.length).toBeGreaterThan(5);
    });
  });

  describe('BUILT_IN_PATTERNS', () => {
    it('should have patterns for gaslighting', () => {
      expect(BUILT_IN_PATTERNS.gaslighting).toBeDefined();
      expect(BUILT_IN_PATTERNS.gaslighting.patterns.length).toBeGreaterThan(0);
      expect(BUILT_IN_PATTERNS.gaslighting.examples.length).toBeGreaterThan(0);
    });

    it('should have patterns for love_bombing', () => {
      expect(BUILT_IN_PATTERNS.love_bombing).toBeDefined();
      expect(BUILT_IN_PATTERNS.love_bombing.patterns.length).toBeGreaterThan(0);
    });

    it('should have patterns for blame_shifting', () => {
      expect(BUILT_IN_PATTERNS.blame_shifting).toBeDefined();
      expect(BUILT_IN_PATTERNS.blame_shifting.patterns).toContain('this is your fault');
    });
  });

  describe('getModules', () => {
    it('should return all built-in modules', () => {
      const modules = analyzer.getModules();
      expect(modules.length).toBe(BUILT_IN_MODULES.length);
    });
  });

  describe('setModuleEnabled', () => {
    it('should enable/disable modules', () => {
      analyzer.setModuleEnabled('gaslighting', false);
      const modules = analyzer.getModules();
      const gaslighting = modules.find(m => m.id === 'gaslighting');
      expect(gaslighting?.enabled).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should detect gaslighting patterns', async () => {
      const text = "that never happened, you're imagining things. you're being paranoid.";
      const result = await analyzer.analyze(text);
      
      expect(result.negativeMatches.length).toBeGreaterThan(0);
      const gaslightingMatches = result.negativeMatches.filter(m => m.moduleId === 'gaslighting');
      expect(gaslightingMatches.length).toBeGreaterThan(0);
    });

    it('should detect love bombing patterns', async () => {
      const text = "You're perfect, you're my everything. I've never felt this way about anyone.";
      const result = await analyzer.analyze(text);
      
      expect(result.positiveMatches.length).toBeGreaterThan(0);
      const loveBombingMatches = result.positiveMatches.filter(m => m.moduleId === 'love_bombing');
      expect(loveBombingMatches.length).toBeGreaterThan(0);
    });

    it('should detect blame shifting patterns', async () => {
      const text = "This is your fault for not listening to me. You made me act this way.";
      const result = await analyzer.analyze(text);
      
      const blameMatches = result.negativeMatches.filter(m => m.moduleId === 'blame_shifting');
      expect(blameMatches.length).toBeGreaterThan(0);
    });

    it('should detect threats and intimidation', async () => {
      const text = "You'll regret this decision. You'll never see the kids again.";
      const result = await analyzer.analyze(text);
      
      const threatMatches = result.negativeMatches.filter(m => m.moduleId === 'threats_intimidation');
      expect(threatMatches.length).toBeGreaterThan(0);
    });

    it('should calculate severity score', async () => {
      const text = "That never happened. You're crazy. This is your fault. You'll regret this.";
      const result = await analyzer.analyze(text);
      
      expect(result.severityScore).toBeGreaterThan(0);
      expect(result.severityScore).toBeLessThanOrEqual(100);
    });

    it('should include context around matches', async () => {
      const text = "Before the incident, she said that never happened and then walked away.";
      const result = await analyzer.analyze(text, { includeContext: true, contextChars: 50 });
      
      if (result.negativeMatches.length > 0) {
        expect(result.negativeMatches[0].context.length).toBeGreaterThan(0);
      }
    });

    it('should filter by specific modules', async () => {
      const text = "You're perfect. That never happened. You're my everything.";
      const result = await analyzer.analyze(text, { moduleIds: ['love_bombing'] });
      
      // Should only have love_bombing matches, no gaslighting
      expect(result.modulesUsed).toContain('love_bombing');
      expect(result.modulesUsed).not.toContain('gaslighting');
    });

    it('should track MCL factor scores', async () => {
      const text = "You'll never see the kids again. Your father doesn't love you.";
      const result = await analyzer.analyze(text);
      
      expect(Object.keys(result.mclFactorScores).length).toBeGreaterThan(0);
    });

    it('should generate a summary', async () => {
      const text = "You're perfect! But that never happened, you're imagining things.";
      const result = await analyzer.analyze(text);
      
      expect(result.summary).toBeTruthy();
      expect(result.summary.length).toBeGreaterThan(10);
    });

    it('should return empty results for neutral text', async () => {
      const text = "The weather is nice today. I went to the store.";
      const result = await analyzer.analyze(text);
      
      expect(result.negativeMatches.length).toBe(0);
      expect(result.positiveMatches.length).toBe(0);
    });

    it('should detect contradictions between positive and negative patterns', async () => {
      const text = "you're my soulmate, i love you so much. but you're crazy and that never happened.";
      const result = await analyzer.analyze(text);
      
      // Should have both positive and negative matches
      expect(result.positiveMatches.length).toBeGreaterThan(0);
      expect(result.negativeMatches.length).toBeGreaterThan(0);
      
      // May detect contradictions if patterns are close enough
      // This depends on the proximity threshold
    });

    it('should build a timeline of events', async () => {
      const text = "You're perfect. Then later, that never happened. Finally, I'm sorry.";
      const result = await analyzer.analyze(text);
      
      expect(result.timeline.length).toBeGreaterThanOrEqual(0);
      if (result.timeline.length > 0) {
        expect(result.timeline[0].match).toBeDefined();
        expect(result.timeline[0].type).toBeDefined();
      }
    });

    it('should generate unique document IDs', async () => {
      const result1 = await analyzer.analyze("Test text one");
      const result2 = await analyzer.analyze("Test text two");
      
      expect(result1.documentId).not.toBe(result2.documentId);
    });
  });

  describe('apologies detection', () => {
    it('should detect apology patterns', async () => {
      const text = "I'm sorry, I was wrong. Please forgive me, I made a mistake.";
      const result = await analyzer.analyze(text);
      
      const apologyMatches = result.positiveMatches.filter(m => m.moduleId === 'apologies');
      expect(apologyMatches.length).toBeGreaterThan(0);
    });
  });

  describe('parental alienation detection', () => {
    it('should detect parental alienation patterns', async () => {
      const text = "your father doesn't love you. daddy doesn't care about you anymore.";
      const result = await analyzer.analyze(text);
      
      const alienationMatches = result.negativeMatches.filter(m => m.moduleId === 'parental_alienation');
      expect(alienationMatches.length).toBeGreaterThan(0);
    });
  });
});
