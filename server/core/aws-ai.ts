/**
 * AWS AI Services Integration
 *
 * Wrappers for:
 * - Rekognition (face detection, object recognition, text in images)
 * - Comprehend (sentiment analysis, entity extraction, PII detection)
 * - Textract (document OCR, form extraction)
 */

import {
  RekognitionClient,
  DetectFacesCommand,
  DetectLabelsCommand,
  DetectTextCommand
} from "@aws-sdk/client-rekognition";
import {
  ComprehendClient,
  DetectSentimentCommand,
  DetectEntitiesCommand,
  DetectPiiEntitiesCommand
} from "@aws-sdk/client-comprehend";
import {
  TextractClient,
  AnalyzeDocumentCommand,
  DetectDocumentTextCommand
} from "@aws-sdk/client-textract";

// ============================================================================
// AWS Clients
// ============================================================================

const region = process.env.AWS_REGION || "us-east-1";
// Credentials are automatically loaded from env vars:
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
const rekognitionClient = new RekognitionClient({ region });
const comprehendClient = new ComprehendClient({ region });
const textractClient = new TextractClient({ region });

// ============================================================================
// Rekognition - Image Analysis
// ============================================================================

export interface RekognitionFaceResult {
  boundingBox: { left: number; top: number; width: number; height: number };
  confidence: number;
  emotions: Array<{ type: string; confidence: number }>;
  ageRange: { low: number; high: number };
  gender: { value: string; confidence: number };
}

export interface RekognitionLabelResult {
  name: string;
  confidence: number;
  instances: Array<{ boundingBox: any; confidence: number }>;
  parents: Array<{ name: string }>;
}

export interface RekognitionTextResult {
  detectedText: string;
  type: "LINE" | "WORD";
  confidence: number;
  boundingBox: { left: number; top: number; width: number; height: number };
}

/**
 * Detect faces in image
 */
export async function detectFaces(
  imageBytes: Buffer
): Promise<RekognitionFaceResult[]> {
  try {
    const command = new DetectFacesCommand({
      Image: { Bytes: imageBytes },
      Attributes: ["ALL"],
    });

    const response = await rekognitionClient.send(command);

    if (!response.FaceDetails) return [];

    return response.FaceDetails.map((face) => ({
      boundingBox: {
        left: face.BoundingBox?.Left || 0,
        top: face.BoundingBox?.Top || 0,
        width: face.BoundingBox?.Width || 0,
        height: face.BoundingBox?.Height || 0,
      },
      confidence: face.Confidence || 0,
      emotions: (face.Emotions || []).map((e) => ({
        type: e.Type || "UNKNOWN",
        confidence: e.Confidence || 0,
      })),
      ageRange: {
        low: face.AgeRange?.Low || 0,
        high: face.AgeRange?.High || 0,
      },
      gender: {
        value: face.Gender?.Value || "UNKNOWN",
        confidence: face.Gender?.Confidence || 0,
      },
    }));
  } catch (error) {
    console.error("Error in detectFaces:", error);
    return [];
  }
}

/**
 * Detect objects and scenes in image
 */
export async function detectLabels(
  imageBytes: Buffer
): Promise<RekognitionLabelResult[]> {
  try {
    const command = new DetectLabelsCommand({
      Image: { Bytes: imageBytes },
      MaxLabels: 20,
      MinConfidence: 70,
    });

    const response = await rekognitionClient.send(command);

    if (!response.Labels) return [];

    return response.Labels.map((label) => ({
      name: label.Name || "Unknown",
      confidence: label.Confidence || 0,
      instances: (label.Instances || []).map((inst) => ({
        boundingBox: inst.BoundingBox,
        confidence: inst.Confidence || 0,
      })),
      parents: (label.Parents || []).map((parent) => ({
        name: parent.Name || "",
      })),
    }));
  } catch (error) {
    console.error("Error in detectLabels:", error);
    return [];
  }
}

/**
 * Detect text in image (OCR)
 */
