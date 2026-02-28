import { z } from "zod";
import { protectedProcedure, router } from "../../core/trpc";
import { xmlStreamingParser } from "../../mcp/plugins/xml-streaming-parser";
import { timelineParser } from "../../mcp/plugins/timeline-parser";
import { htmlStreamingParser } from "../../mcp/plugins/html-parser";
import { markdownParser } from "../../mcp/plugins/markdown-parser";
import { createDirectusClient } from "../../mcp/storage/directus-client";
import { graphitiClient } from "../../mcp/storage/graphiti-client";
import { chromaManager } from "../../mcp/storage/chroma-client";
import { uuidv7 } from "uuidv7";
import { getDb } from "../../core/db.postgres";
import { messagingDocuments, messagingMessages, messagingBehaviors } from "../../../drizzle/production-message-schemas";
import { behaviorService } from "../../mcp/forensics/behavior-service";
import { identityService } from "../../mcp/forensics/identity-service";

// Initialize clients
const directusClient = createDirectusClient();

export const ingestionRouter = router({
  processXmlBackup: protectedProcedure
    .input(
      z.object({
        fileId: z.string().optional(), // ID if already in Directus
        content: z.string().optional(), // Raw XML if uploading directly
        filename: z.string(),
        caseId: z.string().default("default_case"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let xmlContent = input.content;
      const db = await getDb();
      
      // Hash content first (Forensic Soundness)
      const fileHash = xmlContent ? identityService.hashContent(xmlContent) : "unknown";

      // Create Document Record (Chain of Custody)
      // Note: UUIDv7 used for ID if schema allows string ID, otherwise let DB default or use uuidv7()
      const docId = uuidv7(); 
      if (db) {
        await db.insert(messagingDocuments).values({
            // id: docId, 
            filename: input.filename,
            fileHash: fileHash,
            fileType: "sms_xml",
            sourcePlatform: "android",
            metadata: { caseId: input.caseId },
            acquiredDate: new Date()
        });
      }

      if (!xmlContent) throw new Error("No content provided");

      const messageIterator = xmlStreamingParser.parseString(xmlContent);
      
      const batchId = uuidv7();
      let count = 0;
      const BATCH_SIZE = 50;
      
      let chromaBatch: any[] = [];
      let postgresMessages: any[] = [];
      
      for await (const msg of messageIterator) {
        count++;
        
        // 1. Resolve Identity / Conversation
        const participants = [msg.address || "unknown", "SELF"];
        const conversationId = await identityService.resolveConversation(participants, "sms");

        // 2. Analyze Behavior (Modular)
        const behaviors = await behaviorService.analyze(msg.body || "");
        
        // 3. Prepare Postgres Record
        // const msgId = uuidv7(); 
        
        postgresMessages.push({
            // id: msgId, 
            conversationId: conversationId,
            documentId: docId, // PROVENANCE LINK
            timestamp: new Date(msg.date_iso || Date.now()),
            sender: msg.address || "unknown",
            recipient: "SELF",
            body: msg.body,
            direction: msg.type === "1" ? "inbound" : "outbound",
            messageType: "sms",
            hasBehaviors: behaviors.length > 0 ? 1 : 0,
            behaviorCategories: JSON.stringify(behaviors.map(b => b.category)),
            contentHash: identityService.hashContent(msg.body || ""), // FORENSIC HASH
        });

        // 4. Prepare Chroma Record (Tier 1)
        chromaBatch.push({
            document: msg.body || "[Media Content]",
            id: `msg_${batchId}_${count}`, // specific ID format for chroma chunk
            metadata: {
                sender: msg.address,
                timestamp: msg.date_iso,
                type: msg.type,
                conversationId: conversationId,
                documentId: docId, // PROVENANCE LINK
                fileHash: fileHash, // PROVENANCE HASH
                behaviors: behaviors.map(b => b.name).join(","),
                batchId
            }
        });

        // Batch Flush
        if (postgresMessages.length >= BATCH_SIZE) {
            // Tier 0/1: Chroma - Evidence Processing (72hr TTL)
            await chromaManager.addEvidence(
                docId,
                chromaBatch.map(b => ({
                    id: b.id,
                    text: b.document,
                    metadata: b.metadata
                }))
            );
            
            // Tier 2: Postgres
            if (db) {
                await db.insert(messagingMessages).values(postgresMessages);
            }
            
            chromaBatch = [];
            postgresMessages = [];
        }
      }
      
      // Flush remaining
      if (chromaBatch.length > 0) {
           // Tier 0/1: Chroma - Evidence Processing (72hr TTL)
           await chromaManager.addEvidence(
               docId,
               chromaBatch.map(b => ({
                   id: b.id,
                   text: b.document,
                   metadata: b.metadata
               }))
           );
           if (db && postgresMessages.length > 0) {
                await db.insert(messagingMessages).values(postgresMessages);
           }
      }

      console.log(`[Ingestion] Stream processed ${count} messages`);

      return {
        success: true,
        messageCount: count,
        batchId
      };
    }),

  processChatExport: protectedProcedure
    .input(
      z.object({
        fileId: z.string().optional(),
        content: z.string().optional(),
        filename: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      let htmlContent = input.content;
      if (!htmlContent) throw new Error("No content provided");

      // 1. Detect Schema
      const schema = htmlStreamingParser.detectSchema(input.filename);
      if (!schema) {
        throw new Error(`No schema found for file: ${input.filename}`);
      }

      console.log(`[Ingestion] Processing ${input.filename} with schema ${schema.name}`);

      // 2. Parse Stream
      const messageIterator = htmlStreamingParser.parseString(htmlContent, schema);
      const batchId = uuidv7();
      let count = 0;
      const CHROMA_BATCH_SIZE = 50;
      let chromaBatch: any[] = [];

      for await (const msg of messageIterator) {
        count++;
        chromaBatch.push({
          document: msg.content,
          id: `msg_${batchId}_${count}`,
          metadata: {
            sender: msg.sender,
            timestamp: msg.timestamp,
            type: "chat_message",
            platform: schema.name,
            batchId,
          },
        });

        if (chromaBatch.length >= CHROMA_BATCH_SIZE) {
          // Use chromaManager.addEvidence for chat exports (evidence processing with TTL)
          await chromaManager.addEvidence(
            `chat_${batchId}`,
            chromaBatch.map((b) => ({
              id: b.id,
              text: b.document,
              metadata: b.metadata,
            }))
          );
          chromaBatch = [];
        }
      }

      if (chromaBatch.length > 0) {
        // Use chromaManager.addEvidence for remaining chat exports
        await chromaManager.addEvidence(
          `chat_${batchId}`,
          chromaBatch.map((b) => ({
            id: b.id,
            text: b.document,
            metadata: b.metadata,
          }))
        );
      }

      return { success: true, count, batchId };
    }),

  processJournal: protectedProcedure
    .input(
      z.object({
        fileId: z.string().optional(),
        content: z.string().optional(),
        filename: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      let mdContent = input.content;
      if (!mdContent) throw new Error("No content provided");

      const entryIterator = markdownParser.parseString(mdContent);
      const batchId = uuidv7();
      let count = 0;

      for await (const entry of entryIterator) {
        count++;
        // Use chromaManager.addContext for journal entries (persistent project context)
        await chromaManager.addContext(
          `journal_${batchId}_${count}`,
          entry.content,
          "case_info",
          {
            title: entry.title || "Untitled",
            date: entry.date || new Date().toISOString(),
            type: "journal_entry",
            batchId,
          }
        );
      }

      return { success: true, count, batchId };
    }),

  processTimeline: protectedProcedure
    .input(
      z.object({
        fileId: z.string().optional(),
        content: z.string().optional(),
        filename: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      let jsonContent = input.content;
      if (!jsonContent) throw new Error("No content provided");

      // 1. Parse Timeline
      const events = timelineParser.parse(jsonContent);
      console.log(`[Ingestion] Parsed ${events.length} timeline events`);

      const batchId = uuidv7();

      // 2. Store in Chroma (Tier 1 - Context) using chromaManager.addContext for persistent timeline data
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        await chromaManager.addContext(
          `evt_${e.startTime.getTime()}_${batchId}`,
          `${e.type} at ${e.startTime.toISOString()}: ${e.metadata.semanticType || e.metadata.activityType || "Unknown location"}`,
          "case_info",
          {
            type: e.type,
            timestamp: e.startTime.toISOString(),
            placeId: e.metadata.placeId || "",
            batchId
          }
        );
      }

      // 3. Store in Graphiti (Tier 3 - Relational/Temporal)
      const entities = events
        .filter(e => e.type === "VISIT" && e.metadata.placeId)
        .map(e => ({
          id: `place_${e.metadata.placeId}`,
          type: "PLACE",
          name: e.metadata.address || e.metadata.name || "Unknown Place",
          properties: {
            placeId: e.metadata.placeId,
            semanticType: e.metadata.semanticType
          }
        }));
      
      await graphitiClient.storeEntities(entities);

      const relationships = events
        .filter(e => e.type === "VISIT")
        .map(e => ({
          id: `visit_${uuidv7()}`,
          type: "VISITED",
          fromEntityId: "ME", // Placeholder for subject
          toEntityId: `place_${e.metadata.placeId}`,
          properties: {
            confidence: e.metadata.confidence,
            distance: e.metadata.distanceMeters
          },
          valid_from: e.startTime,
          valid_to: e.endTime
        }));

      await graphitiClient.storeRelationships(relationships);

      return { success: true, count: events.length };
    }),
});
