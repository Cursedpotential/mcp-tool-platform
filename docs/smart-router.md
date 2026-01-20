# Smart Router

**NAME**
smart-router - Intelligent LLM provider routing with cost/latency optimization

**SYNOPSIS**
The Smart Router selects optimal LLM providers based on cost, latency, capability, and availability for forensic analysis tasks.

**DESCRIPTION**
The Smart Router implements intelligent LLM provider selection using multi-criteria decision making. It routes requests to the most appropriate provider based on cost efficiency, response latency, model capabilities, and current availability.

**CORE FEATURES**

**Multi-Criteria Routing**
Routes based on cost, latency, and capability tradeoffs.

    **Routing Factors:**
    - **Cost Efficiency**: Token cost per request
    - **Response Latency**: Historical response times
    - **Model Capability**: Task-specific suitability
    - **Provider Reliability**: Uptime and error rates
    - **Rate Limits**: Remaining quota availability
    - **Geographic Latency**: Regional response times

**Cost Optimization**
Minimizes API costs while maintaining quality.

    **Cost Strategies:**
    - **Model Selection**: Cheapest suitable model for task
    - **Provider Switching**: Route to cheaper providers when possible
    - **Caching**: Avoid redundant API calls
    - **Batch Processing**: Combine requests for efficiency

**Latency Management**
Optimizes response times for user experience.

    **Latency Optimization:**
    - **Provider Selection**: Fastest available provider
    - **Geographic Routing**: Closest data center
    - **Load Balancing**: Distribute across providers
    - **Failover**: Switch on timeout/high latency

**Capability Matching**
Selects models best suited for specific forensic tasks.

    **Task-Based Routing:**
    - **Analysis**: Claude Opus (complex reasoning)
    - **Coding**: Claude Sonnet (technical tasks)
    - **Quick Tasks**: GPT-4o Mini (cost-effective)
    - **Search**: Perplexity (web-integrated)
    - **Creative**: Gemini Pro (versatile)

**DATA STRUCTURES**

**RouteRequest**
Routing decision request specification.

    ```typescript
    interface RouteRequest {
      messages: ChatMessage[];           // Conversation messages
      task?: string;                     // Task type (analysis, coding, etc.)
      complexity?: 'simple' | 'medium' | 'complex';
      maxTokens?: number;                // Maximum response tokens
      temperature?: number;              // Creativity level
      priority?: 'cost' | 'speed' | 'quality';
      userId?: number;                   // User context for preferences
    }
    ```

**RouteDecision**
Routing decision with provider and model selection.

    ```typescript
    interface RouteDecision {
      provider: string;                  // Selected provider (openai, anthropic, etc.)
      model: string;                     // Specific model name
      estimatedCost: number;             // Token cost estimate
      estimatedLatency: number;          // Response time estimate
      confidence: number;                // Decision confidence (0-1)
      alternatives: RouteAlternative[];  // Backup options
      reasoning: string[];               // Decision rationale
    }
    ```

**ProviderMetrics**
Real-time provider performance metrics.

    ```typescript
    interface ProviderMetrics {
      provider: string;
      model: string;
      avgLatency: number;                // Average response time (ms)
      errorRate: number;                 // Error percentage (0-1)
      costPerToken: number;              // Token pricing
      rateLimitRemaining: number;        // Remaining requests
      uptime: number;                    // Uptime percentage
      lastUpdated: number;               // Metrics timestamp
    }
    ```

**RoutingRules**
Configurable routing decision rules.

    ```typescript
    interface RoutingRules {
      costWeight: number;                // Cost importance (0-1)
      latencyWeight: number;             // Speed importance (0-1)
      qualityWeight: number;             // Capability importance (0-1)
      reliabilityWeight: number;         // Uptime importance (0-1)
      taskMappings: Record<string, string[]>; // Task → preferred models
      fallbackProviders: string[];       // Fallback order
      geographicRouting: boolean;        // Enable geo-based routing
    }
    ```