export async function detectTextInImage(
  imageBytes: Buffer
): Promise<RekognitionTextResult[]> {
  try {
    const command = new DetectTextCommand({
      Image: { Bytes: imageBytes },
    });

    const response = await rekognitionClient.send(command);

    if (!response.TextDetections) return [];

    return response.TextDetections.map((text) => ({
      detectedText: text.DetectedText || "",
      type: (text.Type as "LINE" | "WORD") || "WORD",
      confidence: text.Confidence || 0,
      boundingBox: {
        left: text.Geometry?.BoundingBox?.Left || 0,
        top: text.Geometry?.BoundingBox?.Top || 0,
        width: text.Geometry?.BoundingBox?.Width || 0,
        height: text.Geometry?.BoundingBox?.Height || 0,
      },
    }));
  } catch (error) {
    console.error("Error in detectTextInImage:", error);
    return [];
  }
}

// ============================================================================
// Comprehend - NLP Analysis
// ============================================================================

export interface ComprehendSentimentResult {
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED";
  sentimentScore: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
}

export interface ComprehendEntityResult {
  text: string;
  type: string;
  score: number;
  beginOffset: number;
  endOffset: number;
}

export interface ComprehendPIIResult {
  text: string;
  type: string;
  score: number;
  beginOffset: number;
  endOffset: number;
}

/**
 * Analyze sentiment of text
 */
export async function analyzeSentiment(
  text: string
): Promise<ComprehendSentimentResult> {
  try {
    const command = new DetectSentimentCommand({
      Text: text,
      LanguageCode: "en",
    });

    const response = await comprehendClient.send(command);

    return {
      sentiment: (response.Sentiment as any) || "NEUTRAL",
      sentimentScore: {
        positive: response.SentimentScore?.Positive || 0,
        negative: response.SentimentScore?.Negative || 0,
        neutral: response.SentimentScore?.Neutral || 0,
        mixed: response.SentimentScore?.Mixed || 0,
      },
    };
  } catch (error) {
    console.error("Error in analyzeSentiment:", error);
    return {
      sentiment: "NEUTRAL",
      sentimentScore: { positive: 0, negative: 0, neutral: 1, mixed: 0 },
    };
  }
}

/**
 * Extract entities from text
 */
export async function extractEntities(
  text: string
): Promise<ComprehendEntityResult[]> {
  try {
    const command = new DetectEntitiesCommand({
      Text: text,
      LanguageCode: "en",
    });

    const response = await comprehendClient.send(command);

    if (!response.Entities) return [];

    return response.Entities.map((entity) => ({
      text: entity.Text || "",
      type: entity.Type || "OTHER",
      score: entity.Score || 0,
      beginOffset: entity.BeginOffset || 0,
      endOffset: entity.EndOffset || 0,
    }));
  } catch (error) {
    console.error("Error in extractEntities:", error);
    return [];
  }
}

/**
 * Detect PII
 */
export async function detectPII(text: string): Promise<ComprehendPIIResult[]> {
  try {
    const command = new DetectPiiEntitiesCommand({
      Text: text,
      LanguageCode: "en",
    });

    const response = await comprehendClient.send(command);

    if (!response.Entities) return [];

    // DetectPiiEntities returns slightly different structure, need to map carefully
    // PiiEntity doesn't have Text directly, acts on offsets
    // We'll reconstruct text slice for convenience
    return response.Entities.map((entity) => ({
      text: text.substring(entity.BeginOffset || 0, entity.EndOffset || 0),
      type: entity.Type || "OTHER",
      score: entity.Score || 0,
      beginOffset: entity.BeginOffset || 0,
      endOffset: entity.EndOffset || 0,
    }));
  } catch (error) {
    console.error("Error in detectPII:", error);
    return [];
  }
}

// ============================================================================
// Textract - Document OCR
// ============================================================================

export interface TextractDocumentResult {
  text: string;
  blocks: Array<{
    type: string;
    text?: string;
    confidence: number;
    boundingBox: { left: number; top: number; width: number; height: number };
    relationships?: Array<{ type: string; ids: string[] }>;
  }>;
  tables?: Array<{
    rows: number;
    columns: number;
    cells: Array<{ row: number; column: number; text: string }>;
  }>;
  forms?: Array<{
    key: string;
    value: string;
    confidence: number;
  }>;
}

