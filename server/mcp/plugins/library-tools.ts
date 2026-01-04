/**
 * Library Tools Plugin
 *
 * Provides lightweight wrappers around common JS libraries so they can be
 * invoked as MCP tools through the executor.
 */

import { parse as parseCsv } from 'csv-parse/sync';
import { XMLParser } from 'fast-xml-parser';
import { francAll } from 'franc';
import JSON5 from 'json5';
import natural from 'natural';
import nlp from 'compromise';
import * as stringSimilarity from 'string-similarity';
import yaml from 'yaml';
import { load } from 'cheerio';

export async function runCheerio(args: {
  html: string;
  selector?: string;
  operation?: 'text' | 'html' | 'attr' | 'find' | 'each';
  attribute?: string;
}): Promise<{ result: unknown }> {
  const $ = load(args.html);
  const selection = args.selector ? $(args.selector) : $.root();
  const operation = args.operation ?? 'text';

  switch (operation) {
    case 'html':
      return { result: selection.html() };
    case 'attr':
      return { result: args.attribute ? selection.attr(args.attribute) : null };
    case 'find':
      return { result: args.selector ? selection.find(args.selector).toArray().map((el) => $(el).text()) : [] };
    case 'each':
      return { result: selection.toArray().map((el) => $(el).text()) };
    case 'text':
    default:
      return { result: selection.text() };
  }
}

export async function parseXml(args: {
  xml: string;
  options?: Record<string, unknown>;
}): Promise<{ data: unknown }> {
  const parser = new XMLParser({ ignoreAttributes: false, ...args.options });
  return { data: parser.parse(args.xml) };
}

export async function parseJson5(args: { text: string }): Promise<{ data: unknown }> {
  return { data: JSON5.parse(args.text) };
}

export async function handleYaml(args: {
  input: string;
  operation?: 'parse' | 'stringify';
}): Promise<{ result: unknown }> {
  const operation = args.operation ?? 'parse';
  if (operation === 'stringify') {
    return { result: yaml.stringify(JSON.parse(args.input)) };
  }
  return { result: yaml.parse(args.input) };
}

export async function handleCsv(args: {
  input: string;
  operation?: 'parse' | 'stringify';
  options?: Record<string, unknown>;
}): Promise<{ data: unknown }> {
  const operation = args.operation ?? 'parse';
  if (operation === 'stringify') {
    const data = JSON.parse(args.input) as unknown;
    return { data: stringifyCsv(data, args.options) };
  }
  return { data: parseCsv(args.input, { columns: true, skip_empty_lines: true, ...args.options }) };
}

function stringifyCsv(
  input: unknown,
  options?: Record<string, unknown>
): string {
  const delimiter = typeof options?.delimiter === 'string' ? options.delimiter : ',';
  const rows = normalizeCsvRows(input, options);
  return rows.map((row) => row.map((value) => escapeCsvValue(value, delimiter)).join(delimiter)).join('\n');
}

function normalizeCsvRows(
  input: unknown,
  options?: Record<string, unknown>
): string[][] {
  const includeHeader = options?.header !== false;
  if (Array.isArray(input)) {
    if (input.length === 0) {
      return [];
    }
    if (typeof input[0] === 'object' && input[0] !== null && !Array.isArray(input[0])) {
      const columns = (options?.columns as string[] | undefined) ?? Array.from(
        new Set(input.flatMap((item) => Object.keys(item as Record<string, unknown>)))
      );
      const rows = (input as Array<Record<string, unknown>>).map((item) =>
        columns.map((key) => serializeCsvValue(item[key]))
      );
      return includeHeader ? [columns, ...rows] : rows;
    }
    return (input as Array<unknown[]>).map((row) => row.map(serializeCsvValue));
  }
  if (typeof input === 'object' && input !== null) {
    const entries = Object.entries(input as Record<string, unknown>);
    const rows = entries.map(([key, value]) => [key, serializeCsvValue(value)]);
    return includeHeader ? [['key', 'value'], ...rows] : rows;
  }
  return [[serializeCsvValue(input)]];
}

function serializeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function escapeCsvValue(value: string, delimiter: string): string {
  const shouldQuote = value.includes('"') || value.includes('\n') || value.includes('\r') || value.includes(delimiter);
  const escaped = value.replace(/"/g, '""');
  return shouldQuote ? `"${escaped}"` : escaped;
}

export async function runNatural(args: {
  text: string;
  operation: 'tokenize' | 'stem' | 'phonetics' | 'sentiment' | 'classify';
  options?: Record<string, unknown>;
}): Promise<{ result: unknown }> {
  switch (args.operation) {
    case 'tokenize': {
      const tokenizer = new natural.WordTokenizer();
      return { result: tokenizer.tokenize(args.text) };
    }
    case 'stem': {
      return { result: natural.PorterStemmer.stem(args.text) };
    }
    case 'phonetics': {
      return { result: natural.SoundEx.process(args.text) };
    }
    case 'sentiment': {
      const analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
      const tokenizer = new natural.WordTokenizer();
      return { result: analyzer.getSentiment(tokenizer.tokenize(args.text)) };
    }
    case 'classify': {
      const classifier = new natural.BayesClassifier();
      const training = (args.options?.training as Array<{ text: string; label: string }>) ?? [];
      for (const item of training) {
        classifier.addDocument(item.text, item.label);
      }
      if (training.length > 0) {
        classifier.train();
      }
      return { result: classifier.classify(args.text) };
    }
    default:
      return { result: null };
  }
}

export async function runCompromise(args: {
  text: string;
  operation: 'nouns' | 'verbs' | 'people' | 'places' | 'dates' | 'topics';
}): Promise<{ result: unknown }> {
  const doc = nlp(args.text);
  switch (args.operation) {
    case 'nouns':
      return { result: doc.nouns().out('array') };
    case 'verbs':
      return { result: doc.verbs().out('array') };
    case 'people':
      return { result: doc.people().out('array') };
    case 'places':
      return { result: doc.places().out('array') };
    case 'dates':
      return { result: doc.dates().out('array') };
    case 'topics':
      return { result: doc.topics().out('array') };
    default:
      return { result: [] };
  }
}

export async function detectFranc(args: {
  text: string;
  minLength?: number;
}): Promise<{ language: string; confidence: number }> {
  const ranked = francAll(args.text, { minLength: args.minLength ?? 10 });
  const [lang, score] = ranked[0] || ['und', 0];
  const normalized = ranked.length > 0 ? 1 - score / (ranked[ranked.length - 1]?.[1] ?? score) : 0;
  return { language: lang, confidence: Number.isFinite(normalized) ? normalized : 0 };
}

export async function compareStrings(args: {
  string1: string;
  string2: string;
  algorithm?: 'dice' | 'levenshtein' | 'jaro-winkler';
}): Promise<{ similarity: number }> {
  const algorithm = args.algorithm ?? 'dice';
  if (algorithm === 'jaro-winkler') {
    return { similarity: natural.JaroWinklerDistance(args.string1, args.string2) };
  }
  if (algorithm === 'levenshtein') {
    const distance = natural.LevenshteinDistance(args.string1, args.string2);
    const max = Math.max(args.string1.length, args.string2.length) || 1;
    return { similarity: 1 - distance / max };
  }
  return { similarity: stringSimilarity.compareTwoStrings(args.string1, args.string2) };
}
