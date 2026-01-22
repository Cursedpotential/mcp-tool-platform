# LiteLLM Proxy

**NAME**
litellm-proxy - Universal LLM proxy for multi-provider AI integration

**SYNOPSIS**
LiteLLM provides unified API access to 75+ LLM providers with cost tracking, load balancing, and automatic failover for the forensic analysis platform.

**DESCRIPTION**
LiteLLM is the central AI infrastructure component that provides unified access to multiple language model providers. It handles authentication, rate limiting, cost tracking, and intelligent routing for optimal performance and cost efficiency.

**CORE FEATURES**

**Multi-Provider Support**
Unified interface to diverse LLM ecosystems.

    **Supported Providers:**
    - **OpenAI**: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo
    - **Anthropic**: Claude Opus, Sonnet, Haiku (all versions)
    - **Google**: Gemini Pro, Gemini Ultra, PaLM
    - **Meta**: Llama 3.1, Llama 2, Code Llama
    - **Mistral**: Mixtral, Mistral 7B/8x7B
    - **Cohere**: Command R, Base models
    - **HuggingFace**: 50,000+ open-source models
    - **Together AI**: Optimized inference endpoints
    - **Replicate**: Custom model hosting
    - **Azure OpenAI**: Enterprise deployments
    - **Vertex AI**: Google Cloud AI Platform
    - **AWS Bedrock**: Amazon Q, Titan models

**Unified API Interface**
Single API endpoint for all providers.

    **API Compatibility:**
    ```typescript
    // Same interface for all providers
    const response = await litellm.chat.completions.create({
      model: 'gpt-4o',          // OpenAI
      model: 'claude-opus-4',   // Anthropic
      model: 'gemini-pro',      // Google
      model: 'llama-3.1-70b',   // Meta
      messages: [...],
      temperature: 0.7
    });
    ```

**Cost Tracking & Optimization**
Real-time cost monitoring and budget management.

    **Cost Features:**
    - **Per-Request Tracking**: Cost per API call
    - **Provider Comparison**: Cost analysis across providers
    - **Budget Alerts**: Configurable spending limits
    - **Usage Analytics**: Token consumption reporting
    - **Cost Optimization**: Automatic cheapest provider selection

**Intelligent Routing**
Smart provider selection based on multiple criteria.

    **Routing Logic:**
    - **Cost-Based**: Cheapest suitable model
    - **Speed-Based**: Fastest response time
    - **Quality-Based**: Highest capability model
    - **Availability-Based**: Provider health monitoring
    - **Geographic**: Closest data center routing

**Rate Limiting & Fair Use**
Prevents API quota exhaustion and ensures fair access.

    **Rate Limit Features:**
    - **Per-User Limits**: Individual user quotas
    - **Per-Provider Limits**: Provider-specific rate limits
    - **Burst Handling**: Temporary limit increases
    - **Queue Management**: Request queuing during limits
    - **Automatic Retry**: Intelligent backoff strategies

**ARCHITECTURE**

**Proxy Layers**
Multi-layered architecture for reliability and performance.

    **Layer Structure:**
    ```
    Client Request → Authentication Layer
         ↓
    Rate Limiting → Provider Selection
         ↓
    Request Transformation → API Call
         ↓
    Response Processing → Cost Tracking
         ↓
    Response Caching → Client Response
    ```

**Provider Abstraction**
Unified provider interface with automatic adaptation.

    **Abstraction Features:**
    - **Parameter Mapping**: Provider-specific parameter conversion
    - **Response Normalization**: Consistent response formats
    - **Error Handling**: Provider-specific error translation
    - **Capability Detection**: Automatic feature detection
    - **Version Management**: API version compatibility

**Caching System**
Redis-backed caching for performance optimization.

    **Caching Strategies:**
    - **Response Caching**: Identical request deduplication
    - **Embedding Caching**: Vector embedding reuse
    - **Token Caching**: Authentication token management
    - **Metadata Caching**: Provider capability information
    - **Cost Caching**: Pricing information updates

**DATA STRUCTURES**

**ChatCompletionRequest**
Unified chat completion request format.

    ```typescript
    interface ChatCompletionRequest {
      model: string;                       // Model identifier (provider/model)
      messages: ChatMessage[];             // Conversation messages
      temperature?: number;                // Creativity level (0.0-2.0)
      max_tokens?: number;                 // Maximum response tokens
      top_p?: number;                      // Nucleus sampling
      frequency_penalty?: number;          // Repetition penalty
      presence_penalty?: number;           // Topic diversity penalty
      stop?: string[];                     // Stop sequences
      stream?: boolean;                    // Streaming response
      user?: string;                       // User identifier
      metadata?: Record<string, any>;      // Custom metadata
    }
    ```

