import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
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
  FileSearch,
  Scale,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Copy
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

interface ToolSchema {
  type?: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: { type?: string };
}

interface ToolSpec {
  data?: {
    description?: string;
    tags?: string[];
    inputSchema?: {
      properties?: Record<string, ToolSchema>;
      required?: string[];
    };
  };
}

export default function Tools() {
  const { loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testParams, setTestParams] = useState<Record<string, unknown>>({});
  const [testResult, setTestResult] = useState<{ success: boolean; data?: unknown; error?: string; latencyMs?: number } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  
  const { data: searchResults, isLoading: searchLoading } = trpc.mcp.searchTools.useQuery(
    { query: searchQuery || '*', topK: 100 },
    { enabled: true }
  );

  const { data: toolSpec, isLoading: specLoading } = trpc.mcp.describeTool.useQuery(
    { toolName: selectedTool || '' },
    { enabled: !!selectedTool }
  ) as { data: ToolSpec | undefined; isLoading: boolean };

  const invokeTool = trpc.mcp.invokeTool.useMutation({
    onSuccess: (result) => {
      setTestResult({
        success: true,
        data: result,
        latencyMs: Date.now() - (window as unknown as { __toolStartTime?: number }).__toolStartTime!,
      });
      setIsRunning(false);
      toast.success('Tool executed successfully');
    },
    onError: (error) => {
      setTestResult({
        success: false,
        error: error.message,
        latencyMs: Date.now() - (window as unknown as { __toolStartTime?: number }).__toolStartTime!,
      });
      setIsRunning(false);
      toast.error('Tool execution failed');
    },
  });

  // Initialize test params when tool changes
  const initializeParams = useMemo(() => {
    if (!toolSpec?.data?.inputSchema?.properties) return {};
    const props = toolSpec.data.inputSchema.properties;
    const params: Record<string, unknown> = {};
    for (const [name, schema] of Object.entries(props)) {
      if (schema.default !== undefined) {
        params[name] = schema.default;
      } else if (schema.type === 'boolean') {
        params[name] = false;
      } else if (schema.type === 'number' || schema.type === 'integer') {
        params[name] = 0;
      } else if (schema.type === 'array') {
        params[name] = [];
      } else {
        params[name] = '';
      }
    }
    return params;
  }, [toolSpec]);

  const handleOpenTestDialog = () => {
    setTestParams(initializeParams);
    setTestResult(null);
    setTestDialogOpen(true);
  };

  const handleRunTest = () => {
    if (!selectedTool) return;
    setIsRunning(true);
    (window as unknown as { __toolStartTime?: number }).__toolStartTime = Date.now();
    
    // Filter out empty string values for optional params
    const filteredParams: Record<string, unknown> = {};
    const required = toolSpec?.data?.inputSchema?.required || [];
    for (const [key, value] of Object.entries(testParams)) {
      if (required.includes(key) || value !== '' && value !== null && value !== undefined) {
        filteredParams[key] = value;
      }
    }
    
    invokeTool.mutate({
      toolName: selectedTool,
      args: filteredParams,
    });
  };

  const handleParamChange = (name: string, value: unknown, schema: ToolSchema) => {
    let parsedValue = value;
    
    // Parse based on type
    if (schema.type === 'number' || schema.type === 'integer') {
      parsedValue = value === '' ? 0 : Number(value);
    } else if (schema.type === 'boolean') {
      parsedValue = Boolean(value);
    } else if (schema.type === 'array' && typeof value === 'string') {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    
    setTestParams(prev => ({ ...prev, [name]: parsedValue }));
  };

  const renderParamInput = (name: string, schema: ToolSchema, isRequired: boolean) => {
    const value = testParams[name];
    
    // Enum type - use select
    if (schema.enum && schema.enum.length > 0) {
      return (
        <Select
          value={String(value || '')}
          onValueChange={(v) => handleParamChange(name, v, schema)}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${name}`} />
          </SelectTrigger>
          <SelectContent>
            {schema.enum.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    
    // Boolean type - use switch
    if (schema.type === 'boolean') {
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={Boolean(value)}
            onCheckedChange={(checked) => handleParamChange(name, checked, schema)}
          />
          <span className="text-sm text-muted-foreground">{value ? 'true' : 'false'}</span>
        </div>
      );
    }
    
    // Number type
    if (schema.type === 'number' || schema.type === 'integer') {
      return (
        <Input
          type="number"
          value={String(value ?? '')}
          onChange={(e) => handleParamChange(name, e.target.value, schema)}
          placeholder={schema.description || `Enter ${name}`}
        />
      );
    }
    
    // Array type - use textarea
    if (schema.type === 'array') {
      return (
        <Textarea
          value={Array.isArray(value) ? JSON.stringify(value, null, 2) : String(value || '[]')}
          onChange={(e) => handleParamChange(name, e.target.value, schema)}
          placeholder={`Enter JSON array or comma-separated values`}
          className="font-mono text-sm"
          rows={3}
        />
      );
    }
    
    // String type - check if it's likely a long text
    const isLongText = name.toLowerCase().includes('text') || 
                       name.toLowerCase().includes('content') ||
                       name.toLowerCase().includes('body') ||
                       schema.description?.toLowerCase().includes('text');
    
    if (isLongText) {
      return (
        <Textarea
          value={String(value || '')}
          onChange={(e) => handleParamChange(name, e.target.value, schema)}
          placeholder={schema.description || `Enter ${name}`}
          rows={4}
        />
      );
    }
    
    // Default to input
    return (
      <Input
        value={String(value || '')}
        onChange={(e) => handleParamChange(name, e.target.value, schema)}
        placeholder={schema.description || `Enter ${name}`}
      />
    );
  };

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
                    const categoryTools = toolsByCategory[category] || [];
                    
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
                            {categoryTools.map((tool) => (
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
                    <p className="text-sm text-muted-foreground">{toolSpec.data?.description || 'No description'}</p>
                    
                    {toolSpec.data?.tags && toolSpec.data.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {toolSpec.data.tags.map((tag: string) => (
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
                          const props = toolSpec.data?.inputSchema?.properties;
                          const required = toolSpec.data?.inputSchema?.required || [];
                          if (!props) return <p className="text-sm text-muted-foreground">No parameters</p>;
                          return Object.entries(props).map(([name, schema]) => (
                            <div key={name} className="p-2 bg-muted/50 rounded text-sm">
                              <div className="flex items-center gap-2">
                                <code className="font-mono">{name}</code>
                                <Badge variant="outline" className="text-xs">
                                  {String(schema.type || 'any')}
                                </Badge>
                                {required.includes(name) && (
                                  <Badge variant="destructive" className="text-xs">required</Badge>
                                )}
                              </div>
                              {schema.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {schema.description}
                                </p>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    <Button className="w-full" onClick={handleOpenTestDialog}>
                      <Play className="h-4 w-4 mr-2" />
                      Test Tool
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

      {/* Test Tool Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Test: {selectedTool?.split('.').slice(1).join('.')}
            </DialogTitle>
            <DialogDescription>
              Enter parameters and run the tool to see results
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Parameters */}
            <div className="space-y-4">
              <h3 className="font-medium">Parameters</h3>
              {toolSpec?.data?.inputSchema?.properties ? (
                Object.entries(toolSpec.data.inputSchema.properties).map(([name, schema]) => {
                  const isRequired = toolSpec.data?.inputSchema?.required?.includes(name) || false;
                  return (
                    <div key={name} className="space-y-2">
                      <Label className="flex items-center gap-2">
                        {name}
                        {isRequired && <Badge variant="destructive" className="text-xs">required</Badge>}
                        <Badge variant="outline" className="text-xs">{schema.type || 'string'}</Badge>
                      </Label>
                      {schema.description && (
                        <p className="text-xs text-muted-foreground">{schema.description}</p>
                      )}
                      {renderParamInput(name, schema, isRequired)}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No parameters required</p>
              )}
            </div>

            {/* Run Button */}
            <Button 
              onClick={handleRunTest} 
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Tool
                </>
              )}
            </Button>

            {/* Results */}
            {testResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    Result
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {testResult.latencyMs}ms
                  </div>
                </div>
                
                <div className="relative">
                  <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto max-h-[300px] overflow-y-auto">
                    {testResult.success 
                      ? JSON.stringify(testResult.data, null, 2)
                      : testResult.error
                    }
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        testResult.success 
                          ? JSON.stringify(testResult.data, null, 2)
                          : testResult.error || ''
                      );
                      toast.success('Copied to clipboard');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
