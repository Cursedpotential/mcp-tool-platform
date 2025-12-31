import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { 
  Search,
  FileText,
  Brain,
  GitCompare,
  FolderTree,
  Sparkles,
  Cpu,
  Play,
  RefreshCw,
  ChevronRight,
  Zap,
  FileSearch,
  Languages,
  Scale,
  BookOpen
} from "lucide-react";

const CATEGORY_INFO: Record<string, { icon: React.ReactNode; color: string; description: string }> = {
  search: { icon: <Search className="h-5 w-5" />, color: 'bg-blue-500/10 text-blue-500', description: 'Text search with ripgrep/ugrep' },
  document: { icon: <FileText className="h-5 w-5" />, color: 'bg-green-500/10 text-green-500', description: 'OCR, conversion, chunking' },
  nlp: { icon: <Brain className="h-5 w-5" />, color: 'bg-purple-500/10 text-purple-500', description: 'Entity extraction, sentiment, keywords' },
  diff: { icon: <GitCompare className="h-5 w-5" />, color: 'bg-orange-500/10 text-orange-500', description: 'Text comparison and merging' },
  filesystem: { icon: <FolderTree className="h-5 w-5" />, color: 'bg-yellow-500/10 text-yellow-500', description: 'File operations with approval' },
  ml: { icon: <Sparkles className="h-5 w-5" />, color: 'bg-pink-500/10 text-pink-500', description: 'Embeddings and semantic search' },
  rules: { icon: <Scale className="h-5 w-5" />, color: 'bg-red-500/10 text-red-500', description: 'Pattern matching and actions' },
  summarization: { icon: <BookOpen className="h-5 w-5" />, color: 'bg-indigo-500/10 text-indigo-500', description: 'Hierarchical summarization' },
  retrieval: { icon: <FileSearch className="h-5 w-5" />, color: 'bg-cyan-500/10 text-cyan-500', description: 'BM25 and span retrieval' },
};

export default function Tools() {
  const { user, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  
  const { data: searchResults, isLoading: searchLoading } = trpc.mcp.searchTools.useQuery(
    { query: searchQuery || '*', topK: 100 },
    { enabled: true }
  );

  const { data: toolSpec, isLoading: specLoading } = trpc.mcp.describeTool.useQuery(
    { toolName: selectedTool || '' },
    { enabled: !!selectedTool }
  );

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Group tools by category
  type ToolItem = { name: string; description: string };
  const tools = (searchResults as unknown as { data?: { tools?: ToolItem[] } })?.data?.tools || [];
  const toolsByCategory = tools.reduce((acc: Record<string, ToolItem[]>, tool: ToolItem) => {
    const category = tool.name.split('.')[0] || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(tool);
    return acc;
  }, {} as Record<string, ToolItem[]>);

  const categories = Object.keys(toolsByCategory);
  const filteredCategories = selectedCategory 
    ? categories.filter(c => c === selectedCategory)
    : categories;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Tool Explorer</h1>
          <p className="text-muted-foreground">Browse, search, and test preprocessing tools</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tools... (e.g., 'ocr', 'entity extraction', 'summarize')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            All Tools
          </Button>
          {Object.entries(CATEGORY_INFO).map(([cat, info]) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className="gap-2"
            >
              {info.icon}
              {cat}
            </Button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Tool List */}
          <div className="lg:col-span-2">
            <ScrollArea className="h-[600px]">
              <div className="space-y-6">
                {searchLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredCategories.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Search className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No tools found</p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredCategories.map((category) => {
                    const info = CATEGORY_INFO[category] || { 
                      icon: <Cpu className="h-5 w-5" />, 
                      color: 'bg-gray-500/10 text-gray-500',
                      description: 'Tools'
                    };
                    const tools = toolsByCategory[category] || [];
                    
                    return (
                      <Card key={category}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${info.color}`}>
                              {info.icon}
                            </div>
                            <div>
                              <CardTitle className="capitalize">{category}</CardTitle>
                              <CardDescription>{info.description}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-2">
                            {tools.map((tool) => (
                              <button
                                key={tool.name}
                                onClick={() => setSelectedTool(tool.name)}
                                className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors hover:bg-muted/50 ${
                                  selectedTool === tool.name ? 'border-primary bg-primary/5' : ''
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{tool.name.split('.').slice(1).join('.')}</p>
                                  <p className="text-sm text-muted-foreground truncate">{tool.description}</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              </button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Tool Detail Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>
                  {selectedTool ? selectedTool.split('.').slice(1).join('.') : 'Select a Tool'}
                </CardTitle>
                {selectedTool && (
                  <Badge variant="outline">{selectedTool.split('.')[0]}</Badge>
                )}
              </CardHeader>
              <CardContent>
                {!selectedTool ? (
                  <p className="text-muted-foreground text-center py-8">
                    Click on a tool to view its details and test it
                  </p>
                ) : specLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : toolSpec ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{(toolSpec as unknown as { data?: { description?: string } }).data?.description || 'No description'}</p>
                    
                    {(toolSpec as unknown as { data?: { tags?: string[] } }).data?.tags && (toolSpec as unknown as { data: { tags: string[] } }).data.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(toolSpec as unknown as { data: { tags: string[] } }).data.tags.map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Parameters</p>
                      <div className="space-y-2">
                        {(() => {
                          const spec = toolSpec as unknown as { data?: { inputSchema?: { properties?: Record<string, unknown>; required?: string[] } } };
                          const props = spec.data?.inputSchema?.properties;
                          const required = spec.data?.inputSchema?.required || [];
                          if (!props) return <p className="text-sm text-muted-foreground">No parameters</p>;
                          return Object.entries(props).map(([name, schema]) => (
                            <div key={name} className="p-2 bg-muted/50 rounded text-sm">
                              <div className="flex items-center gap-2">
                                <code className="font-mono">{name}</code>
                                <Badge variant="outline" className="text-xs">
                                  {String((schema as Record<string, unknown>).type || 'any')}
                                </Badge>
                                {required.includes(name) && (
                                  <Badge variant="destructive" className="text-xs">required</Badge>
                                )}
                              </div>
                              {(schema as Record<string, unknown>).description ? (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {String((schema as Record<string, unknown>).description)}
                                </p>
                              ) : null}
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    <Button className="w-full" disabled>
                      <Play className="h-4 w-4 mr-2" />
                      Test Tool (Coming Soon)
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Tool not found
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
