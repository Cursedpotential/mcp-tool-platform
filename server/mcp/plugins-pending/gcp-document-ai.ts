import {
  DocumentProcessorServiceClient,
  Document,
} from '@google-cloud/documentai';
import {
  DocumentAiPlugin,
  ProcessDocumentRequest,
  ProcessDocumentResponse,
  ClassifyDocumentRequest,
  ClassifyDocumentResponse,
  ExtractEntitiesRequest,
  ExtractEntitiesResponse,
} from '@mcp/core';
import { PluginManager } from '@mcp/core';

// Define types for requests and responses
export type ProcessDocumentRequestType = ProcessDocumentRequest;
export type ProcessDocumentResponseType = ProcessDocumentResponse;
export type ClassifyDocumentRequestType = ClassifyDocumentRequest;
export type ClassifyDocumentResponseType = ClassifyDocumentResponse;
export type ExtractEntitiesRequestType = ExtractEntitiesRequest;
export type ExtractEntitiesResponseType = ExtractEntitiesResponse;

const API_KEY = 'AIzaSyCmEDGGPNYFRKj4gnmJudWsJfQBQmeE-N8';

const client = new DocumentProcessorServiceClient({
  credentials: {
    client_email: 'documentai-service-account@your-project-id.iam.gserviceaccount.com', // Replace with your service account email
    private_key: '-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n', // Replace with your private key
  },
});

export function registerDocumentAIHandlers(pluginManager: PluginManager) {
  const documentAiPlugin: DocumentAiPlugin = {
    name: 'gcp-document-ai',
    version: '1.0.0',
    processDocument: async (
      request: ProcessDocumentRequestType
    ): Promise<ProcessDocumentResponseType> => {
      try {
        const { projectId, location, processorId, documentBase64, mimeType } = request;

        const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

        const [result] = await client.processDocument({
          name,
          rawDocument: {
            content: documentBase64,
            mimeType: mimeType,
          },
        });

        if (!result.document) {
          throw new Error('No document found in the processing result.');
        }

        const document: Document = result.document as Document;

        // Extract text, entities, and form fields based on the Document AI output structure
        const text = document.text || '';
        const pages = document.pages?.map(page => ({
          pageNumber: page.pageNumber || 0,
          image: page.image ? { content: page.image.content?.toString('base64') || '', mimeType: page.image.mimeType || '' } : undefined,
          blocks: page.blocks?.map(block => ({
            text: block.layout?.textAnchor?.content || '',
            boundingBox: block.layout?.boundingBox?.vertices?.map(v => ({ x: v.x || 0, y: v.y || 0 })) || [],
          })) || [],
          formFields: page.formFields?.map(field => ({
            fieldName: field.fieldName?.textAnchor?.content || '',
            fieldValue: field.fieldValue?.textAnchor?.content || '',
            confidence: field.fieldValue?.confidence || 0,
          })) || [],
        })) || [];

        const entities = document.entities?.map(entity => ({
          type: entity.type || '',
          mentionText: entity.mentionText || '',
          confidence: entity.confidence || 0,
          normalizedValue: entity.normalizedValue?.text || '',
        })) || [];

        return {
          text,
          pages,
          entities,
          document: document as any, // Return the full Document object for more detailed access
        };
      } catch (error: any) {
        console.error('Error processing document:', error);
        throw new Error(`Failed to process document: ${error.message}`);
      }
    },

    classifyDocument: async (
      request: ClassifyDocumentRequestType
    ): Promise<ClassifyDocumentResponseType> => {
      try {
        const { projectId, location, processorId, documentBase64, mimeType } = request;

        const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

        const [result] = await client.processDocument({
          name,
          rawDocument: {
            content: documentBase64,
            mimeType: mimeType,
          },
        });

        if (!result.document) {
          throw new Error('No document found in the classification result.');
        }

        const document: Document = result.document as Document;

        // Assuming classification results are available in the document's entities or properties
        const classifications = document.entities?.filter(entity => entity.type === 'document_type')
          .map(entity => ({
            type: entity.mentionText || '',
            confidence: entity.confidence || 0,
          })) || [];

        return {
          classifications,
          document: document as any,
        };
      } catch (error: any) {
        console.error('Error classifying document:', error);
        throw new Error(`Failed to classify document: ${error.message}`);
      }
    },

    extractEntities: async (
      request: ExtractEntitiesRequestType
    ): Promise<ExtractEntitiesResponseType> => {
      try {
        const { projectId, location, processorId, documentBase64, mimeType } = request;

        const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

        const [result] = await client.processDocument({
          name,
          rawDocument: {
            content: documentBase64,
            mimeType: mimeType,
          },
        });

        if (!result.document) {
          throw new Error('No document found in the entity extraction result.');
        }

        const document: Document = result.document as Document;

        const entities = document.entities?.map(entity => ({
          type: entity.type || '',
          mentionText: entity.mentionText || '',
          confidence: entity.confidence || 0,
          normalizedValue: entity.normalizedValue?.text || '',
          pageAnchor: entity.pageAnchor?.pageRefs?.map(ref => ({
            pageNumber: ref.page || 0,
            boundingBox: ref.boundingBox?.vertices?.map(v => ({ x: v.x || 0, y: v.y || 0 })) || [],
          })) || [],
        })) || [];

        return {
          entities,
          document: document as any,
        };
      } catch (error: any) {
        console.error('Error extracting entities:', error);
        throw new Error(`Failed to extract entities: ${error.message}`);
      }
    },
  };

  pluginManager.registerPlugin(documentAiPlugin);
}