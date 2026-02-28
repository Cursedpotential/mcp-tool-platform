import { BaseExtractor, Document, BaseNode } from 'llamaindex';

export interface ForensicFlag {
  category: string;
  rule: string;
  trigger: string;
}

/**
 * Ported from legacy ConflictAnalysisApp / message_analyzer.py
 * 
 * Automatically scans incoming text chunks for behavioral patterns and maps them
 * to legal/forensic indicators (MCL 722.23 factors).
 */
export class BehavioralFlagExtractor extends BaseExtractor {
  
  // A core sample of the 300+ patterns from legacy seed-patterns.ts
  private behavioralRules = [
    // Gaslighting
    { category: "Gaslighting", rule: "Denial of events", regex: /\b(never\s+locked\s+a\s+door|you're\s+crazy|i\s+never\s+did\s+that|your\s+fault|stop\s+making\s+things\s+up|i\s+never\s+said\s+that|that\s+never\s+happened|you\s+imagined|you're\s+paranoid)\b/gi },
    
    // Blame Shifting
    { category: "Blame Shifting", rule: "Direct blame", regex: /\b(this\s+is\s+your\s+fault|you\s+made\s+me|because\s+of\s+you|you\s+started\s+this|you\s+always\s+do\s+this|look\s+what\s+you\s+made\s+me\s+do)\b/gi },
    
    // Minimizing
    { category: "Minimizing", rule: "Trivializing emotions", regex: /\b(not\s+a\s+big\s+deal|you're\s+too\s+sensitive|calm\s+down|you're\s+being\s+dramatic|get\s+over\s+it|stop\s+making\s+a\s+scene)\b/gi },
    
    // DARVO (Deny, Attack, Reverse Victim/Offender)
    { category: "DARVO: Deny", rule: "Character defense", regex: /\b(i\s+would\s+never|that's\s+not\s+true|you're\s+making\s+that\s+up|that's\s+a\s+lie)\b/gi },
    { category: "DARVO: Attack", rule: "Abuser projection", regex: /\b(you're\s+the\s+abusive\s+one|you're\s+manipulating|you're\s+gaslighting\s+me|you're\s+toxic|you're\s+unstable)\b/gi },
    { category: "DARVO: Reverse", rule: "Victim claim", regex: /\b(i'm\s+the\s+victim\s+here|you're\s+attacking\s+me|why\s+are\s+you\s+doing\s+this\s+to\s+me)\b/gi },

    // MCL Specific
    { category: "Rule 3.1 Substance Accusation", rule: "Accusations of substance abuse or instability", regex: /\b(meth|tweaker|pill\s+head|drunk|alcoholic|high|drug\s+addict|crazy|bipolar|psycho)\b/gi },
    { category: "Rule 5.1 Volatility/Threats", rule: "Physical threats or severe volatility", regex: /\b(kill\s+you|beat\s+you|kick\s+your\s+ass|hurt\s+you|burn|destroy)\b/gi },
    { category: "Rule X.2 Parental Leverage", rule: "Using children as leverage or control", regex: /\b(you\s+won't\s+see\s+her|keeping\s+her|my\s+child|taking\s+the\s+kids|never\s+seeing\s+them)\b/gi },
    { category: "Rule C Alienation", rule: "Parental alienation or preventing contact", regex: /\b(no\s+visitation|cancel\s+visit|you\s+don't\s+deserve|she\s+doesn't\s+want\s+to\s+see\s+you)\b/gi },
    
    // Legal Threats
    { category: "Legal/Court Intimidation", rule: "Threats involving legal action, police, or CPS", regex: /\b(call\s+cps|call\s+the\s+police|call\s+the\s+cops|take\s+you\s+to\s+court|my\s+lawyer|sue\s+you|restraining\s+order)\b/gi }
  ];

  /**
   * Implementation of the LlamaIndex BaseExtractor interface.
   * Scans nodes and injects forensic flags into metadata.
   */
  async extract(nodes: BaseNode[]): Promise<Record<string, unknown>[]> {
    const extractedMetadataList: Record<string, unknown>[] = [];

    for (const node of nodes) {
      const text = node.getContent('text');
      const flags: ForensicFlag[] = [];

      // Scan the chunk against all behavioral regex rules
      for (const rule of this.behavioralRules) {
        const matches = text.match(rule.regex);
        if (matches && matches.length > 0) {
          flags.push({
            category: rule.category,
            rule: rule.rule,
            // Only store unique triggers matched in this chunk to save space
            trigger: [...new Set(matches.map(m => m.toLowerCase()))].join(', ')
          });
        }
      }

      // Return the metadata object to merge into the node
      const metadataToMerge: Record<string, unknown> = {};
      
      if (flags.length > 0) {
        metadataToMerge['forensic_flags'] = flags;
        // Also stringify for easy vector-database keyword searching later
        metadataToMerge['forensic_categories_string'] = flags.map(f => f.category).join(' | ');
      }

      extractedMetadataList.push(metadataToMerge);
    }

    return extractedMetadataList;
  }
}

