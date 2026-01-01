/**
 * Headless Browser & LLM-Optimized Search Plugin
 * 
 * Provides:
 * - Playwright-based headless browser automation
 * - LLM-optimized search via Tavily, Perplexity, SerpAPI
 * - Content extraction and screenshot capture
 */

// ============================================================================
// Configuration
// ============================================================================

interface BrowserSearchConfig {
  browser: {
    enabled: boolean;
    headless: boolean;
    timeout: number;
  };
  search: {
    tavily: {
      enabled: boolean;
      apiKey?: string;
    };
    perplexity: {
      enabled: boolean;
      apiKey?: string;
    };
    serpapi: {
      enabled: boolean;
      apiKey?: string;
    };
  };
}

const defaultConfig: BrowserSearchConfig = {
  browser: {
    enabled: true,
    headless: true,
    timeout: 30000,
  },
  search: {
    tavily: {
      enabled: false,
      apiKey: process.env.TAVILY_API_KEY,
    },
    perplexity: {
      enabled: false,
      apiKey: process.env.PERPLEXITY_API_KEY,
    },
    serpapi: {
      enabled: false,
      apiKey: process.env.SERPAPI_API_KEY,
    },
  },
};

let config: BrowserSearchConfig = { ...defaultConfig };

/**
 * Configure browser and search
 */
export function configureBrowserSearch(newConfig: Partial<BrowserSearchConfig>): void {
  config = {
    ...config,
    ...newConfig,
    browser: { ...config.browser, ...newConfig.browser },
    search: {
      tavily: { ...config.search.tavily, ...newConfig.search?.tavily },
      perplexity: { ...config.search.perplexity, ...newConfig.search?.perplexity },
      serpapi: { ...config.search.serpapi, ...newConfig.search?.serpapi },
    },
  };
}

// ============================================================================
// Types
// ============================================================================

interface PageContent {
  url: string;
  title: string;
  text: string;
  html?: string;
  links: Array<{ text: string; href: string }>;
  images: Array<{ src: string; alt: string }>;
  metadata: Record<string, string>;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  source?: string;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  answer?: string; // For Perplexity/Tavily synthesized answers
  citations?: string[];
  provider: string;
}

// ============================================================================
// Headless Browser Operations
// ============================================================================

// Note: In production, use actual Playwright. This is a fetch-based fallback.

/**
 * Navigate to a URL and get page content
 */