**ProviderConfig**
Configuration for each LLM provider.

    ```typescript
    interface ProviderConfig {
      name: string;                        // Provider identifier
      api_key: string;                     // Authentication key
      base_url?: string;                   // Custom API endpoint
      models: string[];                    // Supported models
      rate_limits: RateLimitConfig;        // Rate limiting settings
      cost_per_token: Record<string, number>; // Pricing information
      capabilities: ProviderCapabilities;  // Supported features
      retry_config: RetryConfig;           // Error handling settings
      timeout: number;                     // Request timeout (ms)
    }
    ```

**CostTracking**
Real-time cost monitoring and analytics.

    ```typescript
    interface CostTracking {
      request_id: string;                  // Unique request identifier
      user_id: string;                     // User making request
      provider: string;                    // LLM provider used
      model: string;                       // Specific model used
      tokens_prompt: number;               // Input token count
      tokens_completion: number;           // Output token count
      cost: number;                        // Total request cost
      timestamp: Date;                     // Request timestamp
      success: boolean;                    // Request success status
      error_message?: string;              // Error details if failed
    }
    ```

**RateLimitInfo**
Current rate limit status for providers.

    ```typescript
    interface RateLimitInfo {
      provider: string;                    // Provider name
      requests_remaining: number;          // Remaining requests
      requests_reset_time: Date;           // Reset timestamp
      tokens_remaining: number;            // Remaining tokens
      tokens_reset_time: Date;             // Token reset timestamp
      retry_after?: number;                // Wait time for retry
    }
    ```

**API ENDPOINTS**

**POST /v1/chat/completions**
Main chat completion endpoint.

    **Request Body:**
    ```json
    {
      "model": "gpt-4o",
      "messages": [
        {"role": "user", "content": "Analyze this forensic evidence"}
      ],
      "temperature": 0.7,
      "max_tokens": 1000,
      "stream": false
    }
    ```

    **Response:**
    ```json
    {
      "id": "chatcmpl-123",
      "object": "chat.completion",
      "created": 1677652288,
      "model": "gpt-4o",
      "choices": [{
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "Analysis complete..."
        },
        "finish_reason": "stop"
      }],
      "usage": {
        "prompt_tokens": 56,
        "completion_tokens": 123,
        "total_tokens": 179
      }
    }
    ```

**POST /v1/embeddings**
Text embedding generation endpoint.

    **Request Body:**
    ```json
    {
      "model": "text-embedding-ada-002",
      "input": ["Analyze this document", "Extract entities"],
      "user": "forensic-user"
    }
    ```

**GET /health**
Health check endpoint.

    **Response:**
    ```json
    {
      "status": "healthy",
      "version": "1.0.0",
      "providers": {
        "openai": "healthy",
        "anthropic": "healthy",
        "google": "healthy"
      }
    }
    ```

**GET /costs**
Cost tracking and analytics endpoint.

    **Response:**
    ```json
    {
      "total_cost": 45.67,
      "costs_by_provider": {
        "openai": 23.45,
        "anthropic": 15.22,
        "google": 7.00
      },
      "costs_by_user": {
        "user1": 12.34,
        "user2": 33.33
      },
      "period": "2026-01"
    }
    ```

**PROVIDER MANAGEMENT**

**Provider Registration**
Dynamic provider addition and configuration.

    **Registration Process:**
    1. **Provider Discovery**: Automatic provider detection
    2. **Capability Assessment**: Feature and model enumeration
    3. **Authentication Setup**: API key configuration
    4. **Rate Limit Configuration**: Quota setting
    5. **Cost Integration**: Pricing data loading

**Health Monitoring**
Continuous provider availability tracking.

    **Health Checks:**
    - **Connectivity**: API endpoint reachability
    - **Authentication**: API key validity
    - **Rate Limits**: Quota availability
    - **Response Time**: Performance monitoring
    - **Error Rates**: Failure analysis

**Failover Management**
Automatic switching between providers.

    **Failover Strategy:**
    - **Primary Failure**: Switch to backup provider
    - **Rate Limit Hit**: Queue and retry with alternative
    - **Timeout**: Fallback to faster provider
    - **Cost Threshold**: Switch to cheaper alternative
    - **Geographic Issues**: Route to different region

