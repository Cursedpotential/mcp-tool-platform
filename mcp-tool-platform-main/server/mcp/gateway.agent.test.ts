/**
 * Tests for agent-friendly MCP gateway endpoints
 */

import { describe, it, expect } from 'vitest';
import { mcpGatewayRouter } from './gateway';
import type { inferProcedureInput } from '@trpc/server';

type Router = typeof mcpGatewayRouter;

describe('Agent-Friendly MCP Gateway', () => {
  describe('listTools', () => {
    it('should return paginated tool catalog', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      const result = await caller.listTools({ limit: 10, offset: 0 });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.tools).toBeInstanceOf(Array);
      expect(result.data?.total).toBeGreaterThan(0);
      expect(result.data?.tools.length).toBeLessThanOrEqual(10);
    });

    it('should filter by category', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      const result = await caller.listTools({ category: 'document' });
      
      expect(result.success).toBe(true);
      expect(result.data?.tools.every(t => t.category === 'document')).toBe(true);
    });

    it('should handle pagination', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      const page1 = await caller.listTools({ limit: 5, offset: 0 });
      const page2 = await caller.listTools({ limit: 5, offset: 5 });
      
      expect(page1.data?.tools.length).toBeLessThanOrEqual(5);
      expect(page2.data?.tools.length).toBeLessThanOrEqual(5);
      
      // Tools should be different
      const page1Names = new Set(page1.data?.tools.map(t => t.name));
      const page2Names = new Set(page2.data?.tools.map(t => t.name));
      const intersection = [...page1Names].filter(n => page2Names.has(n));
      expect(intersection.length).toBe(0);
    });
  });

  describe('listCategories', () => {
    it('should return all categories with counts', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      const result = await caller.listCategories();
      
      expect(result.success).toBe(true);
      expect(result.data?.categories).toBeInstanceOf(Array);
      expect(result.data?.categories.length).toBeGreaterThan(0);
      
      // Each category should have name and count
      for (const cat of result.data?.categories || []) {
        expect(cat.name).toBeDefined();
        expect(typeof cat.count).toBe('number');
        expect(cat.count).toBeGreaterThan(0);
      }
    });
  });

  describe('getToolsByCategory', () => {
    it('should return tools in specified category', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      const result = await caller.getToolsByCategory({ category: 'forensics' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data?.every(t => t.category === 'forensics')).toBe(true);
    });

    it('should return empty array for non-existent category', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      const result = await caller.getToolsByCategory({ category: 'nonexistent' });
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getRelatedTools', () => {
    it('should return related tools for a given tool', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      const result = await caller.getRelatedTools({ 
        toolName: 'forensics.analyze_patterns',
        limit: 5 
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data?.length).toBeLessThanOrEqual(5);
      
      // Should not include the original tool
      expect(result.data?.every(t => t.name !== 'forensics.analyze_patterns')).toBe(true);
    });

    it('should throw for non-existent tool', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      await expect(
        caller.getRelatedTools({ toolName: 'nonexistent.tool', limit: 5 })
      ).rejects.toThrow();
    });
  });

  describe('listWorkflows', () => {
    it('should return workflow templates', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      const result = await caller.listWorkflows();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data?.length).toBeGreaterThan(0);
      
      // Check workflow structure
      const workflow = result.data?.[0];
      expect(workflow?.id).toBeDefined();
      expect(workflow?.name).toBeDefined();
      expect(workflow?.steps).toBeInstanceOf(Array);
      expect(workflow?.steps.length).toBeGreaterThan(0);
    });

    it('should filter workflows by category', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      const result = await caller.listWorkflows({ category: 'forensics' });
      
      expect(result.success).toBe(true);
      expect(result.data?.every(w => w.category === 'forensics')).toBe(true);
    });
  });

  describe('getWorkflow', () => {
    it('should return specific workflow by ID', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      const result = await caller.getWorkflow({ id: 'document_analysis' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('document_analysis');
      expect(result.data?.steps).toBeInstanceOf(Array);
    });

    it('should return null for non-existent workflow', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      const result = await caller.getWorkflow({ id: 'nonexistent_workflow' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('semanticRoute', () => {
    it('should route "analyze chat" intent to forensics tool', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      const result = await caller.semanticRoute({ 
        intent: 'analyze chat conversation for manipulation' 
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.recommendedTool).toBe('forensics.analyze_patterns');
      expect(result.data?.workflow).toBe('forensic_chat_analysis');
      expect(result.data?.confidence).toBeGreaterThan(0);
    });

    it('should route "extract text from image" to OCR tool', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      const result = await caller.semanticRoute({ 
        intent: 'extract text from scanned document' 
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.recommendedTool).toBe('format.ocr');
      expect(result.data?.workflow).toBe('document_analysis');
    });

    it('should route "summarize" intent to summarization tool', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      const result = await caller.semanticRoute({ 
        intent: 'summarize this long document' 
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.recommendedTool).toBe('summarize.hierarchical');
    });

    it('should throw for unrecognized intent', async () => {
      const caller = mcpGatewayRouter.createCaller({});
      
      await expect(
        caller.semanticRoute({ intent: 'do something completely unrelated' })
      ).rejects.toThrow();
    });

    it('should calculate confidence scores', async () => {      const caller = mcpGatewayRouter.createCaller({});
      
      const highConfidence = await caller.semanticRoute({ 
        intent: 'analyze chat conversation for gaslighting and manipulation patterns' 
      });
      
      const lowConfidence = await caller.semanticRoute({ 
        intent: 'convert' 
      });
      
      expect(highConfidence.data?.confidence).toBeGreaterThan(0);
      expect(lowConfidence.data?.confidence).toBeGreaterThan(0);
      // High confidence should be at least as high as low confidence (both might cap at 1.0)
      expect(highConfidence.data?.confidence).toBeGreaterThanOrEqual(
        lowConfidence.data?.confidence || 0
      );
    });
  });
});