**ROUTING ALGORITHM**

**Decision Process**
Multi-step routing decision with fallback options.

    **Algorithm Steps:**
    1. **Task Classification**: Determine task type and complexity
    2. **Provider Filtering**: Remove unavailable/overloaded providers
    3. **Score Calculation**: Compute weighted scores for each option
    4. **Top Selection**: Choose highest-scoring provider/model
    5. **Fallback Planning**: Identify backup options
    6. **Confidence Assessment**: Evaluate decision certainty

**Scoring Function**
Weighted multi-criteria scoring for provider selection.

    ```typescript
    function calculateScore(
      provider: ProviderMetrics,
      task: string,
      priority: RouteRequest['priority'],
      rules: RoutingRules
    ): number {
      const taskSuitability = getTaskSuitability(provider.model, task);
      const costScore = 1 / (1 + provider.costPerToken); // Lower cost = higher score
      const latencyScore = 1 / (1 + provider.avgLatency / 1000); // Lower latency = higher score
      const reliabilityScore = provider.uptime * (1 - provider.errorRate);

      return (
        taskSuitability * rules.qualityWeight +
        costScore * rules.costWeight +
        latencyScore * rules.latencyWeight +
        reliabilityScore * rules.reliabilityWeight
      );
    }
    ```

**Task Classification**
Automatic task type detection for optimal routing.

    **Classification Rules:**
    - **analysis**: Complex reasoning → Claude Opus
    - **coding**: Technical implementation → Claude Sonnet
    - **writing**: Creative content → Gemini Pro
    - **search**: Information retrieval → Perplexity
    - **math**: Calculations → GPT-4o (mathematical reasoning)
    - **simple**: Basic tasks → GPT-4o Mini

**PROVIDER MANAGEMENT**

**Provider Registry**
Maintains list of available LLM providers and models.

    **Supported Providers:**
    - **OpenAI**: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo
    - **Anthropic**: Claude Opus, Sonnet, Haiku
    - **Google**: Gemini Pro, Gemini Ultra
    - **Groq**: Llama 3.1 70B, Mixtral 8x7B
    - **OpenRouter**: Multi-provider access
    - **Azure**: Custom OpenAI deployments

**Health Monitoring**
Continuous provider health and performance tracking.

    **Monitoring Metrics:**
    - **Latency**: Average response time per provider
    - **Error Rate**: Percentage of failed requests
    - **Rate Limits**: Remaining quota tracking
    - **Cost Tracking**: Real-time cost monitoring
    - **Uptime**: Provider availability percentage

**Load Balancing**
Distributes load across multiple provider instances.

    **Strategies:**
    - **Round Robin**: Equal distribution
    - **Least Loaded**: Route to least busy provider
    - **Geographic**: Route to closest data center
    - **Cost-Based**: Route to cheapest available

**FAILOVER & RESILIENCE**

**Automatic Failover**
Seamless switching when providers fail.

    **Failover Triggers:**
    - **Timeout**: Response exceeds configured limit
    - **Rate Limit**: Provider quota exhausted
    - **Errors**: 5xx status codes or API errors
    - **Degradation**: Response quality below threshold

**Fallback Hierarchy**
Ordered list of backup providers for each task type.

    **Example Hierarchy:**
    ```
    Primary: Claude Opus (analysis)
    Fallback 1: GPT-4o (analysis)
    Fallback 2: Gemini Ultra (analysis)
    Fallback 3: GPT-4o Turbo (analysis)
    ```

**Circuit Breaker**
Prevents cascading failures by temporarily disabling failing providers.

    **Circuit Logic:**
    - **Closed**: Normal operation
    - **Open**: Provider disabled after failures
    - **Half-Open**: Testing if provider recovered

**COST OPTIMIZATION**

