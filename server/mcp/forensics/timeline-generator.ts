/**
 * Timeline Generator & Temporal Analysis
 *
 * Extracts timestamps from text, builds chronological timelines,
 * detects abuse cycles, and generates markdown reports for forensic analysis.
 *
 * Features:
 * - Timestamp extraction (regex + NLP via compromise)
 * - Event sorting and temporal ordering
 * - Cycle of abuse detection (Lenore Walker's model)
 * - Escalation tracking and severity trends
 * - Markdown report generation
 */

import nlp from 'compromise';
import { format, parse, addDays, subDays, isValid, differenceInDays, startOfWeek, startOfMonth, endOfWeek, endOfMonth, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

export interface TimelineEvent {
  id: string;
  timestamp: Date | null;
  timestampString: string;
  temporalReference: string;
  sourceText: string;
  position: number;
  category: 'negative' | 'positive' | 'neutral';
  severity: number;
  patternType?: string;
  matchedText?: string;
  context?: string;
  sequenceIndex: number;
}

export interface CycleOfAbusePhase {
  phase: 'tension' | 'incident' | 'reconciliation' | 'calm';
  startDate: Date | null;
  endDate: Date | null;
  events: TimelineEvent[];
  indicators: string[];
  confidence: number;
}

export interface CycleOfAbuseInstance {
  id: string;
  startDate: Date | null;
  endDate: Date | null;
  phases: CycleOfAbusePhase[];
  complete: boolean;
  phaseSequence: string[];
}

export interface EscalationData {
  period: string;
  periodType: 'week' | 'month';
  startDate: Date;
  endDate: Date;
  avgSeverity: number;
  eventCount: number;
  negativeEvents: number;
  positiveEvents: number;
  trend: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';
  trendStrength: number;
}

export interface TimelineReport {
  events: TimelineEvent[];
  sortedEvents: TimelineEvent[];
  eventsByDate: Map<string, TimelineEvent[]>;
  cycleDetections: CycleOfAbuseInstance[];
  escalationData: EscalationData[];
  patternOccurrences: Record<string, number>;
  severityTrend: {
    overall: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    trendStrength: number;
  };
  phaseAnalysis: {
    phases: string[];
    durationByPhase: Record<string, number>;
    eventCountsByPhase: Record<string, number>;
  };
  markdownReport: string;
}

export interface TimestampMatch {
  text: string;
  start: number;
  end: number;
  parsedDate: Date | null;
  confidence: 'high' | 'medium' | 'low';
  temporalType: 'absolute' | 'relative' | 'contextual';
  referenceDate?: Date;
}

// ============================================================================
// REGEX PATTERNS FOR TIMESTAMP EXTRACTION
// ============================================================================

const TIME_PATTERNS = {
  // Standard time formats: "at 3:30", "at 3:30pm", "at 3:30 PM", "at 15:30"
  time: /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:am|pm|AM|PM)?(?:\s*(?:sharp|exactly|precisely))?/gi,

  // Date formats: "on 01/15/2024", "on 1/15/24", "on January 15, 2024", "on Jan 15, 2024"
  dateUS: /(?:on\s+)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/gi,

  // ISO dates: "2024-01-15", "2024/01/15"
  dateISO: /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/gi,

  // Written dates: "on January 15", "on Jan 15", "on 15th of January"
  dateWritten: /(?:on\s+)?(?:the\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?)?(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[,\s]*(\d{2,4})?/gi,

  // Day of week: "on Monday", "last Tuesday", "this Friday"
  dayOfWeek: /(?:on\s+)?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/gi,

  // Relative days: "yesterday", "today", "tomorrow", "day before yesterday"
  relativeDay: /(?:on\s+)?(today|yesterday|tomorrow|the day before yesterday|the day after tomorrow)/gi,

  // Relative weeks: "last week", "this week", "next week", "two weeks ago"
  relativeWeek: /(?:during\s+)?(last week|this week|next week|a week ago|two weeks ago|three weeks ago|a few weeks ago)/gi,

  // Relative months: "last month", "this month", "next month", "in January"
  relativeMonth: /(?:in|during)\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/gi,

  // General relative: "recently", "a while ago", "long ago", "in the past"
  relativeGeneral: /(?:a\s+)?(while ago|long ago|recently|in the past|in recent weeks|in recent months|a long time ago ages ago)/gi,

  // Time expressions with context: "that night", "the next morning", "later that evening"
  temporalContext: /(?:that\s+)?(night|morning|afternoon|evening|day)(?:\s+(?:when|before|after))?/gi,

  // Holiday/Special dates: "on Christmas", "at Easter", "on my birthday"
  specialDate: /(?:on|at)\s+(Christmas|Easter|New Year|Halloween|Thanksgiving|my birthday|her birthday|his birthday)/gi
};

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
};

const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

// ============================================================================
// CYCLE OF ABUSE INDICATORS
// ============================================================================

