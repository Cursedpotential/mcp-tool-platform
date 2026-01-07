/**
 * Priority Pattern Screener (Pass 0)
 * 
 * IMMEDIATE flagging of critical patterns:
 * - Parental alienation (call blocking, visit denial)
 * - Child references (Kailah/Kyla, "my daughter", "our daughter")
 * - Custody interference
 * 
 * These bypass normal analysis and get HIGH severity automatically.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PriorityFlag {
  type: 'parental_alienation' | 'child_reference' | 'custody_interference' | 'communication_blocking';
  pattern: string;
  matched_text: string;
  context: string;
  severity: number; // Always 8-10
  position: { start: number; end: number };
  mcl_factor: string; // MCL factor this affects
}

export interface PriorityScreenResult {
  has_priority_flags: boolean;
  flags: PriorityFlag[];
  immediate_severity: number; // 8-10 if flags present
  child_mentioned: boolean;
  alienation_detected: boolean;
}

// ============================================================================
// PRIORITY PATTERNS
// ============================================================================

const PRIORITY_PATTERNS = {
  // Child name variations
  child_name: {
    patterns: [
      /\bkailah\b/gi,
      /\bkyla\b/gi,
      /\bkaila\b/gi, // Another common variant
      /\bkailuh\b/gi // Voice recognition variant
    ],
    severity: 9,
    mcl_factor: 'a', // Child's wishes
    type: 'child_reference' as const
  },
  
  // Child references
  child_reference: {
    patterns: [
      /\bmy daughter\b/gi,
      /\bour daughter\b/gi,
      /\bthe baby\b/gi,
      /\bthe kid\b/gi,
      /\bthe child\b/gi,
      /\bour child\b/gi,
      /\bmy kid\b/gi
    ],
    severity: 8,
    mcl_factor: 'a',
    type: 'child_reference' as const
  },
  
  // Call blocking
  call_blocking: {
    patterns: [
      /\bblock(ed|ing)?\s+(your|his|the)?\s*call/gi,
      /\bcan'?t\s+call/gi,
      /\bwon'?t\s+(let|allow)\s+(you|him)\s+call/gi,
      /\bno\s+phone\s+(calls?|contact)/gi,
      /\bdon'?t\s+call/gi,
      /\bstop\s+calling/gi,
      /\bignor(e|ed|ing)\s+(your|his|the)?\s*call/gi,
      /\brefus(e|ed|ing)\s+to\s+answer/gi
    ],
    severity: 10,
    mcl_factor: 'k', // Willingness to facilitate relationship
    type: 'communication_blocking' as const
  },
  
  // Visit blocking
  visit_blocking: {
    patterns: [
      /\bblock(ed|ing)?\s+(your|his|the)?\s*visit/gi,
      /\bcan'?t\s+see\s+(her|him|kailah|kyla)/gi,
      /\bwon'?t\s+(let|allow)\s+(you|him)\s+(see|visit)/gi,
      /\bno\s+visitation/gi,
      /\bcancel(ed|ing)?\s+(your|his|the)?\s*(visit|time)/gi,
      /\bdenied?\s+(your|his)?\s*(visit|time|access)/gi,
      /\bkeep(ing)?\s+(her|him|kailah|kyla)\s+from/gi,
      /\bwon'?t\s+bring\s+(her|him)/gi,
      /\brefus(e|ed|ing)\s+to\s+(bring|drop\s+off)/gi
    ],
    severity: 10,
    mcl_factor: 'k',
    type: 'parental_alienation' as const
  },
  
  // Parenting time denial
  parenting_time_denial: {
    patterns: [
      /\bno\s+parenting\s+time/gi,
      /\bcan'?t\s+have\s+(your|his)\s+time/gi,
      /\bdenied?\s+parenting\s+time/gi,
      /\binterfere?\s+with\s+(your|his)\s+time/gi,
      /\bnot\s+(your|his)\s+weekend/gi,
      /\bchanged?\s+(the|our)\s+schedule/gi,
      /\bshe'?s\s+(busy|sick|not\s+available)/gi,
      /\bcan'?t\s+make\s+it/gi
    ],
    severity: 9,
    mcl_factor: 'k',
    type: 'custody_interference' as const
  },
  
  // Custody interference
  custody_interference: {
    patterns: [
      /\bkeep(ing)?\s+(her|him|the\s+child|kailah|kyla)/gi,
      /\bhide?\s+(her|him|the\s+child)/gi,
      /\bwon'?t\s+(let|allow)\s+(you|him)\s+(have|see)/gi,
      /\bmy\s+child\s+now/gi,
      /\bnot\s+(your|his)\s+(daughter|child|kid)/gi,
      /\bstay\s+away\s+from/gi,
      /\bno\s+contact/gi,
      /\brestraining\s+order/gi,
      /\bcall(ed|ing)?\s+(the\s+)?police/gi
    ],
    severity: 10,
    mcl_factor: 'k',
    type: 'custody_interference' as const
  }
};

// ============================================================================
// PRIORITY SCREENER
// ============================================================================

export class PriorityScreener {
  /**
   * Screen text for priority patterns (Pass 0)
   */
  screen(text: string): PriorityScreenResult {
    console.log('[PriorityScreener] Screening for priority patterns...');
    
    const flags: PriorityFlag[] = [];
    let childMentioned = false;
    let alienationDetected = false;
    
    // Check each pattern category
    for (const [category, config] of Object.entries(PRIORITY_PATTERNS)) {
      for (const pattern of config.patterns) {
        const matches = Array.from(text.matchAll(pattern));
        
        for (const match of matches) {
          if (!match.index) continue;
          
          // Extract context (50 chars before/after)
          const start = Math.max(0, match.index - 50);
          const end = Math.min(text.length, match.index + match[0].length + 50);
          const context = text.slice(start, end);
          
          flags.push({
            type: config.type,
            pattern: pattern.source,
            matched_text: match[0],
            context,
            severity: config.severity,
            position: {
              start: match.index,
              end: match.index + match[0].length
            },
            mcl_factor: config.mcl_factor
          });
          
          // Track detection types
          if (config.type === 'child_reference') {
            childMentioned = true;
          }
          if (config.type === 'parental_alienation' || config.type === 'custody_interference') {
            alienationDetected = true;
          }
        }
      }
    }
    
    // Compute immediate severity
    let immediateSeverity = 5;
    if (flags.length > 0) {
      immediateSeverity = Math.max(...flags.map(f => f.severity));
    }
    
    if (flags.length > 0) {
      console.log(`[PriorityScreener] 🚨 PRIORITY FLAGS: ${flags.length} detected`);
      console.log(`[PriorityScreener] Child mentioned: ${childMentioned}`);
      console.log(`[PriorityScreener] Alienation detected: ${alienationDetected}`);
      console.log(`[PriorityScreener] Immediate severity: ${immediateSeverity}`);
    }
    
    return {
      has_priority_flags: flags.length > 0,
      flags,
      immediate_severity: immediateSeverity,
      child_mentioned: childMentioned,
      alienation_detected: alienationDetected
    };
  }
  
  /**
   * Batch screen multiple texts
   */
  screenBatch(chunks: Array<{ chunk_id: string; text: string }>): Array<{
    chunk_id: string;
    result: PriorityScreenResult;
  }> {
    console.log(`[PriorityScreener] Batch screening ${chunks.length} chunks`);
    
    const results: Array<{ chunk_id: string; result: PriorityScreenResult }> = [];
    
    for (const chunk of chunks) {
      const result = this.screen(chunk.text);
      results.push({ chunk_id: chunk.chunk_id, result });
    }
    
    const flaggedCount = results.filter(r => r.result.has_priority_flags).length;
    if (flaggedCount > 0) {
      console.log(`[PriorityScreener] 🚨 ${flaggedCount}/${chunks.length} chunks have priority flags`);
    }
    
    return results;
  }
  
  /**
   * Get summary of priority flags
   */
  summarizeFlags(flags: PriorityFlag[]): {
    by_type: Record<string, number>;
    by_mcl_factor: Record<string, number>;
    highest_severity: number;
    total_flags: number;
  } {
    const byType: Record<string, number> = {};
    const byMclFactor: Record<string, number> = {};
    let highestSeverity = 0;
    
    for (const flag of flags) {
      byType[flag.type] = (byType[flag.type] || 0) + 1;
      byMclFactor[flag.mcl_factor] = (byMclFactor[flag.mcl_factor] || 0) + 1;
      highestSeverity = Math.max(highestSeverity, flag.severity);
    }
    
    return {
      by_type: byType,
      by_mcl_factor: byMclFactor,
      highest_severity: highestSeverity,
      total_flags: flags.length
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const priorityScreener = new PriorityScreener();