export async function navigate(args: {
  url: string;
  waitFor?: string; // CSS selector to wait for
  timeout?: number;
  javascript?: boolean;
}): Promise<{ content: PageContent }> {
  const timeout = args.timeout || config.browser.timeout;
  
  // For JavaScript-rendered pages, would use Playwright
  // This is a basic fetch fallback
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(args.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MCPToolShop/1.0)',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // Basic HTML parsing (in production, use cheerio or JSDOM)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1] || '';
    
    // Extract text content (simplified)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract links
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    const links: Array<{ text: string; href: string }> = [];
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      links.push({ href: linkMatch[1], text: linkMatch[2].trim() });
    }
    
    // Extract images
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
    const images: Array<{ src: string; alt: string }> = [];
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      images.push({ src: imgMatch[1], alt: imgMatch[2] || '' });
    }
    
    // Extract meta tags
    const metaRegex = /<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
    const metadata: Record<string, string> = {};
    let metaMatch;
    while ((metaMatch = metaRegex.exec(html)) !== null) {
      metadata[metaMatch[1]] = metaMatch[2];
    }
    
    return {
      content: {
        url: args.url,
        title,
        text: text.slice(0, 50000), // Limit text size
        html: args.javascript ? html : undefined,
        links: links.slice(0, 100),
        images: images.slice(0, 50),
        metadata,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Take a screenshot of a page
 */
export async function screenshot(args: {
  url: string;
  fullPage?: boolean;
  selector?: string;
  format?: 'png' | 'jpeg';
  quality?: number;
}): Promise<{ screenshot: string; format: string }> {
  // In production, use Playwright
  // This returns a placeholder indicating the feature requires Playwright
  throw new Error('Screenshot requires Playwright browser. Configure browser.enabled and ensure Playwright is installed.');
}

/**
 * Extract structured content from a page
 */
export async function extractContent(args: {
  url: string;
  selectors?: Record<string, string>; // name -> CSS selector
  format?: 'text' | 'html' | 'markdown';
}): Promise<{ extracted: Record<string, string | string[]> }> {
  const { content } = await navigate({ url: args.url });
  
  // Without Playwright, return basic extracted content
  const extracted: Record<string, string | string[]> = {
    title: content.title,
    text: content.text.slice(0, 10000),
    links: content.links.map((l) => `${l.text}: ${l.href}`),
  };
  
  return { extracted };
}

/**
 * Fill a form on a page
 */
export async function fillForm(args: {
  url: string;
  fields: Record<string, string>; // selector -> value
  submitSelector?: string;
}): Promise<{ success: boolean; resultUrl?: string }> {
  // Requires Playwright for actual form interaction
  throw new Error('Form filling requires Playwright browser.');
}

/**
 * Click an element on a page
 */
export async function click(args: {
  url: string;
  selector: string;
  waitForNavigation?: boolean;
}): Promise<{ success: boolean; newUrl?: string }> {
  // Requires Playwright for actual click interaction
  throw new Error('Click interaction requires Playwright browser.');
}

// ============================================================================
// LLM-Optimized Search
// ============================================================================

/**
 * Search using Tavily (research-focused, citation-rich)
 */
export async function searchTavily(args: {
  query: string;
  searchDepth?: 'basic' | 'advanced';
  includeAnswer?: boolean;
  maxResults?: number;
}): Promise<SearchResponse> {
  if (!config.search.tavily.enabled || !config.search.tavily.apiKey) {
    throw new Error('Tavily search is not configured');
  }
  
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: config.search.tavily.apiKey,
      query: args.query,
      search_depth: args.searchDepth || 'basic',
      include_answer: args.includeAnswer ?? true,
      max_results: args.maxResults || 10,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }
  
  const data = await response.json() as {
    query: string;
    answer?: string;
    results: Array<{ title: string; url: string; content: string; score: number }>;
  };
  
  return {
    query: data.query,
    results: data.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      score: r.score,
      source: 'tavily',
    })),
    answer: data.answer,
    provider: 'tavily',
  };
}

/**
 * Search using Perplexity (conversational, synthesized answers)
 */
export async function searchPerplexity(args: {
  query: string;
  model?: string;
}): Promise<SearchResponse> {
  if (!config.search.perplexity.enabled || !config.search.perplexity.apiKey) {
    throw new Error('Perplexity search is not configured');
  }
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.search.perplexity.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model || 'llama-3.1-sonar-small-128k-online',
      messages: [
        { role: 'user', content: args.query },
      ],
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Perplexity search failed: ${response.status}`);
  }
  
  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    citations?: string[];
  };
  
  return {
    query: args.query,
    results: [],
    answer: data.choices[0]?.message.content,
    citations: data.citations,
    provider: 'perplexity',
  };
}

/**
 * Search using SerpAPI (raw search results, multiple engines)
 */
export async function searchSerpAPI(args: {
  query: string;
  engine?: 'google' | 'bing' | 'duckduckgo';
  num?: number;
}): Promise<SearchResponse> {
  if (!config.search.serpapi.enabled || !config.search.serpapi.apiKey) {
    throw new Error('SerpAPI search is not configured');
  }
  
  const params = new URLSearchParams({
    api_key: config.search.serpapi.apiKey,
    q: args.query,
    engine: args.engine || 'google',
    num: String(args.num || 10),
  });
  
  const response = await fetch(`https://serpapi.com/search?${params}`);
  
  if (!response.ok) {
    throw new Error(`SerpAPI search failed: ${response.status}`);
  }
  
  const data = await response.json() as {
    organic_results?: Array<{ title: string; link: string; snippet: string }>;
  };
  
  return {
    query: args.query,
    results: (data.organic_results || []).map((r) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      source: 'serpapi',
    })),
    provider: 'serpapi',
  };
}

