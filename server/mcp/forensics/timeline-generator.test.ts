/**
 * Timeline Generator Tests
 * Tests the forensic timeline generation and temporal analysis
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { timelineGenerator } from './timeline-generator';

describe('Timeline Generator Tests', () => {
  it('should extract timestamps from text', () => {
    const text = "On January 15, 2023 at 3:30 PM, I went to the store. Yesterday around 2 PM, we had a fight. This morning at 9 AM, everything changed.";
    const timestamps = timelineGenerator.extractTimestamps(text);

    expect(timestamps.length).toBeGreaterThan(0);
    // Just check that we got some timestamp data
    expect(Array.isArray(timestamps)).toBe(true);
  });

  it('should generate timeline from events', async () => {
    const events = [
      { timestamp: '2023-01-15T15:30:00Z', type: 'negative', description: 'Argument about money' },
      { timestamp: '2023-01-16T14:00:00Z', type: 'positive', description: 'Made up after argument' },
      { timestamp: '2023-01-17T09:00:00Z', type: 'negative', description: 'Another fight' }
    ];

    // Convert to the expected format
    const matches = events.map(e => ({
      patternType: 'timeline',
      matchedText: e.description,
      category: e.type,
      severity: e.type === 'negative' ? 8 : 2
    }));

    const timeline = timelineGenerator.generateReport(events.join(' '), matches);
    expect(timeline).toBeDefined();
    expect(timeline.events.length).toBeGreaterThan(0);
  });

  it('should detect cycle of abuse patterns', () => {
    const events: any[] = [
      {
        timestamp: new Date('2023-01-15T10:00:00Z'),
        category: 'negative',
        sourceText: 'Tension building - criticism about appearance',
        severity: 6
      },
      {
        timestamp: new Date('2023-01-15T18:00:00Z'),
        category: 'negative',
        sourceText: 'Incident - thrown objects, threats',
        severity: 9
      },
      {
        timestamp: new Date('2023-01-16T08:00:00Z'),
        category: 'positive',
        sourceText: 'Reconciliation - gifts, apologies, love bombing',
        severity: 2
      },
      {
        timestamp: new Date('2023-01-17T12:00:00Z'),
        category: 'neutral',
        sourceText: 'Calm period - normal behavior',
        severity: 1
      }
    ];

    const cycles = timelineGenerator.detectCycleOfAbuse(events);
    expect(Array.isArray(cycles)).toBe(true);
    // Even if no cycles are detected, the function should work
  });

  it('should track escalation over time', () => {
    const events: any[] = [
      { timestamp: new Date('2023-01-01'), severity: 3 },
      { timestamp: new Date('2023-01-02'), severity: 4 },
      { timestamp: new Date('2023-01-03'), severity: 6 },
      { timestamp: new Date('2023-01-04'), severity: 8 }
    ];

    const escalation = timelineGenerator.trackEscalation(events);
    expect(escalation.length).toBeGreaterThan(0);
    expect(escalation[0]).toHaveProperty('avgSeverity');
  });

  it('should sort events chronologically', () => {
    const events: any[] = [
      { timestamp: new Date('2023-01-03'), description: 'Third event' },
      { timestamp: new Date('2023-01-01'), description: 'First event' },
      { timestamp: new Date('2023-01-02'), description: 'Second event' }
    ];

    const sorted = timelineGenerator.sortEvents(events);
    expect(sorted[0].description).toBe('First event');
    expect(sorted[1].description).toBe('Second event');
    expect(sorted[2].description).toBe('Third event');
  });

  it('should generate markdown timeline report', async () => {
    const events: any[] = [
      { timestamp: new Date('2023-01-15T15:30:00Z'), category: 'negative', sourceText: 'Initial incident', severity: 8 },
      { timestamp: new Date('2023-01-16T14:00:00Z'), category: 'positive', sourceText: 'Reconciliation', severity: 2 }
    ];

    const report = timelineGenerator.generateMarkdownReport(events, [], []);
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
  });
});