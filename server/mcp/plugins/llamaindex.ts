/**
 * LlamaIndex Tools Plugin (TypeScript)
 *
 * Provides lightweight Node-side utilities that leverage LlamaIndex's
 * text splitting for fast wins without requiring external services.
 */

import { SentenceSplitter } from 'llamaindex';

type LlamaIndexChunk = {
  text: string;
  startChar?: number;
  endChar?: number;
};

export async function chunkText(args: {
  text: string;
  chunkSize?: number;
  chunkOverlap?: number;
}): Promise<{ chunks: LlamaIndexChunk[]; count: number }> {
  const splitter = new SentenceSplitter({
    chunkSize: args.chunkSize ?? 512,
    chunkOverlap: args.chunkOverlap ?? 50,
  });

  const nodes = splitter.getNodesFromText(args.text);
  const chunks = nodes.map((node) => ({
    text: extractNodeText(node),
    startChar: (node as { startCharIdx?: number }).startCharIdx,
    endChar: (node as { endCharIdx?: number }).endCharIdx,
  }));

  return { chunks, count: chunks.length };
}

function extractNodeText(node: unknown): string {
  if (typeof node === 'string') {
    return node;
  }
  if (typeof (node as { text?: string }).text === 'string') {
    return (node as { text: string }).text;
  }
  const content = (node as { getContent?: () => string }).getContent?.();
  if (typeof content === 'string') {
    return content;
  }
  return '';
}
