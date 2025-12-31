/**
 * Document Plugin
 * 
 * Provides document processing capabilities:
 * - Pandoc for format conversion to markdown
 * - Tesseract for OCR on images and PDFs
 * - Text normalization and segmentation
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { getContentStore } from '../store/content-store';
import type { DocumentChunk, DocumentSection, ContentRef } from '../../../shared/mcp-types';

interface ConvertArgs {
  path: string;
  format?: string;
  extractMetadata?: boolean;
}

interface OcrArgs {
  path: string;
  language?: string;
  psm?: number;
  dpi?: number;
}

interface SegmentArgs {
  textRef: string;
  strategy?: 'heading' | 'paragraph' | 'sentence' | 'fixed';
  chunkSize?: number;
  overlap?: number;
}

/**
 * Convert document to markdown using Pandoc
 */
export async function convertToMarkdown(args: ConvertArgs): Promise<{
  markdownRef: ContentRef;
  metadata?: Record<string, unknown>;
  preview: string;
}> {
  const store = await getContentStore();
  
  // Detect input format if not specified
  const ext = path.extname(args.path).toLowerCase();
  const formatMap: Record<string, string> = {
    '.docx': 'docx',
    '.doc': 'doc',
    '.pdf': 'pdf',
    '.html': 'html',
    '.htm': 'html',
    '.epub': 'epub',
    '.odt': 'odt',
    '.rtf': 'rtf',
    '.tex': 'latex',
    '.rst': 'rst',
    '.org': 'org',
  };

  const inputFormat = args.format ?? formatMap[ext] ?? 'markdown';

  // Build Pandoc command
  const pandocArgs: string[] = [
    '-f', inputFormat,
    '-t', 'markdown',
    '--wrap=none',
  ];

  if (args.extractMetadata) {
    pandocArgs.push('--standalone');
  }

  pandocArgs.push(args.path);

  try {
    const markdown = await runCommand('pandoc', pandocArgs);
    
    // Extract metadata if present
    let metadata: Record<string, unknown> | undefined;
    let content = markdown;

    if (args.extractMetadata && markdown.startsWith('---')) {
      const endIdx = markdown.indexOf('---', 3);
      if (endIdx !== -1) {
        const yamlBlock = markdown.slice(4, endIdx).trim();
        metadata = parseYamlMetadata(yamlBlock);
        content = markdown.slice(endIdx + 3).trim();
      }
    }

    // Store the markdown
    const stored = await store.put(content, 'text/markdown');

    return {
      markdownRef: stored.ref,
      metadata,
      preview: content.slice(0, 500) + (content.length > 500 ? '...' : ''),
    };
  } catch (error) {
    throw new Error(`Pandoc conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * OCR image or PDF using Tesseract
 */
export async function ocrImageOrPdf(args: OcrArgs): Promise<{
  textRef: ContentRef;
  pages: number;
  confidence: number;
  preview: string;
}> {
  const store = await getContentStore();
  const language = args.language ?? 'eng';
  const psm = args.psm ?? 3; // Fully automatic page segmentation

  const ext = path.extname(args.path).toLowerCase();
  const isPdf = ext === '.pdf';

  let allText = '';
  let pages = 1;
  let totalConfidence = 0;

  if (isPdf) {
    // For PDFs, use pdftoppm to convert to images first, then OCR each page
    // This is a simplified version - in production, use proper PDF handling
    try {
      // Try using pdftotext first (faster for text-based PDFs)
      const pdfText = await runCommand('pdftotext', ['-layout', args.path, '-']);
      if (pdfText.trim().length > 100) {
        // PDF has extractable text
        const stored = await store.put(pdfText, 'text/plain');
        return {
          textRef: stored.ref,
          pages: 1,
          confidence: 1.0,
          preview: pdfText.slice(0, 500) + (pdfText.length > 500 ? '...' : ''),
        };
      }
    } catch {
      // Fall through to OCR
    }

    // OCR the PDF
    const tesseractArgs = [
      args.path,
      'stdout',
      '-l', language,
      '--psm', String(psm),
      'pdf',
    ];

    allText = await runCommand('tesseract', tesseractArgs);
    totalConfidence = 0.8; // Estimate for PDF OCR
  } else {
    // Direct image OCR
    const tesseractArgs = [
      args.path,
      'stdout',
      '-l', language,
      '--psm', String(psm),
    ];

    if (args.dpi) {
      tesseractArgs.push('--dpi', String(args.dpi));
    }

    allText = await runCommand('tesseract', tesseractArgs);
    totalConfidence = 0.9; // Estimate for image OCR
  }

  // Clean up the text
  allText = normalizeText(allText);

  // Store the result
  const stored = await store.put(allText, 'text/plain');

  return {
    textRef: stored.ref,
    pages,
    confidence: totalConfidence,
    preview: allText.slice(0, 500) + (allText.length > 500 ? '...' : ''),
  };
}

/**
 * Segment text into chunks with offsets
 */
export async function segmentText(args: SegmentArgs): Promise<{
  chunksRef: ContentRef;
  chunkCount: number;
  sections: DocumentSection[];
}> {
  const store = await getContentStore();
  const strategy = args.strategy ?? 'paragraph';
  const chunkSize = args.chunkSize ?? 1000;
  const overlap = args.overlap ?? 100;

  // Get the text content
  const textRef = args.textRef as ContentRef;
  const text = await store.getString(textRef);
  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  const chunks: DocumentChunk[] = [];
  const sections: DocumentSection[] = [];
  let docId = textRef.slice(7, 15); // Use part of hash as doc ID

  switch (strategy) {
    case 'heading':
      segmentByHeading(text, docId, chunks, sections);
      break;
    case 'paragraph':
      segmentByParagraph(text, docId, chunks);
      break;
    case 'sentence':
      segmentBySentence(text, docId, chunks);
      break;
    case 'fixed':
      segmentByFixed(text, docId, chunks, chunkSize, overlap);
      break;
  }

  // Store chunks
  const chunksStored = await store.put(JSON.stringify(chunks), 'application/json');

  return {
    chunksRef: chunksStored.ref,
    chunkCount: chunks.length,
    sections,
  };
}

/**
 * Clean and normalize text
 */
export async function cleanAndNormalize(args: { textRef: string }): Promise<{
  cleanedRef: ContentRef;
  changes: string[];
}> {
  const store = await getContentStore();
  const textRef = args.textRef as ContentRef;
  const text = await store.getString(textRef);
  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  const changes: string[] = [];
  let cleaned = text;

  // Normalize whitespace
  const beforeWs = cleaned.length;
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  if (cleaned.length !== beforeWs) {
    changes.push('Normalized whitespace');
  }

  // Remove control characters
  const beforeCtrl = cleaned.length;
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (cleaned.length !== beforeCtrl) {
    changes.push('Removed control characters');
  }

  // Normalize quotes
  const beforeQuotes = cleaned;
  cleaned = cleaned.replace(/[""]/g, '"');
  cleaned = cleaned.replace(/['']/g, "'");
  if (cleaned !== beforeQuotes) {
    changes.push('Normalized quotes');
  }

  // Trim lines
  cleaned = cleaned.split('\n').map((line) => line.trim()).join('\n');

  const stored = await store.put(cleaned, 'text/plain');

  return {
    cleanedRef: stored.ref,
    changes,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed (${code}): ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseYamlMetadata(yaml: string): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  const lines = yaml.split('\n');

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      metadata[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  return metadata;
}

function segmentByHeading(
  text: string,
  docId: string,
  chunks: DocumentChunk[],
  sections: DocumentSection[]
): void {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let lastEnd = 0;
  let chunkIndex = 0;
  let match;

  while ((match = headingRegex.exec(text)) !== null) {
    // Add content before this heading as a chunk
    if (match.index > lastEnd) {
      const content = text.slice(lastEnd, match.index).trim();
      if (content) {
        chunks.push({
          id: `${docId}-chunk-${chunkIndex}`,
          documentId: docId,
          index: chunkIndex++,
          type: 'paragraph',
          content,
          startOffset: lastEnd,
          endOffset: match.index,
        });
      }
    }

    // Add heading as a section
    const level = match[1].length;
    const title = match[2];
    sections.push({
      id: `${docId}-section-${sections.length}`,
      documentId: docId,
      title,
      level,
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      chunkIds: [],
    });

    // Add heading as a chunk
    chunks.push({
      id: `${docId}-chunk-${chunkIndex}`,
      documentId: docId,
      index: chunkIndex++,
      type: 'heading',
      content: match[0],
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      level,
    });

    lastEnd = match.index + match[0].length;
  }

  // Add remaining content
  if (lastEnd < text.length) {
    const content = text.slice(lastEnd).trim();
    if (content) {
      chunks.push({
        id: `${docId}-chunk-${chunkIndex}`,
        documentId: docId,
        index: chunkIndex,
        type: 'paragraph',
        content,
        startOffset: lastEnd,
        endOffset: text.length,
      });
    }
  }
}

function segmentByParagraph(text: string, docId: string, chunks: DocumentChunk[]): void {
  const paragraphs = text.split(/\n\n+/);
  let offset = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    if (para) {
      const startOffset = text.indexOf(para, offset);
      chunks.push({
        id: `${docId}-chunk-${i}`,
        documentId: docId,
        index: i,
        type: 'paragraph',
        content: para,
        startOffset,
        endOffset: startOffset + para.length,
      });
      offset = startOffset + para.length;
    }
  }
}

function segmentBySentence(text: string, docId: string, chunks: DocumentChunk[]): void {
  // Simple sentence splitting - in production, use NLP library
  const sentenceRegex = /[^.!?]+[.!?]+/g;
  let match;
  let index = 0;

  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentence = match[0].trim();
    if (sentence) {
      chunks.push({
        id: `${docId}-chunk-${index}`,
        documentId: docId,
        index,
        type: 'paragraph',
        content: sentence,
        startOffset: match.index,
        endOffset: match.index + match[0].length,
      });
      index++;
    }
  }
}

function segmentByFixed(
  text: string,
  docId: string,
  chunks: DocumentChunk[],
  chunkSize: number,
  overlap: number
): void {
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const content = text.slice(start, end);

    chunks.push({
      id: `${docId}-chunk-${index}`,
      documentId: docId,
      index,
      type: 'paragraph',
      content,
      startOffset: start,
      endOffset: end,
    });

    start = end - overlap;
    if (start >= text.length - overlap) break;
    index++;
  }
}