**COST OPTIMIZATION**

**Dynamic Pricing**
Real-time cost tracking and optimization.

    **Optimization Features:**
    - **Provider Comparison**: Cost analysis across all providers
    - **Model Selection**: Cheapest suitable model recommendation
    - **Batch Processing**: Multi-request cost optimization
    - **Usage Patterns**: Learning optimal provider selection
    - **Budget Management**: Spending limit enforcement

**Cost Analytics**
Detailed usage and cost reporting.

    **Analytics Features:**
    - **Real-time Tracking**: Live cost monitoring
    - **Historical Analysis**: Usage pattern identification
    - **User Attribution**: Cost allocation by user
    - **Project Tracking**: Cost breakdown by use case
    - **Optimization Recommendations**: Cost-saving suggestions

**SECURITY FEATURES**

**API Key Management**
Secure key storage and rotation.

    **Key Security:**
    - **Encryption**: AES-256 key encryption at rest
    - **Rotation**: Automatic key rotation scheduling
    - **Access Control**: User-specific key permissions
    - **Audit Logging**: Key usage tracking
    - **Revocation**: Immediate key invalidation

**Request Validation**
Comprehensive input validation and sanitization.

    **Validation Features:**
    - **Schema Validation**: Request structure verification
    - **Content Filtering**: Malicious content detection
    - **Rate Limiting**: Per-user and per-endpoint limits
    - **Input Sanitization**: XSS and injection prevention
    - **Size Limits**: Request payload size restrictions

**Audit Logging**
Complete request and response logging.

    **Logging Features:**
    - **Request Tracking**: All API calls logged
    - **Response Monitoring**: Output content tracking
    - **Error Analysis**: Failure pattern identification
    - **Performance Metrics**: Latency and throughput tracking
    - **Compliance**: Legal and regulatory logging

**PERFORMANCE OPTIMIZATION**

**Response Caching**
Intelligent caching for repeated requests.

    **Caching Strategy:**
    - **Exact Match**: Identical request caching
    - **Semantic Similarity**: Similar request detection
    - **Time-based Expiration**: Configurable cache lifetimes
    - **Size-based Limits**: Memory usage control
    - **Hit Rate Optimization**: Cache effectiveness monitoring

**Request Batching**
Multiple request optimization.

    **Batching Features:**
    - **Automatic Grouping**: Similar request aggregation
    - **Parallel Processing**: Concurrent request handling
    - **Result Deduplication**: Identical response reuse
    - **Load Distribution**: Balanced provider utilization
    - **Timeout Management**: Batch-level timeout handling

**Connection Pooling**
Efficient provider connection management.

    **Pooling Features:**
    - **Persistent Connections**: Keep-alive connection reuse
    - **Connection Limits**: Per-provider connection caps
    - **Health Monitoring**: Connection quality tracking
    - **Automatic Recovery**: Failed connection restoration
    - **Load Balancing**: Connection distribution optimization

**CONFIGURATION EXAMPLES**

**Production Configuration**
```yaml
general_settings:
master_key: "your_master_key_here"
database_url: "postgresql://user:pass@postgres:5432/litellm"

    litellm_settings:
      cache: true
      cache_type: redis
      redis_host: redis
      redis_port: 6379
      redis_password: ${REDIS_PASSWORD}

      # Cost tracking
      store_prompts_in_spend_logs: true
      custom_pricing: true

      # Performance
      request_timeout: 600
      max_retries: 3
      num_retries_on_timeout: 2
    ```

**Provider Configuration**
```yaml
model_list: # OpenAI Models - model_name: gpt-4o
litellm_params:
model: openai/gpt-4o
api_key: ${OPENAI_API_KEY}
model_info:
cost_per_token:
input_cost_per_token: 0.000005
output_cost_per_token: 0.000015

      # Anthropic Models
      - model_name: claude-opus-4
        litellm_params:
          model: anthropic/claude-opus-4-20250514
          api_key: ${ANTHROPIC_API_KEY}
        model_info:
          cost_per_token:
            input_cost_per_token: 0.000015
            output_cost_per_token: 0.000075
    ```

**SEE ALSO**
smart-router(7), mcp-gateway(7), workflow-message-processing(7)

**AUTHOR**
Claude Code - Opus 4.1

**VERSION**
1.0.0

**DATE**
January 11, 2026
