/**
 * Workflow Templates
 * 
 * Pre-built tool chains for common preprocessing tasks.
 * Helps agents discover and execute multi-step workflows.
 */

export interface WorkflowStep {
  toolName: string;
  description: string;
  inputMapping?: Record<string, string>; // Map previous step outputs to this step's inputs
  optional?: boolean;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  steps: WorkflowStep[];
  estimatedDuration?: string;
  complexity: 'simple' | 'medium' | 'complex';
  useCase: string;
  example?: {
    input: Record<string, unknown>;
    expectedOutput: string;
  };
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'document_analysis',
    name: 'Complete Document Analysis',
    description: 'Full document processing pipeline: OCR, entity extraction, sentiment analysis, and summarization',
    category: 'document',
    tags: ['document', 'nlp', 'ocr', 'analysis'],
    complexity: 'complex',
    useCase: 'Process scanned documents or PDFs to extract structured information',
    steps: [
      {
        toolName: 'format.ocr',
        description: 'Extract text from scanned documents or images',
      },
      {
        toolName: 'nlp.extract_entities',
        description: 'Identify people, organizations, locations, dates',
        inputMapping: { text: 'step1.text' },
      },
      {
        toolName: 'nlp.analyze_sentiment',
        description: 'Determine overall sentiment and tone',
        inputMapping: { text: 'step1.text' },
      },
      {
        toolName: 'summarize.hierarchical',
        description: 'Generate multi-level summary',
        inputMapping: { text: 'step1.text' },
      },
    ],
    estimatedDuration: '2-5 minutes',
    example: {
      input: { file: 'contract.pdf' },
      expectedOutput: 'Structured JSON with entities, sentiment, and summary',
    },
  },
  {
    id: 'forensic_chat_analysis',
    name: 'Forensic Chat Analysis',
    description: 'Analyze chat conversations for manipulation patterns, severity scoring, and evidence chains',
    category: 'forensics',
    tags: ['forensics', 'chat', 'analysis', 'evidence'],
    complexity: 'complex',
    useCase: 'Analyze chat logs for abusive patterns, gaslighting, and create forensic evidence',
    steps: [
      {
        toolName: 'forensics.analyze_patterns',
        description: 'Detect manipulation patterns (gaslighting, isolation, etc.)',
      },
      {
        toolName: 'forensics.score_severity',
        description: 'Calculate severity score based on detected patterns',
        inputMapping: { text: 'step1.text' },
      },
      {
        toolName: 'forensics.detect_hurtlex',
        description: 'Identify offensive and harmful language',
        inputMapping: { text: 'step1.text' },
      },
      {
        toolName: 'evidence.create_chain',
        description: 'Create tamper-proof evidence chain with timestamps',
        inputMapping: { content: 'step1.text' },
      },
    ],
    estimatedDuration: '1-3 minutes',
    example: {
      input: { text: 'Chat conversation text' },
      expectedOutput: 'Forensic report with patterns, severity, and evidence chain',
    },
  },
  {
    id: 'semantic_search_prep',
    name: 'Semantic Search Preparation',
    description: 'Prepare documents for semantic search: chunk, embed, and index in vector database',
    category: 'ml',
    tags: ['embeddings', 'vector', 'search', 'ml'],
    complexity: 'medium',
    useCase: 'Prepare large documents for semantic search and RAG applications',
    steps: [
      {
        toolName: 'document.chunk',
        description: 'Split document into semantic chunks',
      },
      {
        toolName: 'ml.embed',
        description: 'Generate embeddings for each chunk',
        inputMapping: { chunks: 'step1.chunks' },
      },
      {
        toolName: 'vector.store',
        description: 'Store embeddings in vector database',
        inputMapping: { vectors: 'step2.embeddings' },
      },
    ],
    estimatedDuration: '1-2 minutes',
    example: {
      input: { file: 'research_paper.pdf' },
      expectedOutput: 'Vector database collection ready for semantic search',
    },
  },
  {
    id: 'data_extraction_pipeline',
    name: 'Data Extraction & Schema Mapping',
    description: 'Extract structured data from documents and map to target schema',
    category: 'document',
    tags: ['extraction', 'schema', 'data', 'mapping'],
    complexity: 'medium',
    useCase: 'Extract structured data from unstructured documents and normalize to target schema',
    steps: [
      {
        toolName: 'format.parse',
        description: 'Parse document structure',
      },
      {
        toolName: 'nlp.extract_entities',
        description: 'Extract named entities',
        inputMapping: { text: 'step1.content' },
      },
      {
        toolName: 'schema.resolve',
        description: 'Map extracted fields to target schema',
        inputMapping: { sourceFields: 'step2.entities' },
      },
      {
        toolName: 'schema.apply',
        description: 'Apply schema transformation',
        inputMapping: { data: 'step2.entities', mappings: 'step3.mappings' },
      },
    ],
    estimatedDuration: '30 seconds - 1 minute',
    example: {
      input: { file: 'invoice.pdf', targetSchema: 'standard_invoice' },
      expectedOutput: 'Structured JSON matching target schema',
    },
  },
  {
    id: 'text_mining_workflow',
    name: 'Text Mining & Keyword Extraction',
    description: 'Mine text for keywords, patterns, and insights',
    category: 'nlp',
    tags: ['text-mining', 'keywords', 'nlp', 'analysis'],
    complexity: 'simple',
    useCase: 'Extract key themes, topics, and patterns from text collections',
    steps: [
      {
        toolName: 'text.mine',
        description: 'Mine text for patterns and keywords',
      },
      {
        toolName: 'nlp.extract_keywords',
        description: 'Extract ranked keywords',
        inputMapping: { text: 'step1.text' },
      },
      {
        toolName: 'nlp.extract_sentences',
        description: 'Extract key sentences',
        inputMapping: { text: 'step1.text' },
      },
    ],
    estimatedDuration: '30 seconds',
    example: {
      input: { files: ['doc1.txt', 'doc2.txt'] },
      expectedOutput: 'Ranked keywords and key sentences',
    },
  },
  {
    id: 'format_conversion_chain',
    name: 'Multi-Format Conversion',
    description: 'Convert documents through multiple formats with validation',
    category: 'document',
    tags: ['conversion', 'format', 'validation'],
    complexity: 'simple',
    useCase: 'Convert documents between formats with schema validation',
    steps: [
      {
        toolName: 'format.convert',
        description: 'Convert to intermediate format',
      },
      {
        toolName: 'format.check_schema',
        description: 'Validate converted format',
        inputMapping: { data: 'step1.output' },
      },
      {
        toolName: 'format.convert',
        description: 'Convert to final format',
        inputMapping: { input: 'step1.output' },
      },
    ],
    estimatedDuration: '10-30 seconds',
    example: {
      input: { file: 'data.csv', targetFormat: 'json' },
      expectedOutput: 'Validated JSON output',
    },
  },
];

