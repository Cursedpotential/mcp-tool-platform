import { z } from "zod";
import { protectedProcedure, router } from "../../core/trpc";
import { ingestEvidence } from "../../mcp/ingest";

export const ingestionRouter = router({
  ingestLocalFile: protectedProcedure
    .input(
      z.object({
        filePath: z.string(),
        sourceType: z.string().default("unknown"),
      })
    )
    .mutation(async ({ input }) => {
      const fileName = input.filePath.split('/').pop() || input.filePath.split('\\').pop() || 'unknown.file';
      
      const result = await ingestEvidence(
        input.sourceType,
        fileName,
        null, // No raw content, read from disk
        input.filePath,
        { method: 'api_direct_path' }
      );
      
      return result;
    }),

  ingestRawText: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        sourceName: z.string().default("raw_text_input"),
        sourceType: z.string().default("text"),
      })
    )
    .mutation(async ({ input }) => {
      const result = await ingestEvidence(
        input.sourceType,
        input.sourceName,
        input.content,
        null, // No binary path
        { method: 'api_raw_text' }
      );
      
      return result;
    })
});
