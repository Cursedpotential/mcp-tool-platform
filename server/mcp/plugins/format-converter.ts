/**
 * Format Converter Plugin - Universal I/O with OCR support
 * 
 * Offloads heavy document processing to native tools:
 * - Tesseract for OCR (images, scanned PDFs)
 * - Pandoc for format conversion
 * - pypdf for PDF text extraction
 * - Native parsers for JSON, CSV, HTML
 * 
 * Returns structured data for LLM consumption with minimal tokens.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// Supported formats
const SUPPORTED_INPUT = new Set([
  '.json', '.csv', '.tsv', '.html', '.htm', '.md', '.txt',
  '.docx', '.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp'
]);

const SUPPORTED_OUTPUT = new Set(['json', 'csv', 'md', 'html', 'pdf', 'docx']);

// Tool availability cache
let toolStatus: Record<string, boolean> | null = null;

// Check available tools
async function checkTools(): Promise<Record<string, boolean>> {
  if (toolStatus) return toolStatus;
  
  const checks = {
    tesseract: 'tesseract --version',
    pandoc: 'pandoc --version',
    pdftoppm: 'pdftoppm -v',
    python: 'python3 --version'
  };
  
  toolStatus = {};
  for (const [tool, cmd] of Object.entries(checks)) {
    try {
      await execAsync(cmd, { timeout: 5000 });
      toolStatus[tool] = true;
    } catch {
      toolStatus[tool] = false;
    }
  }
  
  return toolStatus;
}

// Schema check result
interface SchemaCheck {
  valid: boolean;
  formatDetected: string;
  messageCount: number;
  sampleMessages: Record<string, any>[];
  fieldStats: Record<string, number>;
  warnings: string[];
  errors: string[];
}

// Message structure (normalized)
interface Message {
  body?: string;
  date?: string;
  readableDate?: string;
  contactName?: string;
  address?: string;
  messageType?: string;
  [key: string]: any;
}

// OCR image using Tesseract
async function ocrImage(filePath: string, lang: string = 'eng'): Promise<string> {
  const tools = await checkTools();
  if (!tools.tesseract) {
    throw new Error('Tesseract not installed. Install with: apt install tesseract-ocr');
  }
  
  try {
    const { stdout } = await execAsync(
      `tesseract "${filePath}" stdout -l ${lang}`,
      { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout;
  } catch (error: any) {
    throw new Error(`OCR failed: ${error.message}`);
  }
}

// OCR PDF using pdftoppm + Tesseract
async function ocrPdf(filePath: string, lang: string = 'eng'): Promise<string> {
  const tools = await checkTools();
  if (!tools.tesseract || !tools.pdftoppm) {
    throw new Error('Tesseract or pdftoppm not installed');
  }
  
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocr-'));
  
  try {
    // Convert PDF pages to images
    await execAsync(
      `pdftoppm -png "${filePath}" "${tmpDir}/page"`,
      { timeout: 120000 }
    );
    
    // Get all page images
    const files = await fs.readdir(tmpDir);
    const pageImages = files.filter(f => f.endsWith('.png')).sort();
    
    // OCR each page
    const texts: string[] = [];
    for (const img of pageImages) {
      const text = await ocrImage(path.join(tmpDir, img), lang);
      texts.push(text);
    }
    
    return texts.join('\n\n--- PAGE ---\n\n');
  } finally {
    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

// Extract text from PDF using Python pypdf (faster than OCR for text PDFs)
async function extractPdfText(filePath: string): Promise<string | null> {
  const tools = await checkTools();
  if (!tools.python) return null;
  
  const script = `
import sys
try:
    import pypdf
    reader = pypdf.PdfReader(sys.argv[1])
    for page in reader.pages:
        text = page.extract_text()
        if text:
            print(text)
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;
  
  try {
    const { stdout } = await execAsync(
      `python3 -c '${script.replace(/'/g, "'\\''")}' "${filePath}"`,
      { timeout: 30000, maxBuffer: 50 * 1024 * 1024 }
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

// Parse JSON content
function parseJson(content: string): Message[] {
  try {
    const data = JSON.parse(content);
    
    if (Array.isArray(data)) return data;
    
    if (typeof data === 'object') {
      // Check common message container keys
      for (const key of ['messages', 'sms', 'mms', 'data', 'conversations', 'items']) {
        if (data[key] && Array.isArray(data[key])) {
          // Special handling for sms/mms combined
          if (key === 'sms' || key === 'mms') {
            return [...(data.sms || []), ...(data.mms || [])];
          }
          return data[key];
        }
      }
      return [data];
    }
    
    return [];
  } catch {
    return [];
  }
}

// Parse CSV content
function parseCsv(content: string, delimiter: string = ','): Message[] {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const messages: Message[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    const msg: Message = {};
    headers.forEach((h, idx) => {
      if (values[idx]) msg[h] = values[idx];
    });
    messages.push(msg);
  }
  
  return messages;
}

// Parse HTML content
function parseHtml(content: string): Message[] {
  const messages: Message[] = [];
  
  // Extract text from message-like divs
  const msgPattern = /<div[^>]*class="[^"]*(?:message|msg|chat)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  
  while ((match = msgPattern.exec(content)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text) {
      messages.push({ body: text, source: 'html' });
    }
  }
  
  // Fallback: extract from paragraphs
  if (messages.length === 0) {
    const pPattern = /<(?:p|div|span)[^>]*>([\s\S]*?)<\/(?:p|div|span)>/gi;
    while ((match = pPattern.exec(content)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, '').trim();
      if (text.length > 10) {
        messages.push({ body: text });
      }
    }
  }
  
  return messages;
}

// Parse plaintext content
function parsePlaintext(content: string): Message[] {
  return content
    .split('\n')
    .filter(l => l.trim())
    .map(line => ({
      body: line.trim(),
      date: new Date().toISOString()
    }));
}

// Main file parser
async function parseFile(filePath: string): Promise<{ messages: Message[]; format: string }> {
  const ext = path.extname(filePath).toLowerCase();
  
  // Image files - OCR
  if (['.png', '.jpg', '.jpeg', '.tiff', '.bmp'].includes(ext)) {
    const text = await ocrImage(filePath);
    return { messages: parsePlaintext(text), format: 'ocr' };
  }
  
  // PDF files - try text extraction first, then OCR
  if (ext === '.pdf') {
    const text = await extractPdfText(filePath);
    if (text && text.length > 50) {
      return { messages: parsePlaintext(text), format: 'pdf-text' };
    }
    const ocrText = await ocrPdf(filePath);
    return { messages: parsePlaintext(ocrText), format: 'pdf-ocr' };
  }
  
  // Read text-based files
  const content = await fs.readFile(filePath, 'utf-8');
  
  if (ext === '.json') {
    return { messages: parseJson(content), format: 'json' };
  }
  
  if (ext === '.csv') {
    return { messages: parseCsv(content, ','), format: 'csv' };
  }
  
  if (ext === '.tsv') {
    return { messages: parseCsv(content, '\t'), format: 'tsv' };
  }
  
  if (['.html', '.htm'].includes(ext)) {
    return { messages: parseHtml(content), format: 'html' };
  }
  
  // Default: plaintext
  return { messages: parsePlaintext(content), format: 'plaintext' };
}

// Check schema validity
async function checkSchema(filePath: string, previewCount: number = 5): Promise<SchemaCheck> {
  try {
    const { messages, format } = await parseFile(filePath);
    
    if (!messages.length) {
      return {
        valid: false,
        formatDetected: format,
        messageCount: 0,
        sampleMessages: [],
        fieldStats: {},
        warnings: ['No messages found'],
        errors: []
      };
    }
    
    // Calculate field coverage
    const stats: Record<string, number> = {
      body: 0, date: 0, readableDate: 0, contactName: 0, address: 0
    };
    
    for (const msg of messages) {
      if (msg.body) stats.body++;
      if (msg.date || msg.timestamp) stats.date++;
      if (msg.readableDate || msg.readable_date) stats.readableDate++;
      if (msg.contactName || msg.contact_name || msg.sender || msg.from) stats.contactName++;
      if (msg.address || msg.phone || msg.number) stats.address++;
    }
    
    const warnings: string[] = [];
    if (stats.body < messages.length) {
      warnings.push(`Missing body in ${messages.length - stats.body} messages`);
    }
    if (stats.date === 0) {
      warnings.push('No dates found');
    }
    
    return {
      valid: stats.body > 0,
      formatDetected: format,
      messageCount: messages.length,
      sampleMessages: messages.slice(0, previewCount),
      fieldStats: stats,
      warnings,
      errors: []
    };
  } catch (error: any) {
    return {
      valid: false,
      formatDetected: 'error',
      messageCount: 0,
      sampleMessages: [],
      fieldStats: {},
      warnings: [],
      errors: [error.message]
    };
  }
}

// Convert to JSON
function toJson(messages: Message[]): string {
  return JSON.stringify({
    messages,
    exported: new Date().toISOString(),
    count: messages.length
  }, null, 2);
}

// Convert to CSV
function toCsv(messages: Message[]): string {
  if (!messages.length) return '';
  
  const fields = ['date', 'readableDate', 'contactName', 'address', 'body'];
  const header = fields.join(',');
  
  const rows = messages.map(m => {
    return fields.map(f => {
      const val = String(m[f] || m[f.replace(/([A-Z])/g, '_$1').toLowerCase()] || '')
        .replace(/"/g, '""')
        .replace(/\n/g, ' ')
        .slice(0, 500);
      return `"${val}"`;
    }).join(',');
  });
  
  return [header, ...rows].join('\n');
}

// Convert to Markdown
function toMarkdown(messages: Message[]): string {
  const lines = [
    '# Exported Messages',
    `*${messages.length} messages*`,
    ''
  ];
  
  for (const m of messages) {
    const date = m.readableDate || m.readable_date || m.date || 'N/A';
    const sender = m.contactName || m.contact_name || m.sender || m.address || 'Unknown';
    const body = m.body || '';
    
    lines.push(`**[${date}] ${sender}**`);
    lines.push(`> ${body}`);
    lines.push('');
  }
  
  return lines.join('\n');
}

// Convert with Pandoc
async function convertWithPandoc(
  content: string,
  outputFormat: 'pdf' | 'docx' | 'html',
  title?: string
): Promise<Buffer | null> {
  const tools = await checkTools();
  if (!tools.pandoc) return null;
  
  const tmpInput = path.join(os.tmpdir(), `convert-${Date.now()}.md`);
  const tmpOutput = path.join(os.tmpdir(), `convert-${Date.now()}.${outputFormat}`);
  
  try {
    await fs.writeFile(tmpInput, content);
    
    const args = ['pandoc', tmpInput, '-o', tmpOutput];
    if (outputFormat === 'pdf') args.push('--pdf-engine=xelatex');
    if (outputFormat === 'html') args.push('--standalone');
    if (title) args.push('-V', `title:${title}`);
    
    await execAsync(args.join(' '), { timeout: 60000 });
    
    return await fs.readFile(tmpOutput);
  } catch {
    return null;
  } finally {
    await fs.unlink(tmpInput).catch(() => {});
    await fs.unlink(tmpOutput).catch(() => {});
  }
}

// Tool definitions for MCP registry
export const formatConverterTools = [
  {
    name: 'convert.parse',
    description: 'Parse any supported file format into structured messages. Supports JSON, CSV, HTML, PDF, images (OCR), DOCX.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to file to parse' },
        ocrLanguage: { type: 'string', description: 'OCR language code', default: 'eng' }
      },
      required: ['filePath']
    },
    handler: async (params: { filePath: string; ocrLanguage?: string }) => {
      const { messages, format } = await parseFile(params.filePath);
      return {
        success: messages.length > 0,
        format,
        count: messages.length,
        messages: messages.slice(0, 100),  // Limit for token efficiency
        hasMore: messages.length > 100
      };
    }
  },
  {
    name: 'convert.ocr',
    description: 'Extract text from images or scanned PDFs using Tesseract OCR',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to image or PDF' },
        language: { type: 'string', description: 'OCR language code', default: 'eng' }
      },
      required: ['filePath']
    },
    handler: async (params: { filePath: string; language?: string }) => {
      const ext = path.extname(params.filePath).toLowerCase();
      const text = ext === '.pdf'
        ? await ocrPdf(params.filePath, params.language || 'eng')
        : await ocrImage(params.filePath, params.language || 'eng');
      return { success: true, text, charCount: text.length };
    }
  },
  {
    name: 'convert.check_schema',
    description: 'Validate file schema and check field coverage before processing',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to file to check' },
        previewCount: { type: 'number', description: 'Number of sample messages', default: 5 }
      },
      required: ['filePath']
    },
    handler: async (params: { filePath: string; previewCount?: number }) => {
      return checkSchema(params.filePath, params.previewCount || 5);
    }
  },
  {
    name: 'convert.to_format',
    description: 'Convert parsed messages to specified output format',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to source file' },
        outputFormat: { type: 'string', enum: ['json', 'csv', 'md', 'html', 'pdf', 'docx'], description: 'Output format' },
        outputPath: { type: 'string', description: 'Path for output file (optional)' }
      },
      required: ['filePath', 'outputFormat']
    },
    handler: async (params: { filePath: string; outputFormat: string; outputPath?: string }) => {
      const { messages, format } = await parseFile(params.filePath);
      
      let content: string | Buffer;
      let ext: string;
      
      switch (params.outputFormat) {
        case 'json':
          content = toJson(messages);
          ext = '.json';
          break;
        case 'csv':
          content = toCsv(messages);
          ext = '.csv';
          break;
        case 'md':
          content = toMarkdown(messages);
          ext = '.md';
          break;
        case 'html':
        case 'pdf':
        case 'docx':
          const md = toMarkdown(messages);
          const converted = await convertWithPandoc(md, params.outputFormat as any);
          if (!converted) {
            throw new Error('Pandoc conversion failed');
          }
          content = converted;
          ext = `.${params.outputFormat}`;
          break;
        default:
          throw new Error(`Unsupported format: ${params.outputFormat}`);
      }
      
      const outputPath = params.outputPath || path.join(
        path.dirname(params.filePath),
        `${path.basename(params.filePath, path.extname(params.filePath))}_converted${ext}`
      );
      
      await fs.writeFile(outputPath, content);
      
      return {
        success: true,
        inputFormat: format,
        outputFormat: params.outputFormat,
        messageCount: messages.length,
        outputPath
      };
    }
  },
  {
    name: 'convert.status',
    description: 'Check availability of conversion tools (Tesseract, Pandoc, etc.)',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      return checkTools();
    }
  }
];

export { parseFile, checkSchema, ocrImage, ocrPdf, toJson, toCsv, toMarkdown };
export default formatConverterTools;