/**
 * Semantic routing - match user intent to best tool
 */
export interface SemanticRoute {
  intent: string;
  keywords: string[];
  recommendedTool: string;
  alternativeTools?: string[];
  workflow?: string; // Reference to workflow template ID
}

export const SEMANTIC_ROUTES: SemanticRoute[] = [
  {
    intent: 'analyze_chat_conversation',
    keywords: ['chat', 'conversation', 'messages', 'abuse', 'manipulation', 'gaslighting'],
    recommendedTool: 'forensics.analyze_patterns',
    workflow: 'forensic_chat_analysis',
  },
  {
    intent: 'extract_text_from_image',
    keywords: ['ocr', 'scan', 'image', 'photo', 'screenshot', 'extract text'],
    recommendedTool: 'format.ocr',
    workflow: 'document_analysis',
  },
  {
    intent: 'find_entities',
    keywords: ['entities', 'names', 'people', 'organizations', 'locations', 'dates'],
    recommendedTool: 'nlp.extract_entities',
    alternativeTools: ['forensics.analyze_patterns'],
  },
  {
    intent: 'summarize_document',
    keywords: ['summarize', 'summary', 'tldr', 'brief', 'overview'],
    recommendedTool: 'summarize.hierarchical',
    alternativeTools: ['summarize.map_reduce'],
  },
  {
    intent: 'semantic_search',
    keywords: ['search', 'find similar', 'semantic', 'embeddings', 'vector'],
    recommendedTool: 'ml.embed',
    workflow: 'semantic_search_prep',
  },
  {
    intent: 'convert_format',
    keywords: ['convert', 'transform', 'format', 'parse', 'export'],
    recommendedTool: 'format.convert',
    workflow: 'format_conversion_chain',
  },
  {
    intent: 'extract_keywords',
    keywords: ['keywords', 'topics', 'themes', 'mine', 'extract'],
    recommendedTool: 'nlp.extract_keywords',
    workflow: 'text_mining_workflow',
  },
  {
    intent: 'map_schema',
    keywords: ['schema', 'map', 'transform', 'normalize', 'standardize'],
    recommendedTool: 'schema.resolve',
    workflow: 'data_extraction_pipeline',
  },
  {
    intent: 'create_evidence',
    keywords: ['evidence', 'chain of custody', 'forensic', 'tamper-proof', 'hash'],
    recommendedTool: 'evidence.create_chain',
    alternativeTools: ['evidence.hash_file', 'evidence.hash_content'],
  },
];