export const CYCLE_PHASE_INDICATORS = {
  tension: [
    // Criticism and blame
    { pattern: /\byou (?:always|never|constantly)\b/gi, weight: 3 },
    { pattern: /\byou\'re (?:so |really |just )?(?:stupid|wrong|crazy|paranoid|oversensitive|imagining things)\b/gi, weight: 4 },
    // Control behaviors
    { pattern: /\bwhere (?:are|were) you\b/gi, weight: 2 },
    { pattern: /\bwho (?:were|are) you (?:with|talking to|texting)\b/gi, weight: 3 },
    { pattern: /\b(?:why|what) (?:didn\'t |don\'t |won\'t )you (?:answer|call|respond|text)\b/gi, weight: 2 },
    // Emotional volatility
    { pattern: /\bI can\'t (?:believe|understand) you\b/gi, weight: 2 },
    { pattern: /\bafter (?:everything I\'ve done|all I\'ve sacrificed)\b/gi, weight: 3 },
    // Isolation attempts
    { pattern: /\byour (?:family|friends) (?:don\'t care|are toxic|are using you)\b/gi, weight: 4 },
    { pattern: /\bI\'m the only one who (?:understands|cares about|needs) you\b/gi, weight: 3 },
    // Walking on eggshells
    { pattern: /\bI didn\'t mean to\b/gi, weight: 1 },
    { pattern: /\bI\'m sorry (?:you felt|that you thought)\b/gi, weight: 2 }
  ],

  incident: [
    // Direct threats
    { pattern: /\b(?:you\'ll|you will) (?:regret|be sorry|pay)\b/gi, weight: 5 },
    { pattern: /\b(?:I\'ll|I will) (?:make sure|ensure) (?:you|that)\b/gi, weight: 4 },
    // Physical violence indicators
    { pattern: /\b(?:he|she|they) (?:hit|slapped|punched|threw|fell|kicked|broke)\b/gi, weight: 6 },
    { pattern: /\b(?:threw|hit) (?:something|it|him|her) (?:at|against)\b/gi, weight: 5 },
    { pattern: /\b(?:there was|there were) (?:broken|smashed|destroyed) (?:items|furniture|things)\b/gi, weight: 4 },
    // Property destruction
    { pattern: /\bbroken (?:window|door|phone|mirror|picture)\b/gi, weight: 5 },
    // Escalation words
    { pattern: /\bthat\'s (?:it|enough)|(?:I\'m|we\'re) (?:done|finished|through)\b/gi, weight: 4 },
    // Forced isolation
    { pattern: /\b(?:you\'re|you are) not (?:going to|leaving)\b/gi, weight: 5 },
    { pattern: /\b(?:I\'m|I am) (?:keeping|taking) (?:the|your) (?:kids|children)\b/gi, weight: 5 }
  ],

  reconciliation: [
    // Apologies
    { pattern: /\bI\'m (?:so |really )?(?:sorry|apologies)\b/gi, weight: 2 },
    { pattern: /\bI (?:was|wasn\'t|was not) (?:wrong|totally wrong)\b/gi, weight: 3 },
    { pattern: /\bplease (?:forgive|forgive me)\b/gi, weight: 2 },
    // Promises
    { pattern: /\bI (?:promise|swear) (?:I\'ll|I will|to) (?:never|not)\b/gi, weight: 3 },
    { pattern: /\b(?:it\'ll|it will) never (?:happen|occur) again\b/gi, weight: 3 },
    { pattern: /\bI\'(?:ll| will) change\b/gi, weight: 2 },
    // Love bombing
    { pattern: /\b(?:you\'re|you are) (?:my|the) (?:everything|soulmate|life)\b/gi, weight: 3 },
    { pattern: /\bI (?:love|adore|care about) (?:you|you so much)\b/gi, weight: 1 },
    { pattern: /\b(?:you mean|you mean everything) (?:to me)\b/gi, weight: 2 },
    // Gifts and gestures
    { pattern: /\b(?:I bought|I got) (?:you|him|her) (?:something|a gift)\b/gi, weight: 2 },
    // Minimizing the incident
    { pattern: /\bit (?:wasn\'t|was not) (?:that|a) (?:big deal|serious|bad)\b/gi, weight: 3 },
    { pattern: /\bI didn\'t (?:mean to|intend to)\b/gi, weight: 2 }
  ],

  calm: [
    // Normal behavior
    { pattern: /\bwe (?:went|went out|had dinner|watched)\b/gi, weight: 1 },
    { pattern: /\b(?:good|nice|normal) (?:day|evening|night|weekend)\b/gi, weight: 1 },
    // Future plans
    { pattern: /\bwe should (?:go|do|visit|plan)\b/gi, weight: 1 },
    { pattern: /\blet\'s (?:go out|have dinner|watch a movie)\b/gi, weight: 1 },
    // Discussing logistics
    { pattern: /\b(?:pick up|drop off|visitation|custody|schedule)\b/gi, weight: 1 },
    // Cooperative language
    { pattern: /\b(?:what works|when is good|let me know)\b/gi, weight: 1 }
  ]
};

// ============================================================================
// TIMELINE GENERATOR CLASS
// ============================================================================

export class TimelineGenerator {
  private referenceDate: Date;
  private defaultYear: number;

  constructor(referenceDate?: Date) {
    this.referenceDate = referenceDate || new Date();
    this.defaultYear = this.referenceDate.getFullYear();
  }

  // ============================================================================
  // TIMESTAMP EXTRACTION
  // ============================================================================

  extractTimestamps(text: string): TimestampMatch[] {
    const matches: TimestampMatch[] = [];

    // Extract using regex patterns
    this.extractRegexTimestamps(text, matches);

    // Extract using NLP (compromise library)
    this.extractNLPTimestamps(text, matches);

    // Sort by position and merge overlapping matches
    const sorted = this.deduplicateMatches(matches);

    return sorted;
  }

  private extractRegexTimestamps(text: string, matches: TimestampMatch[]): void {
    // US format dates: MM/DD/YYYY or MM/DD/YY
    let match: RegExpExecArray | null;
    const dateRegex = /(?:on\s+)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/gi;
    while ((match = dateRegex.exec(text)) !== null) {
      const parsedDate = this.parseUSDate(match[1], match[2], match[3]);
      matches.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        parsedDate,
        confidence: parsedDate ? 'high' : 'low',
        temporalType: 'absolute'
      });
    }

    // ISO format dates: YYYY-MM-DD
    const isoRegex = /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/g;
    while ((match = isoRegex.exec(text)) !== null) {
      const parsedDate = this.parseISODate(match[1], match[2], match[3]);
      matches.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        parsedDate,
        confidence: parsedDate ? 'high' : 'low',
        temporalType: 'absolute'
      });
    }

    // Written dates: "January 15, 2024" or "Jan 15, 2024"
    const writtenDateRegex = /(?:on\s+)?(?:the\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?)?(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[,\s]*(\d{2,4})?/gi;
    while ((match = writtenDateRegex.exec(text)) !== null) {
      const day = match[1]?.replace(/\D/g, '') || '1';
      const month = match[2];
      const year = match[3] || this.defaultYear.toString();
      const parsedDate = this.parseWrittenDate(day, month, year);
      matches.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        parsedDate,
        confidence: parsedDate && match[3] ? 'high' : 'medium',
        temporalType: 'absolute'
      });
    }

    // Days of week
    const dayRegex = /(?:on\s+)?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/gi;
    while ((match = dayRegex.exec(text)) !== null) {
      const dayName = match[1].toLowerCase();
      const parsedDate = this.parseDayOfWeek(dayName, text, match.index);
      matches.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        parsedDate,
        confidence: 'medium',
        temporalType: 'relative'
      });
    }

    // Relative days
    const relativeDayRegex = /(?:on\s+)?(today|yesterday|tomorrow|the day before yesterday|the day after tomorrow)/gi;
    while ((match = relativeDayRegex.exec(text)) !== null) {
      const parsedDate = this.parseRelativeDay(match[1].toLowerCase());
      matches.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        parsedDate,
        confidence: 'high',
        temporalType: 'relative',
        referenceDate: this.referenceDate
      });
    }

    // Relative weeks
    const relativeWeekRegex = /(?:during\s+)?(last week|this week|next week|a week ago|two weeks ago|three weeks ago|a few weeks ago)/gi;
    while ((match = relativeWeekRegex.exec(text)) !== null) {
      const parsedDate = this.parseRelativeWeek(match[1].toLowerCase());
      matches.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        parsedDate,
        confidence: parsedDate ? 'high' : 'low',
        temporalType: 'relative'
      });
    }

    // Time of day expressions
    const timeRegex = /(?:at|around|about|near)\s+(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?/gi;
    while ((match = timeRegex.exec(text)) !== null) {
      matches.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        parsedDate: null,
        confidence: 'medium',
        temporalType: 'relative'
      });
    }
  }

  private extractNLPTimestamps(text: string, matches: TimestampMatch[]): void {
    const doc = nlp(text);

    // Extract dates using compromise - use match patterns
    const datePatterns = [
      /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?/gi,
      /\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december)/gi
    ];

    for (const pattern of datePatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const parsedDate = this.parseNLPDuration(match[0]);
        matches.push({
          text: match[0],
          start: match.index,
          end: match.index + match[0].length,
          parsedDate,
          confidence: parsedDate ? 'high' : 'low',
          temporalType: 'absolute'
        });
      }
    }

    // Extract time expressions using compromise patterns
    const timeExpressions = doc.match('#Time').out('array');

    for (const timeStr of timeExpressions) {
      const index = text.toLowerCase().indexOf(timeStr.toLowerCase());
      if (index !== -1) {
        matches.push({
          text: timeStr,
          start: index,
          end: index + timeStr.length,
          parsedDate: null,
          confidence: 'medium',
          temporalType: 'relative'
        });
      }
    }
  }

  private parseUSDate(month: string, day: string, year: string): Date | null {
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    let y = parseInt(year, 10);

    if (y < 100) {
      y = y > 50 ? 1900 + y : 2000 + y;
    }

    const date = new Date(y, m - 1, d);
    return isValid(date) ? date : null;
  }

  private parseISODate(year: string, month: string, day: string): Date | null {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);

    const date = new Date(y, m - 1, d);
    return isValid(date) ? date : null;
  }

  private parseWrittenDate(day: string, month: string, year: string): Date | null {
    const m = MONTH_MAP[month.toLowerCase()];
    if (m === undefined) return null;

    const d = parseInt(day, 10) || 1;
    const y = parseInt(year, 10) || this.defaultYear;

    const date = new Date(y, m, d);
    return isValid(date) ? date : null;
  }

  private parseDayOfWeek(dayName: string, text: string, position: number): Date | null {
    const dayNum = DAY_MAP[dayName.toLowerCase()];
    if (dayNum === undefined) return null;

    const today = this.referenceDate.getDay();
    const diff = today - dayNum;
    const daysAgo = diff >= 0 ? diff : diff + 7;

    const date = subDays(this.referenceDate, daysAgo);
    return isValid(date) ? date : null;
  }

  private parseRelativeDay(relative: string): Date | null {
    const today = this.referenceDate;

    switch (relative) {
      case 'today':
        return new Date(today);
      case 'yesterday':
        return subDays(today, 1);
      case 'tomorrow':
        return addDays(today, 1);
      case 'the day before yesterday':
        return subDays(today, 2);
      case 'the day after tomorrow':
        return addDays(today, 2);
      default:
        return null;
    }
  }

  private parseRelativeWeek(relative: string): Date | null {
    const today = this.referenceDate;

    switch (relative) {
      case 'last week':
        return subDays(today, 7);
      case 'this week':
        return today;
      case 'next week':
        return addDays(today, 7);
      case 'a week ago':
      case 'one week ago':
        return subDays(today, 7);
      case 'two weeks ago':
        return subDays(today, 14);
      case 'three weeks ago':
        return subDays(today, 21);
      case 'a few weeks ago':
        return subDays(today, 14);
      default:
        return null;
    }
  }

  private parseNLPDuration(dateStr: string): Date | null {
    const str = dateStr.toLowerCase();

    // Try to parse various formats
    const monthYearMatch = str.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
    if (monthYearMatch) {
      const m = MONTH_MAP[monthYearMatch[1].toLowerCase()];
      if (m !== undefined) {
        const y = parseInt(monthYearMatch[2], 10);
        return new Date(y, m, 1);
      }
    }

    const monthDayMatch = str.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i);
    if (monthDayMatch) {
      const m = MONTH_MAP[monthDayMatch[1].toLowerCase()];
      if (m !== undefined) {
        const d = parseInt(monthDayMatch[2], 10);
        return new Date(this.defaultYear, m, d);
      }
    }

    return null;
  }

  private deduplicateMatches(matches: TimestampMatch[]): TimestampMatch[] {
    const seen = new Map<string, TimestampMatch>();

    for (const match of matches) {
      const key = `${match.start}-${match.end}`;
      const existing = seen.get(key);

      if (!existing || this.getConfidencePriority(match.confidence) > this.getConfidencePriority(existing.confidence)) {
        seen.set(key, match);
      }
    }

    return Array.from(seen.values()).sort((a, b) => a.start - b.start);
  }

  private getConfidencePriority(confidence: string): number {
    switch (confidence) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  // ============================================================================
  // EVENT EXTRACTION AND SORTING
  // ============================================================================

  extractEvents(text: string, matches?: Array<{ patternType: string; matchedText: string; category: 'negative' | 'positive' | 'neutral'; severity: number }>): TimelineEvent[] {
    const timestamps = this.extractTimestamps(text);
    const events: TimelineEvent[] = [];

    let sequenceIndex = 0;

    if (matches && matches.length > 0) {
      // Use provided matches with pattern detection
      for (const match of matches) {
        const relevantTimestamps = timestamps.filter(t =>
          t.start <= text.indexOf(match.matchedText) + match.matchedText.length &&
          t.end >= text.indexOf(match.matchedText)
        );

        const bestTimestamp = relevantTimestamps.sort((a, b) =>
          this.getConfidencePriority(b.confidence) - this.getConfidencePriority(a.confidence)
        )[0];

        const position = text.indexOf(match.matchedText);

        events.push({
          id: `event_${sequenceIndex}`,
          timestamp: bestTimestamp?.parsedDate || null,
          timestampString: bestTimestamp?.text || this.generateSequenceDate(sequenceIndex, timestamps),
          temporalReference: bestTimestamp?.text || 'sequence-based',
          sourceText: text.substring(
            Math.max(0, position - 50),
            Math.min(text.length, position + match.matchedText.length + 50)
          ),
          position,
          category: match.category,
          severity: match.severity,
          patternType: match.patternType,
          matchedText: match.matchedText,
          context: bestTimestamp?.text ? `Mentioned ${bestTimestamp.text}` : undefined,
          sequenceIndex: sequenceIndex++
        });
      }
    } else {
      // Use sentences as events
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        const position = text.indexOf(sentence);

        const relevantTimestamps = timestamps.filter(t =>
          t.start >= position && t.start <= position + sentence.length
        );

        const bestTimestamp = relevantTimestamps.sort((a, b) =>
          this.getConfidencePriority(b.confidence) - this.getConfidencePriority(a.confidence)
        )[0];

        events.push({
          id: `event_${i}`,
          timestamp: bestTimestamp?.parsedDate || null,
          timestampString: bestTimestamp?.text || this.generateSequenceDate(i, timestamps),
          temporalReference: bestTimestamp?.text || 'narrative order',
          sourceText: sentence,
          position,
          category: this.categorizeSentence(sentence),
          severity: this.calculateSentenceSeverity(sentence),
          patternType: this.detectPatternType(sentence),
          matchedText: sentence.substring(0, Math.min(100, sentence.length)),
          context: bestTimestamp?.text ? `Mentioned ${bestTimestamp.text}` : undefined,
          sequenceIndex: i
        });
      }
    }

    return events;
  }

  sortEvents(events: TimelineEvent[]): TimelineEvent[] {
    return [...events].sort((a, b) => {
      // First sort by timestamp if available
      if (a.timestamp && b.timestamp) {
        return a.timestamp.getTime() - b.timestamp.getTime();
      }

      // If one has a timestamp and other doesn't, prefer timestamp
      if (a.timestamp && !b.timestamp) return -1;
      if (!a.timestamp && b.timestamp) return 1;

      // Fall back to sequence index
      return a.sequenceIndex - b.sequenceIndex;
    });
  }

  private generateSequenceDate(sequenceIndex: number, timestamps: TimestampMatch[]): string {
    // Generate approximate dates based on narrative sequence
    if (timestamps.length > 0) {
      const firstTimestamp = timestamps[0];
      if (firstTimestamp?.parsedDate) {
        return `~${format(addDays(firstTimestamp.parsedDate, sequenceIndex), 'yyyy-MM-dd')}`;
      }
    }

    return `Event ${sequenceIndex + 1} (sequence-based)`;
  }

  private categorizeSentence(sentence: string): 'negative' | 'positive' | 'neutral' {
    const lower = sentence.toLowerCase();

    const negativeIndicators = ['hate', 'angry', 'hurt', 'pain', 'fear', 'scared', 'sorry', 'apologize', 'regret', 'wrong', 'mistake', 'abuse', 'violent', 'threat'];
    const positiveIndicators = ['love', 'happy', 'joy', 'wonderful', 'great', 'good', 'sorry', 'thank', 'appreciate', 'grateful', 'beautiful'];

    let negativeCount = 0;
    let positiveCount = 0;

    for (const word of negativeIndicators) {
      if (lower.includes(word)) negativeCount++;
    }

    for (const word of positiveIndicators) {
      if (lower.includes(word)) positiveCount++;
    }

    if (negativeCount > positiveCount) return 'negative';
    if (positiveCount > negativeCount) return 'positive';
    return 'neutral';
  }

  private calculateSentenceSeverity(sentence: string): number {
    const lower = sentence.toLowerCase();

    // High severity patterns
    const highSeverity = ['kill', 'die', 'threaten', 'abuse', 'hit', 'beat', 'threat', 'suicide', 'self-harm'];
    // Medium severity patterns
    const mediumSeverity = ['yell', 'scream', 'argu', 'fight', 'conflict', 'break', 'destroy'];

    for (const word of highSeverity) {
      if (lower.includes(word)) return 80 + Math.floor(Math.random() * 20);
    }

    for (const word of mediumSeverity) {
      if (lower.includes(word)) return 50 + Math.floor(Math.random() * 30);
    }

    return 25 + Math.floor(Math.random() * 25);
  }

  private detectPatternType(sentence: string): string | undefined {
    const lower = sentence.toLowerCase();

    if (/\byou\'re (?:crazy|imagining|paranoid|too sensitive)\b/.test(lower)) return 'gaslighting';
    if (/\byou (?:always|never)\b/.test(lower)) return 'blame_shifting';
    if (/\b(I\'m|I am) sorry\b/.test(lower)) return 'apology';
    if (/\bI love|love you\b/.test(lower)) return 'love_bombing';
    if (/\bthreat|warn|regret\b/.test(lower)) return 'threats_intimidation';
    if (/\bpick up|drop off|visitation|custody\b/.test(lower)) return 'scheduling';

    return undefined;
  }

  // ============================================================================
  // CYCLE OF ABUSE DETECTION
  // ============================================================================

  detectCycleOfAbuse(events: TimelineEvent[]): CycleOfAbuseInstance[] {
    const instances: CycleOfAbuseInstance[] = [];
    const sortedEvents = this.sortEvents(events);

    if (sortedEvents.length < 2) return instances;

    const phases = this.classifyEventsIntoPhases(sortedEvents);
    const cycles = this.identifyCycles(phases, sortedEvents);

    return cycles;
  }

  private classifyEventsIntoPhases(events: TimelineEvent[]): Map<number, string> {
    const phaseMap = new Map<number, string>();

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const text = event.sourceText.toLowerCase();

      let maxScore = 0;
      let bestPhase = 'unknown';

      // Score each phase
      const scores = {
        tension: 0,
        incident: 0,
        reconciliation: 0,
        calm: 0
      };

      // Check tension indicators
      for (const indicator of CYCLE_PHASE_INDICATORS.tension) {
        if (indicator.pattern.test(text)) {
          scores.tension += indicator.weight;
        }
      }

      // Check incident indicators
      for (const indicator of CYCLE_PHASE_INDICATORS.incident) {
        if (indicator.pattern.test(text)) {
          scores.incident += indicator.weight;
        }
      }

      // Check reconciliation indicators
      for (const indicator of CYCLE_PHASE_INDICATORS.reconciliation) {
        if (indicator.pattern.test(text)) {
          scores.reconciliation += indicator.weight;
        }
      }

      // Check calm indicators
      for (const indicator of CYCLE_PHASE_INDICATORS.calm) {
        if (indicator.pattern.test(text)) {
          scores.calm += indicator.weight;
        }
      }

      // Find best matching phase
      for (const [phase, score] of Object.entries(scores)) {
        if (score > maxScore) {
          maxScore = score;
          bestPhase = phase;
        }
      }

      // If no strong indicators, classify by severity
      if (maxScore === 0) {
        if (event.severity >= 80) {
          bestPhase = 'incident';
        } else if (event.severity >= 50) {
          bestPhase = 'tension';
        } else if (event.category === 'positive' && event.severity < 50) {
          bestPhase = 'reconciliation';
        } else {
          bestPhase = 'calm';
        }
      }

      phaseMap.set(i, bestPhase);
    }

    return phaseMap;
  }

  private identifyCycles(phaseMap: Map<number, string>, events: TimelineEvent[]): CycleOfAbuseInstance[] {
    const instances: CycleOfAbuseInstance[] = [];
    const cycleIndicators = ['tension', 'incident', 'reconciliation', 'calm'];

    let currentCycle: CycleOfAbuseInstance | null = null;
    let cycleStartIndex = 0;

    for (let i = 0; i < events.length; i++) {
      const phase = phaseMap.get(i) || 'unknown';

      // Start a new cycle when we detect tension after a calm period
      if (phase === 'tension' && (!currentCycle || currentCycle.phases.some(p => p.phase === 'calm'))) {
        if (currentCycle && !currentCycle.complete) {
          // Close incomplete cycle
          currentCycle.complete = false;
          instances.push(currentCycle);
        }

        currentCycle = {
          id: `cycle_${instances.length + 1}`,
          startDate: events[i].timestamp,
          endDate: null,
          phases: [],
          complete: false,
          phaseSequence: []
        };
        cycleStartIndex = i;
      }

      if (currentCycle) {
        const existingPhase = currentCycle.phases.find(p => p.phase === phase);

        if (existingPhase) {
          existingPhase.events.push(events[i]);
          existingPhase.endDate = events[i].timestamp || null;
        } else {
          currentCycle.phases.push({
            phase: phase as 'tension' | 'incident' | 'reconciliation' | 'calm',
            startDate: events[i].timestamp,
            endDate: events[i].timestamp,
            events: [events[i]],
            indicators: this.getPhaseIndicators(events[i]),
            confidence: this.calculatePhaseConfidence(phase, events[i])
          });
          currentCycle.phaseSequence.push(phase);
        }

        // Check if cycle is complete
        if (phase === 'calm') {
          currentCycle.complete = true;
          currentCycle.endDate = events[i].timestamp;
          instances.push(currentCycle);
          currentCycle = null;
        }
      }
    }

    // Don't forget the last cycle
    if (currentCycle && currentCycle.phases.length > 0) {
      instances.push(currentCycle);
    }

    return instances;
  }

  private getPhaseIndicators(event: TimelineEvent): string[] {
    const indicators: string[] = [];
    const text = event.sourceText.toLowerCase();

    if (text.includes('sorry') || text.includes('apologize')) indicators.push('Apology expressed');
    if (text.includes('promise') || text.includes('never again')) indicators.push('Promise made');
    if (text.includes('love') || text.includes('miss')) indicators.push('Affection expressed');
    if (text.includes('where') || text.includes('who') || text.includes('why')) indicators.push('Questioning behavior');
    if (text.includes('always') || text.includes('never')) indicators.push('Absolute language');
    if (text.includes('wrong') || text.includes('mistake')) indicators.push('Admission of fault');

    return indicators;
  }

  private calculatePhaseConfidence(phase: string, event: TimelineEvent): number {
    const text = event.sourceText.toLowerCase();
    const indicators = CYCLE_PHASE_INDICATORS[phase as keyof typeof CYCLE_PHASE_INDICATORS] || [];

    let matchCount = 0;
    for (const indicator of indicators) {
      if (indicator.pattern.test(text)) {
        matchCount++;
      }
    }

    if (indicators.length === 0) return 0.3;

    const confidence = Math.min(0.95, 0.4 + (matchCount / indicators.length) * 0.55);
    return Math.round(confidence * 100) / 100;
  }

  // ============================================================================
  // ESCALATION TRACKING
  // ============================================================================

  trackEscalation(events: TimelineEvent[], periodType: 'week' | 'month' = 'week'): EscalationData[] {
    const sortedEvents = this.sortEvents(events);
    const data: EscalationData[] = [];

    if (sortedEvents.length === 0) return data;

    const eventsWithDates = sortedEvents.filter(e => e.timestamp !== null);

    if (eventsWithDates.length < 2) {
      // Return single period with available data
      const firstEvent = eventsWithDates[0] || sortedEvents[0];
      const startDate = startOfWeek(firstEvent.timestamp || new Date());
      const endDate = endOfWeek(startDate);

      data.push({
        period: format(startDate, 'yyyy-MM-dd'),
        periodType,
        startDate,
        endDate,
        avgSeverity: this.calculateAverageSeverity(sortedEvents),
        eventCount: sortedEvents.length,
        negativeEvents: sortedEvents.filter(e => e.category === 'negative').length,
        positiveEvents: sortedEvents.filter(e => e.category === 'positive').length,
        trend: 'insufficient_data',
        trendStrength: 0
      });

      return data;
    }

    // Group events by period
    const startDate = startOfWeek(eventsWithDates[0].timestamp!);
    const endDate = endOfWeek(eventsWithDates[eventsWithDates.length - 1].timestamp!);

    let currentPeriodStart = startOfWeek(startDate);
    const periods: Date[][] = [];

    while (currentPeriodStart <= endDate) {
      const periodEnd = periodType === 'week' ? endOfWeek(currentPeriodStart) : endOfMonth(currentPeriodStart);
      const periodEvents = eventsWithDates.filter(e => {
        if (!e.timestamp) return false;
        const eventDate = startOfWeek(e.timestamp);
        return eventDate >= currentPeriodStart && eventDate <= periodEnd;
      });

      if (periodEvents.length > 0 || periods.length === 0) {
        periods.push(periodEvents.map(e => e.timestamp!));
      }

      currentPeriodStart = periodType === 'week'
        ? addDays(currentPeriodStart, 7)
        : addDays(startOfMonth(addDays(currentPeriodStart, 1)), 0);
    }

    // Calculate data for each period
    for (let i = 0; i < periods.length; i++) {
      const periodStart = startOfWeek(new Date(periods[i][0].getTime()));
      const periodEnd = periodType === 'week' ? endOfWeek(periodStart) : endOfMonth(periodStart);

      const periodEvents = eventsWithDates.filter(e => {
        if (!e.timestamp) return false;
        const eventDate = startOfWeek(e.timestamp);
        return eventDate.getTime() === periodStart.getTime();
      });

      const avgSeverity = this.calculateAverageSeverity(periodEvents);
      const negativeCount = periodEvents.filter(e => e.category === 'negative').length;
      const positiveCount = periodEvents.filter(e => e.category === 'positive').length;

      // Calculate trend
      let trend: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data' = 'stable';
      let trendStrength = 0;

      if (i > 0 && data[i - 1].avgSeverity > 0) {
        const prevSeverity = data[i - 1].avgSeverity;
        const change = avgSeverity - prevSeverity;

        if (change > 10) {
          trend = 'increasing';
          trendStrength = Math.min(1, change / 50);
        } else if (change < -10) {
          trend = 'decreasing';
          trendStrength = Math.min(1, Math.abs(change) / 50);
        } else {
          trendStrength = 0.3;
        }
      }

      data.push({
        period: format(periodStart, 'yyyy-MM-dd'),
        periodType,
        startDate: periodStart,
        endDate: periodEnd,
        avgSeverity,
        eventCount: periodEvents.length,
        negativeEvents: negativeCount,
        positiveEvents: positiveCount,
        trend,
        trendStrength: Math.round(trendStrength * 100) / 100
      });
    }

    return data;
  }

  private calculateAverageSeverity(events: TimelineEvent[]): number {
    if (events.length === 0) return 0;
    const sum = events.reduce((acc, e) => acc + e.severity, 0);
    return Math.round(sum / events.length);
  }

  // ============================================================================
  // TIMELINE REPORT GENERATION
  // ============================================================================

  generateReport(
    text: string,
    matches?: Array<{ patternType: string; matchedText: string; category: 'negative' | 'positive' | 'neutral'; severity: number }>
  ): TimelineReport {
    // Extract events
    const events = this.extractEvents(text, matches);

    // Sort events chronologically
    const sortedEvents = this.sortEvents(events);

    // Group events by date
    const eventsByDate = new Map<string, TimelineEvent[]>();
    for (const event of sortedEvents) {
      if (event.timestamp) {
        const dateKey = format(event.timestamp, 'yyyy-MM-dd');
        const existing = eventsByDate.get(dateKey) || [];
        existing.push(event);
        eventsByDate.set(dateKey, existing);
      }
    }

    // Detect cycle of abuse
    const cycleDetections = this.detectCycleOfAbuse(events);

    // Track escalation
    const escalationData = this.trackEscalation(events, 'week');
    const escalationDataMonthly = this.trackEscalation(events, 'month');
    const combinedEscalation = [...escalationData, ...escalationDataMonthly.filter(m =>
      !escalationData.some(w => format(w.startDate, 'yyyy-MM') === format(m.startDate, 'yyyy-MM'))
    )];

    // Count pattern occurrences
    const patternOccurrences: Record<string, number> = {};
    for (const event of events) {
      if (event.patternType) {
        patternOccurrences[event.patternType] = (patternOccurrences[event.patternType] || 0) + 1;
      }
    }

    // Calculate overall severity trend
    const negativeEvents = sortedEvents.filter(e => e.category === 'negative');
    const recentNegatives = negativeEvents.slice(-5);
    const earlierNegatives = negativeEvents.slice(0, Math.min(5, negativeEvents.length - 5));

    const recentAvg = this.calculateAverageSeverity(recentNegatives);
    const earlierAvg = this.calculateAverageSeverity(earlierNegatives);

    let overallTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let trendStrength = 0;

    if (earlierNegatives.length >= 2 && recentNegatives.length >= 2) {
      const change = recentAvg - earlierAvg;
      if (change > 5) {
        overallTrend = 'increasing';
        trendStrength = Math.min(1, change / 30);
      } else if (change < -5) {
        overallTrend = 'decreasing';
        trendStrength = Math.min(1, Math.abs(change) / 30);
      } else {
        trendStrength = 0.5;
      }
    }

    // Phase analysis
    const phaseAnalysis = this.analyzePhases(sortedEvents);

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(
      sortedEvents,
      eventsByDate,
      cycleDetections,
      combinedEscalation,
      patternOccurrences,
      { overall: this.calculateAverageSeverity(negativeEvents), trend: overallTrend, trendStrength },
      phaseAnalysis
    );

    return {
      events,
      sortedEvents,
      eventsByDate,
      cycleDetections,
      escalationData: combinedEscalation,
      patternOccurrences,
      severityTrend: {
        overall: this.calculateAverageSeverity(negativeEvents),
        trend: overallTrend,
        trendStrength: Math.round(trendStrength * 100) / 100
      },
      phaseAnalysis,
      markdownReport
    };
  }

  private analyzePhases(events: TimelineEvent[]) {
    const phases: string[] = [];
    const durationByPhase: Record<string, number> = {};
    const eventCountsByPhase: Record<string, number> = {};

    const sortedEvents = this.sortEvents(events);
    const phaseMap = this.classifyEventsIntoPhases(sortedEvents);

    Array.from(phaseMap.entries()).forEach(([index, phase]) => {
      if (!phases.includes(phase)) {
        phases.push(phase);
      }

      eventCountsByPhase[phase] = (eventCountsByPhase[phase] || 0) + 1;
    });

    return {
      phases,
      durationByPhase,
      eventCountsByPhase
    };
  }

  private generateMarkdownReport(
    events: TimelineEvent[],
    eventsByDate: Map<string, TimelineEvent[]>,
    cycles: CycleOfAbuseInstance[],
    escalation: EscalationData[],
    patterns: Record<string, number>,
    severityTrend: { overall: number; trend: 'increasing' | 'decreasing' | 'stable'; trendStrength: number },
    phaseAnalysis: { phases: string[]; durationByPhase: Record<string, number>; eventCountsByPhase: Record<string, number> }
  ): string {
    let md = '# Timeline Analysis Report\n\n';

    // Summary
    md += '## Summary\n\n';
    md += `- **Total Events Analyzed:** ${events.length}\n`;
    md += `- **Events with Dates:** ${events.filter(e => e.timestamp).length}\n`;
    md += `- **Negative Events:** ${events.filter(e => e.category === 'negative').length}\n`;
    md += `- **Positive Events:** ${events.filter(e => e.category === 'positive').length}\n`;
    md += `- **Cycles Detected:** ${cycles.length}\n`;
    md += `- **Overall Severity:** ${severityTrend.overall}/100 (${severityTrend.trend})\n\n`;

    // Severity Trend
    md += '## Severity Trend\n\n';
    if (escalation.length > 0) {
      md += '| Period | Avg Severity | Events | Trend |\n';
      md += '|--------|-------------|--------|-------|\n';
      for (const period of escalation.slice(0, 10)) {
        md += `| ${period.period} | ${period.avgSeverity} | ${period.eventCount} | ${period.trend} (${(period.trendStrength * 100).toFixed(0)}%) |\n`;
      }
      md += '\n';
    } else {
      md += '*Insufficient data for trend analysis.*\n\n';
    }

    // Cycle of Abuse Detection
    md += '## Cycle of Abuse Detection\n\n';
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        md += `### Cycle ${cycle.id}\n\n`;
        md += `- **Status:** ${cycle.complete ? 'Complete' : 'Incomplete'}\n`;
        if (cycle.startDate) {
          md += `- **Start:** ${format(cycle.startDate, 'MMMM d, yyyy')}\n`;
        }
        if (cycle.endDate) {
          md += `- **End:** ${format(cycle.endDate, 'MMMM d, yyyy')}\n`;
        }
        md += `- **Phases Detected:** ${cycle.phaseSequence.join(' → ')}\n\n`;

        for (const phase of cycle.phases) {
          md += `#### ${this.capitalizeFirst(phase.phase)} Phase\n\n`;
          md += `- **Events:** ${phase.events.length}\n`;
          md += `- **Confidence:** ${(phase.confidence * 100).toFixed(0)}%\n`;
          if (phase.indicators.length > 0) {
            md += `- **Indicators:** ${phase.indicators.join(', ')}\n`;
          }
          md += '\n';
        }
      }
    } else {
      md += '*No complete cycles of abuse patterns detected.*\n\n';
    }

    // Phase Analysis
    md += '## Phase Analysis\n\n';
    md += `**Phases Detected:** ${phaseAnalysis.phases.map(p => this.capitalizeFirst(p)).join(', ')}\n\n`;
    md += '**Events by Phase:**\n\n';
    for (const [phase, count] of Object.entries(phaseAnalysis.eventCountsByPhase)) {
      md += `- ${this.capitalizeFirst(phase)}: ${count} events\n`;
    }
    md += '\n';

    // Pattern Occurrences
    if (Object.keys(patterns).length > 0) {
      md += '## Pattern Occurrences\n\n';
      md += '| Pattern | Count |\n';
      md += '|---------|-------|\n';
      for (const [pattern, count] of Object.entries(patterns).sort((a, b) => b[1] - a[1])) {
        md += `| ${this.formatPatternName(pattern)} | ${count} |\n`;
      }
      md += '\n';
    }

    // Chronological Event List
    md += '## Chronological Event List\n\n';

    const eventsWithDates = events.filter(e => e.timestamp);
    const eventsWithoutDates = events.filter(e => !e.timestamp);

    if (eventsWithDates.length > 0) {
      md += '### Dated Events\n\n';
      Array.from(eventsByDate.entries()).forEach(([dateStr, dateEvents]) => {
        md += `#### ${format(new Date(dateStr), 'EEEE, MMMM d, yyyy')}\n\n`;
        for (const event of dateEvents) {
          const severityIcon = event.severity >= 80 ? '🔴' : event.severity >= 50 ? '🟡' : '🟢';
          const categoryIcon = event.category === 'negative' ? '⚠️' : event.category === 'positive' ? '❤️' : '⚪';
          md += `- ${severityIcon} ${categoryIcon} [${event.severity}] ${event.matchedText?.substring(0, 100)}${event.matchedText && event.matchedText.length > 100 ? '...' : ''}\n`;
        }
        md += '\n';
      });
    }

    if (eventsWithoutDates.length > 0) {
      md += '### Undated Events (Sequence-Based)\n\n';
      for (const event of eventsWithoutDates) {
        const severityIcon = event.severity >= 80 ? '🔴' : event.severity >= 50 ? '🟡' : '🟢';
        const categoryIcon = event.category === 'negative' ? '⚠️' : event.category === 'positive' ? '❤️' : '⚪';
        md += `- ${severityIcon} ${categoryIcon} [${event.severity}] ${event.matchedText?.substring(0, 100)}${event.matchedText && event.matchedText.length > 100 ? '...' : ''}\n`;
      }
      md += '\n';
    }

    // Escalation Summary
    md += '## Escalation Analysis\n\n';
    if (escalation.length >= 2) {
      const firstPeriod = escalation[0];
      const lastPeriod = escalation[escalation.length - 1];

      if (lastPeriod.avgSeverity > firstPeriod.avgSeverity) {
        md += '⚠️ **ESCALATION DETECTED:** Severity has increased over time.\n\n';
      } else if (lastPeriod.avgSeverity < firstPeriod.avgSeverity) {
        md += '✅ **IMPROVEMENT DETECTED:** Severity has decreased over time.\n\n';
      } else {
        md += '➡️ **STABLE:** Severity remains relatively consistent.\n\n';
      }

      md += `**Average Severity:** ${lastPeriod.avgSeverity}/100\n`;
      md += `**Trend:** ${severityTrend.trend} (${(severityTrend.trendStrength * 100).toFixed(0)}% confidence)\n`;
    } else {
      md += '*Insufficient data for escalation analysis.*\n';
    }

    md += '\n---\n';
    md += '*Report generated by Timeline Analysis Tool*\n';
    md += `*Date: ${format(new Date(), 'MMMM d, yyyy HH:mm')}*\n`;

    return md;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private formatPatternName(pattern: string): string {
    return pattern.split('_').map(word => this.capitalizeFirst(word)).join(' ');
  }
}

// Export singleton instance
export const timelineGenerator = new TimelineGenerator();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function generateTimeline(text: string, matches?: Array<{ patternType: string; matchedText: string; category: 'negative' | 'positive' | 'neutral'; severity: number }>): TimelineReport {
  return timelineGenerator.generateReport(text, matches);
}

export function extractTimestamps(text: string): TimestampMatch[] {
  return timelineGenerator.extractTimestamps(text);
}

export function detectCycles(events: TimelineEvent[]): CycleOfAbuseInstance[] {
  return timelineGenerator.detectCycleOfAbuse(events);
}

export function trackEscalation(events: TimelineEvent[], periodType: 'week' | 'month' = 'week'): EscalationData[] {
  return timelineGenerator.trackEscalation(events, periodType);
}