/**
 * Unified search (auto-selects best provider)
 */
export async function search(args: {
  query: string;
  type?: 'web' | 'news' | 'research';
  maxResults?: number;
  preferredProvider?: 'tavily' | 'perplexity' | 'serpapi';
}): Promise<SearchResponse> {
  // Priority: preferred > tavily (for research) > perplexity (for answers) > serpapi (fallback)
  
  if (args.preferredProvider) {
    switch (args.preferredProvider) {
      case 'tavily':
        return searchTavily({ query: args.query, maxResults: args.maxResults });
      case 'perplexity':
        return searchPerplexity({ query: args.query });
      case 'serpapi':
        return searchSerpAPI({ query: args.query, num: args.maxResults });
    }
  }
  
  // Auto-select based on type
  if (args.type === 'research' && config.search.tavily.enabled) {
    return searchTavily({
      query: args.query,
      searchDepth: 'advanced',
      includeAnswer: true,
      maxResults: args.maxResults,
    });
  }
  
  if (config.search.perplexity.enabled) {
    return searchPerplexity({ query: args.query });
  }
  
  if (config.search.tavily.enabled) {
    return searchTavily({ query: args.query, maxResults: args.maxResults });
  }
  
  if (config.search.serpapi.enabled) {
    return searchSerpAPI({ query: args.query, num: args.maxResults });
  }
  
  throw new Error('No search provider configured');
}

/**
 * Search for news
 */
export async function searchNews(args: {
  query: string;
  maxResults?: number;
}): Promise<SearchResponse> {
  // Use SerpAPI with news engine or Tavily with news filter
  if (config.search.serpapi.enabled) {
    const params = new URLSearchParams({
      api_key: config.search.serpapi.apiKey!,
      q: args.query,
      engine: 'google_news',
      num: String(args.maxResults || 10),
    });
    
    const response = await fetch(`https://serpapi.com/search?${params}`);
    
    if (response.ok) {
      const data = await response.json() as {
        news_results?: Array<{ title: string; link: string; snippet: string; source: { name: string } }>;
      };
      
      return {
        query: args.query,
        results: (data.news_results || []).map((r) => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet,
          source: r.source?.name,
        })),
        provider: 'serpapi-news',
      };
    }
  }
  
  // Fallback to regular search with news keywords
  return search({
    query: `${args.query} news`,
    maxResults: args.maxResults,
  });
}

/**
 * Search for academic/research content
 */
export async function searchResearch(args: {
  query: string;
  maxResults?: number;
}): Promise<SearchResponse> {
  // Use Tavily with advanced depth for research
  if (config.search.tavily.enabled) {
    return searchTavily({
      query: args.query,
      searchDepth: 'advanced',
      includeAnswer: true,
      maxResults: args.maxResults,
    });
  }
  
  // Fallback to SerpAPI with Google Scholar
  if (config.search.serpapi.enabled) {
    const params = new URLSearchParams({
      api_key: config.search.serpapi.apiKey!,
      q: args.query,
      engine: 'google_scholar',
      num: String(args.maxResults || 10),
    });
    
    const response = await fetch(`https://serpapi.com/search?${params}`);
    
    if (response.ok) {
      const data = await response.json() as {
        organic_results?: Array<{ title: string; link: string; snippet: string }>;
      };
      
      return {
        query: args.query,
        results: (data.organic_results || []).map((r) => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet,
          source: 'google_scholar',
        })),
        provider: 'serpapi-scholar',
      };
    }
  }
  
  throw new Error('No research search provider configured');
}