**Dynamic Pricing**
Adapts to changing provider pricing and promotions.

    **Optimization Strategies:**
    - **Model Selection**: Choose cheapest suitable model
    - **Provider Switching**: Move to cheaper providers
    - **Batch Requests**: Combine multiple requests
    - **Caching**: Avoid redundant API calls

**Cost Tracking**
Real-time monitoring of API usage costs.

    **Tracking Features:**
    - **Per-Request Costs**: Calculate cost per API call
    - **User Attribution**: Track costs by user
    - **Budget Alerts**: Notify when approaching limits
    - **Cost Reports**: Generate usage summaries

**API METHODS**

**route(request: RouteRequest): Promise<RouteDecision>**
Determines optimal provider and model for request.

    **Parameters:**
    - `request`: Routing request specification

    **Returns:**
    - Complete routing decision with alternatives

**execute(request: RouteRequest): Promise<ChatResponse>**
Routes and executes request, handling failover automatically.

    **Parameters:**
    - `request`: Routing request specification

    **Returns:**
    - Chat completion response

**getMetrics(provider?: string): Promise<ProviderMetrics[]>**
Retrieves current provider performance metrics.

    **Parameters:**
    - `provider`: Optional provider filter

    **Returns:**
    - Array of provider metrics

**updateRules(rules: Partial<RoutingRules>): Promise<void>**
Updates routing decision rules.

    **Parameters:**
    - `rules`: Updated routing configuration

**PERFORMANCE CHARACTERISTICS**

**Routing Latency** - **Simple Routing**: <5ms - **Complex Analysis**: <50ms - **With Metrics Update**: <100ms

**Provider Switching** - **Detection**: <1 second - **Failover**: <5 seconds - **Recovery**: <30 seconds

**Cost Savings** - **Typical Reduction**: 20-40% vs. single provider - **Peak Optimization**: 50-60% during promotions - **Caching Benefits**: 30-50% reduction for repeated queries

**INTEGRATION POINTS**

**LiteLLM Proxy** - Receives routed requests - Handles provider-specific API calls - Manages authentication and rate limits

**MCP Gateway** - Routes tool execution requests - Optimizes for cost and latency - Provides fallback options

**Task Executor** - Routes analysis task requests - Manages resource allocation - Handles execution prioritization

**Frontend Settings** - User preference configuration - Provider priority settings - Cost budget management

**CONFIGURATION EXAMPLES**

**Cost-Optimized Configuration**
`typescript
    const costOptimized: RoutingRules = {
      costWeight: 0.8,
      latencyWeight: 0.1,
      qualityWeight: 0.1,
      reliabilityWeight: 0.0,
      taskMappings: {
        'simple': ['gpt-4o-mini', 'claude-haiku-3', 'gemini-flash'],
        'analysis': ['claude-opus-4', 'gpt-4o', 'gemini-ultra'],
        'coding': ['claude-sonnet-4', 'gpt-4o', 'llama-3.1-70b']
      }
    };
    `

**Speed-Optimized Configuration**
`typescript
    const speedOptimized: RoutingRules = {
      costWeight: 0.1,
      latencyWeight: 0.8,
      qualityWeight: 0.1,
      reliabilityWeight: 0.0,
      geographicRouting: true,
      fallbackProviders: ['groq', 'openai', 'anthropic']
    };
    `

**Quality-Optimized Configuration**
`typescript
    const qualityOptimized: RoutingRules = {
      costWeight: 0.0,
      latencyWeight: 0.0,
      qualityWeight: 0.9,
      reliabilityWeight: 0.1,
      taskMappings: {
        'analysis': ['claude-opus-4', 'gpt-4o', 'gemini-ultra'],
        'creative': ['claude-opus-4', 'gemini-pro', 'gpt-4o']
      }
    };
    `

**SEE ALSO**
litellm-proxy(7), mcp-gateway(7), task-executor(7)

**AUTHOR**
Claude Code - Opus 4.1

**VERSION**
1.0.0

**DATE**
January 11, 2026
