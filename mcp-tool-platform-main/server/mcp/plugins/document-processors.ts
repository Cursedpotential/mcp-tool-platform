import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { getContentStore } from '../store/content-store';
import { ocrImageOrPdf } from './document';
import { ocrImage, ocrPdf, parseFile } from './format-converter';

function execFileAsync(command: string, args: string[], timeout = 60000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

async function writeTempFile(content: Buffer | string, ext: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-doc-'));
  const filePath = path.join(dir, `input.${ext}`);
  await fs.writeFile(filePath, content);
  return filePath;
}

async function cleanupTempFile(filePath: string): Promise<void> {
  await fs.unlink(filePath).catch(() => undefined);
  await fs.rmdir(path.dirname(filePath)).catch(() => undefined);
}

export async function pandocConvert(args: {
  input: string;
  from?: string;
  to: string;
  options?: string[];
}): Promise<{ output: string; format: string; encoding?: 'base64' }> {
  const store = await getContentStore();
  let inputPath = args.input;
  let tempPath: string | null = null;

  if (args.input.startsWith('sha256:')) {
    const content = await store.get(args.input as `sha256:${string}`);
    if (!content) {
      throw new Error(`Content not found: ${args.input}`);
    }
    tempPath = await writeTempFile(content, args.from ?? 'txt');
    inputPath = tempPath;
  } else {
    const exists = await fs.stat(args.input).then(() => true).catch(() => false);
    if (!exists) {
      tempPath = await writeTempFile(args.input, args.from ?? 'txt');
      inputPath = tempPath;
    }
  }

  const outputIsBinary = ['pdf', 'docx'].includes(args.to);
  let outputPath: string | null = null;

  try {
    if (outputIsBinary) {
      outputPath = path.join(os.tmpdir(), `mcp-pandoc-${Date.now()}.${args.to}`);
      const cmdArgs = [
        '-f',
        args.from ?? 'markdown',
        '-t',
        args.to,
        ...((args.options ?? []) as string[]),
        inputPath,
        '-o',
        outputPath,
      ];
      await execFileAsync('pandoc', cmdArgs);
      const output = await fs.readFile(outputPath);
      return { output: output.toString('base64'), format: args.to, encoding: 'base64' };
    }

    const cmdArgs = [
      '-f',
      args.from ?? 'markdown',
      '-t',
      args.to,
      ...((args.options ?? []) as string[]),
      inputPath,
    ];
    const result = await execFileAsync('pandoc', cmdArgs);
    return { output: result.stdout, format: args.to };
  } finally {
    if (tempPath) {
      await cleanupTempFile(tempPath);
    }
    if (outputPath) {
      await fs.unlink(outputPath).catch(() => undefined);
    }
  }
}

export async function tesseractOcr(args: {
  image: string;
  language?: string;
  psm?: number;
}): Promise<{ text: string; confidence: number }> {
  const store = await getContentStore();
  let imagePath = args.image;
  let tempPath: string | null = null;

  if (args.image.startsWith('sha256:')) {
    const content = await store.get(args.image as `sha256:${string}`);
    if (!content) {
      throw new Error(`Content not found: ${args.image}`);
    }
    tempPath = await writeTempFile(content, 'png');
    imagePath = tempPath;
  } else {
    const exists = await fs.stat(args.image).then(() => true).catch(() => false);
    if (!exists) {
      const buffer = Buffer.from(args.image, 'base64');
      tempPath = await writeTempFile(buffer, 'png');
      imagePath = tempPath;
    }
  }

  try {
    const result = await ocrImageOrPdf({ path: imagePath, language: args.language, psm: args.psm });
    const text = await store.getString(result.textRef);
    if (!text) {
      throw new Error('OCR output missing');
    }
    return { text, confidence: result.confidence };
  } finally {
    if (tempPath) {
      await cleanupTempFile(tempPath);
    }
  }
}

export async function stirlingPdfProcess(args: {
  operation: 'merge' | 'split' | 'compress' | 'ocr' | 'rotate' | 'watermark' | 'extract_images';
  files: string[];
  options?: Record<string, unknown>;
}): Promise<{ output: string; format: string; pages?: number }> {
  if (args.operation !== 'ocr') {
    const baseUrl = typeof args.options?.baseUrl === 'string'
      ? String(args.options.baseUrl)
      : process.env.STIRLINGPDF_URL;

    if (!baseUrl) {
      throw new Error('StirlingPDF base URL not configured for non-OCR operations');
    }

    const endpoint = typeof args.options?.endpoint === 'string'
      ? String(args.options.endpoint)
      : `${baseUrl.replace(/\/$/, '')}/api/${args.operation}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: args.files, options: args.options ?? {} }),
    });

    if (!response.ok) {
      throw new Error(`StirlingPDF request failed: ${response.status}`);
    }

    const payload = await response.json() as { output?: string; format?: string; pages?: number };
    return {
      output: payload.output ?? '',
      format: payload.format ?? 'pdf',
      pages: payload.pages,
    };
  }

  const filePath = args.files[0];
  if (!filePath) {
    throw new Error('OCR operation requires at least one file');
  }

  const ext = filePath.toLowerCase();
  const text = ext.endsWith('.pdf')
    ? await ocrPdf(filePath, String(args.options?.language ?? 'eng'))
    : await ocrImage(filePath, String(args.options?.language ?? 'eng'));

  return {
    output: text,
    format: 'text',
  };
}

export async function unstructuredPartition(args: {
  file: string;
  strategy?: string;
  extractImages?: boolean;
}): Promise<{ elements: Array<{ type: string; text: string }>; metadata: Record<string, unknown> }> {
  const { messages, format } = await parseFile(args.file);
  const elements = messages.map((message) => ({
    type: 'text',
    text: message.body || JSON.stringify(message),
  }));

  return {
    elements,
    metadata: {
      format,
      strategy: args.strategy ?? 'auto',
      extractImages: args.extractImages ?? false,
      elementCount: elements.length,
    },
  };
}