/**
 * Extract text from document (simple OCR)
 */
export async function extractDocumentText(
  documentBytes: Buffer
): Promise<string> {
  try {
    const command = new DetectDocumentTextCommand({
      Document: { Bytes: documentBytes },
    });

    const response = await textractClient.send(command);

    // Concatenate detected text blocks (LINEs)
    if (!response.Blocks) return "";

    return response.Blocks
      .filter((b) => b.BlockType === "LINE")
      .map((b) => b.Text)
      .join("\n");

  } catch (error) {
    console.error("Error in extractDocumentText:", error);
    return "";
  }
}

/**
 * Analyze document structure
 */
export async function analyzeDocument(
  documentBytes: Buffer
): Promise<TextractDocumentResult> {
  try {
    const command = new AnalyzeDocumentCommand({
      Document: { Bytes: documentBytes },
      FeatureTypes: ["TABLES", "FORMS"],
    });

    const response = await textractClient.send(command);

    if (!response.Blocks) {
      return { text: "", blocks: [] };
    }

    const text = response.Blocks
      .filter((b) => b.BlockType === "LINE")
      .map((b) => b.Text)
      .join("\n");

    const blocks = response.Blocks.map((b) => ({
      type: b.BlockType || "UNKNOWN",
      text: b.Text,
      confidence: b.Confidence || 0,
      boundingBox: {
        left: b.Geometry?.BoundingBox?.Left || 0,
        top: b.Geometry?.BoundingBox?.Top || 0,
        width: b.Geometry?.BoundingBox?.Width || 0,
        height: b.Geometry?.BoundingBox?.Height || 0,
      },
      relationships: (b.Relationships || []).map((r) => ({
        type: r.Type || "",
        ids: r.Ids || [],
      })),
    }));

    // Basic table/form parsing logic omitted for brevity in this single file, 
    // but the blocks are returned for downstream processing.
    return {
      text,
      blocks,
      tables: [], // Would implement complex parsing logic here
      forms: [], // Would implement complex parsing logic here
    };

  } catch (error) {
    console.error("Error in analyzeDocument:", error);
    return { text: "", blocks: [] };
  }
}

// ============================================================================
// Combined Analysis Pipeline
// ============================================================================

export interface ScreenshotAnalysisResult {
  text: string;
  faces: RekognitionFaceResult[];
  objects: RekognitionLabelResult[];
  sentiment: ComprehendSentimentResult;
  entities: ComprehendEntityResult[];
  pii: ComprehendPIIResult[];
}

/**
 * Complete screenshot analysis pipeline
 */
export async function analyzeScreenshot(
  imageBytes: Buffer
): Promise<ScreenshotAnalysisResult> {
  // Parallel execution for speed
  const [textResults, faceResults, labelResults] = await Promise.all([
    detectTextInImage(imageBytes),
    detectFaces(imageBytes),
    detectLabels(imageBytes),
  ]);

  const fullText = textResults.map(t => t.detectedText).join(" ");

  // Analyse text if found
  let sentimentResult: ComprehendSentimentResult = {
    sentiment: "NEUTRAL",
    sentimentScore: { positive: 0, negative: 0, neutral: 1, mixed: 0 }
  };
  let entityResults: ComprehendEntityResult[] = [];
  let piiResults: ComprehendPIIResult[] = [];

  if (fullText.trim().length > 0) {
    [sentimentResult, entityResults, piiResults] = await Promise.all([
      analyzeSentiment(fullText),
      extractEntities(fullText),
      detectPII(fullText)
    ]);
  }

  return {
    text: fullText,
    faces: faceResults,
    objects: labelResults,
    sentiment: sentimentResult,
    entities: entityResults,
    pii: piiResults,
  };
}

// ============================================================================
// Exports
// ============================================================================

export const awsAI = {
  detectFaces,
  detectLabels,
  detectTextInImage,
  analyzeSentiment,
  extractEntities,
  detectPII,
  extractDocumentText,
  analyzeDocument,
  analyzeScreenshot,
};
