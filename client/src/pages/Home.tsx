import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  FileText, 
  Brain, 
  GitCompare, 
  FolderTree, 
  Shield,
  Zap,
  Database,
  Cpu,
  ArrowRight,
  Terminal,
  Layers,
  Activity
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

/**
 * MCP Preprocessing Tool Shop - Home Dashboard
 * 
 * A "Home Depot of preprocessing tools" designed for 85%+ token reduction
 * before data flows into final databases (Neo4j, Supabase, Vector DBs).
 */
export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  // Tool categories for the dashboard
  const toolCategories = [
    {
      name: "Search",
      icon: Search,
      description: "ripgrep/ugrep integration with streaming matches",
      tools: ["search.ripgrep", "search.ugrep"],
      color: "bg-blue-500/10 text-blue-600",
    },
    {
      name: "Document",
      icon: FileText,
      description: "Pandoc conversion, Tesseract OCR, segmentation",
      tools: ["doc.convert_to_markdown", "doc.ocr_image_or_pdf", "doc.segment"],
      color: "bg-green-500/10 text-green-600",
    },
    {
      name: "NLP",
      icon: Brain,
      description: "Entity extraction, keywords, sentiment, language detection",
      tools: ["nlp.detect_language", "nlp.extract_entities", "nlp.extract_keywords", "nlp.analyze_sentiment"],
      color: "bg-purple-500/10 text-purple-600",
    },
    {
      name: "Diff & Merge",
      icon: GitCompare,
      description: "Text comparison, similarity analysis, merge proposals",
      tools: ["diff.text", "diff.similarity"],
      color: "bg-orange-500/10 text-orange-600",
    },
    {
      name: "Filesystem",
      icon: FolderTree,
      description: "Sandboxed file operations with approval gating",
      tools: ["fs.list_dir", "fs.read_file", "fs.write_file"],
      color: "bg-yellow-500/10 text-yellow-600",
    },
    {
      name: "ML (Optional)",
      icon: Cpu,
      description: "Embeddings, semantic search, classification",
      tools: ["ml.embed", "ml.semantic_search"],
      color: "bg-pink-500/10 text-pink-600",
    },
  ];

  const features = [
    {
      icon: Zap,
      title: "85%+ Token Reduction",
      description: "Heavy preprocessing happens here so LLMs receive pre-analyzed, structured data.",
    },
    {
      icon: Database,
      title: "Content-Addressed Storage",
      description: "SHA-256 refs with paging for token-efficient retrieval of large artifacts.",
    },
    {
      icon: Layers,
      title: "Working Memory (Chroma)",
      description: "Staging area for intermediate results - not the final destination.",
    },
    {
      icon: Shield,
      title: "HITL Approval Gating",
      description: "Preview, diff, and rollback for all destructive operations.",
    },
    {
      icon: Activity,
      title: "Observability",
      description: "Distributed tracing and metrics for task execution monitoring.",
    },
    {
      icon: Terminal,
      title: "Provider Agnostic",
      description: "Ollama, Gemini, OpenRouter, BERT - swap LLM providers freely.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl">MCP Tool Shop</span>
          </div>
          <nav className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  Welcome, {user?.name || "User"}
                </span>
                <Button variant="outline" size="sm">
                  Dashboard
                </Button>
              </div>
            ) : (
              <Button asChild>
                <a href={getLoginUrl()}>Sign In</a>
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4">
            Preprocessing Tool Platform
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            The Home Depot of{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Document Preprocessing
            </span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Token-efficient MCP Gateway for OCR, entity extraction, sentiment analysis, 
            chunking, embeddings, and more. Achieve 85%+ token reduction before 
            data flows to your final databases.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="gap-2">
              <Terminal className="h-4 w-4" />
              Explore Tools
            </Button>
            <Button size="lg" variant="outline" className="gap-2">
              View Documentation
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Tool Search */}
      <section className="py-12 px-4 bg-white border-y">
        <div className="container max-w-4xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search tools... (e.g., 'ocr', 'entity extraction', 'summarize')"
              className="pl-12 h-14 text-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Tool Categories */}
      <section className="py-16 px-4">
        <div className="container">
          <h2 className="text-2xl font-bold mb-8 text-center">Tool Categories</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {toolCategories.map((category) => (
              <Card key={category.name} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${category.color}`}>
                      <category.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                  </div>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {category.tools.map((tool) => (
                      <Badge key={tool} variant="secondary" className="text-xs">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 bg-slate-900 text-white">
        <div className="container">
          <h2 className="text-2xl font-bold mb-2 text-center">Why MCP Tool Shop?</h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            An intermediary preprocessing system designed for maximum token efficiency
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="flex gap-4">
                <div className="p-2 h-fit rounded-lg bg-white/10">
                  <feature.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-slate-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Overview */}
      <section className="py-16 px-4">
        <div className="container max-w-4xl">
          <h2 className="text-2xl font-bold mb-8 text-center">Data Flow Architecture</h2>
          <Card className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-center">
                <div className="h-16 w-16 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="font-semibold">Raw Documents</h3>
                <p className="text-sm text-muted-foreground">PDFs, Images, Text</p>
              </div>
              <ArrowRight className="h-8 w-8 text-muted-foreground hidden md:block" />
              <div className="text-center">
                <div className="h-16 w-16 mx-auto mb-3 rounded-full bg-purple-100 flex items-center justify-center">
                  <Layers className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="font-semibold">MCP Tool Shop</h3>
                <p className="text-sm text-muted-foreground">OCR, NLP, Chunking</p>
              </div>
              <ArrowRight className="h-8 w-8 text-muted-foreground hidden md:block" />
              <div className="text-center">
                <div className="h-16 w-16 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                  <Database className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="font-semibold">Final Databases</h3>
                <p className="text-sm text-muted-foreground">Neo4j, Supabase, VectorDB</p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* API Endpoints */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="container max-w-4xl">
          <h2 className="text-2xl font-bold mb-8 text-center">MCP Gateway API</h2>
          <Tabs defaultValue="search" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="search">search_tools</TabsTrigger>
              <TabsTrigger value="describe">describe_tool</TabsTrigger>
              <TabsTrigger value="invoke">invoke_tool</TabsTrigger>
              <TabsTrigger value="getref">get_ref</TabsTrigger>
            </TabsList>
            <TabsContent value="search" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">search_tools</CardTitle>
                  <CardDescription>
                    Discover available tools with minimal token overhead. Returns compact 
                    tool cards (name, category, description, tags).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Example request
trpc.mcp.searchTools.query({
  query: "extract entities",
  topK: 10,
  category: "nlp"
})`}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="describe" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">describe_tool</CardTitle>
                  <CardDescription>
                    Get full tool specification on demand. Includes input/output schemas, 
                    examples, and permission requirements.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Example request
trpc.mcp.describeTool.query({
  toolName: "nlp.extract_entities"
})`}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="invoke" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">invoke_tool</CardTitle>
                  <CardDescription>
                    Execute tools with reference-based returns. Small outputs inline, 
                    large outputs return content references for paged retrieval.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Example request
trpc.mcp.invokeTool.mutate({
  toolName: "doc.ocr_image_or_pdf",
  args: { path: "/data/document.pdf" },
  options: { returnRef: true }
})`}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="getref" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">get_ref</CardTitle>
                  <CardDescription>
                    Retrieve content-addressed artifacts with paging. Enables token-efficient 
                    retrieval of large outputs.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Example request
trpc.mcp.getRef.query({
  ref: "sha256:abc123...",
  page: 1,
  pageSize: 4096
})`}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t bg-white">
        <div className="container text-center text-sm text-muted-foreground">
          <p>MCP Preprocessing Tool Shop - Token-efficient document preprocessing platform</p>
          <p className="mt-2">
            Designed for 85%+ token reduction before data flows to Neo4j, Supabase, and Vector DBs
          </p>
        </div>
      </footer>
    </div>
  );
}
