/**
 * LlamaIndex Tools Plugin (TypeScript)
 *
 * Provides lightweight Node-side utilities that leverage LlamaIndex's
 * text splitting for fast wins without requiring external services.
 */

import { SentenceSplitter } from "llamaindex";

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

  // splitText returns string[] in some versions, and getNodesFromText returns TextNode[]
  // We use splitText for maximum compatibility if getNodesFromText fails type checks
  const chunks_text = splitter.splitText(args.text);

  const chunks = chunks_text.map((text, index) => ({
    text: text,
    // Approximate indices if not provided by the splitter
    startChar: index * (args.chunkSize ?? 512),
    endChar: (index + 1) * (args.chunkSize ?? 512),
  }));

  return { chunks, count: chunks.length };
}
