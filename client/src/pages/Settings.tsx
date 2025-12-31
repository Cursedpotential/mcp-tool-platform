import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { 
  Settings as SettingsIcon,
  Key,
  Cloud,
  Cpu,
  Terminal,
  CheckCircle,
  XCircle,
  RefreshCw,
  Save,
  Download,
  Upload,
  Zap,
  Globe,
  Server
} from "lucide-react";

const PROVIDER_INFO: Record<string, { name: string; icon: React.ReactNode; description: string; type: 'local' | 'cloud' | 'cli' }> = {
  ollama: { name: 'Ollama', icon: <Cpu className="h-4 w-4" />, description: 'Local LLM server (CPU-friendly)', type: 'local' },
  lmstudio: { name: 'LM Studio', icon: <Cpu className="h-4 w-4" />, description: 'Local model runner', type: 'local' },
  llamacpp: { name: 'llama.cpp', icon: <Cpu className="h-4 w-4" />, description: 'Native C++ inference', type: 'local' },
  openai: { name: 'OpenAI', icon: <Cloud className="h-4 w-4" />, description: 'GPT-4, GPT-4o, embeddings', type: 'cloud' },
  anthropic: { name: 'Anthropic', icon: <Cloud className="h-4 w-4" />, description: 'Claude 3 models', type: 'cloud' },
  google: { name: 'Google Gemini', icon: <Cloud className="h-4 w-4" />, description: 'Gemini Pro, Flash', type: 'cloud' },
  groq: { name: 'Groq', icon: <Zap className="h-4 w-4" />, description: 'Ultra-fast inference', type: 'cloud' },
  openrouter: { name: 'OpenRouter', icon: <Globe className="h-4 w-4" />, description: 'Multi-model gateway', type: 'cloud' },
  perplexity: { name: 'Perplexity', icon: <Cloud className="h-4 w-4" />, description: 'Search-augmented LLM', type: 'cloud' },
  together: { name: 'Together AI', icon: <Cloud className="h-4 w-4" />, description: 'Open model hosting', type: 'cloud' },
  mistral: { name: 'Mistral', icon: <Cloud className="h-4 w-4" />, description: 'Mistral models', type: 'cloud' },
  cohere: { name: 'Cohere', icon: <Cloud className="h-4 w-4" />, description: 'Command, embeddings', type: 'cloud' },
  'claude-cli': { name: 'Claude CLI', icon: <Terminal className="h-4 w-4" />, description: 'Use your Claude subscription', type: 'cli' },
  'gemini-cli': { name: 'Gemini CLI', icon: <Terminal className="h-4 w-4" />, description: 'Use your Gemini subscription', type: 'cli' },
  aider: { name: 'Aider', icon: <Terminal className="h-4 w-4" />, description: 'AI pair programming', type: 'cli' },
};

export default function Settings() {
  const { user, loading: authLoading } = useAuth();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  
  const { data: providers, isLoading, refetch } = trpc.llm.listProviders.useQuery();
  const { data: available } = trpc.llm.detectAvailable.useQuery();
  const { data: configExport } = trpc.config.exportAll.useQuery();
  
  const configureMutation = trpc.llm.configureProvider.useMutation({
    onSuccess: () => {
      toast.success('Provider configured');
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.llm.testProvider.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Provider working! Response: "${result.response}" (${result.latency}ms)`);
      } else {
        toast.error(`Test failed: ${result.error}`);
      }
    },
  });

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please log in to access settings</p>
        </div>
      </DashboardLayout>
    );
  }

  const handleSaveProvider = (provider: string, enabled: boolean) => {
    configureMutation.mutate({
      provider,
      config: {
        enabled,
        apiKey: apiKeys[provider],
      },
    });
  };

  const handleExport = () => {
    if (configExport) {
      const blob = new Blob([JSON.stringify(configExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mcp-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Configuration exported');
    }
  };

  const localProviders = providers?.filter(p => PROVIDER_INFO[p.type]?.type === 'local') || [];
  const cloudProviders = providers?.filter(p => PROVIDER_INFO[p.type]?.type === 'cloud') || [];
  const cliProviders = providers?.filter(p => PROVIDER_INFO[p.type]?.type === 'cli') || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Configure LLM providers, API keys, and system settings</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export Config
            </Button>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import Config
            </Button>
          </div>
        </div>

        <Tabs defaultValue="providers" className="space-y-4">
          <TabsList>
            <TabsTrigger value="providers">LLM Providers</TabsTrigger>
            <TabsTrigger value="routing">Task Routing</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="space-y-6">
            {/* Detected Local Services */}
            {available && available.length > 0 && (
              <Card className="border-green-500/50 bg-green-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    Detected Local Services
                  </CardTitle>
                  <CardDescription>These services are running on your machine</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {available.map(p => (
                      <Badge key={p} variant="secondary" className="bg-green-500/10 text-green-600">
                        {PROVIDER_INFO[p]?.name || p}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Local Providers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Local Providers
                </CardTitle>
                <CardDescription>Free, private, runs on your machine (CPU-friendly for i7-7700)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {localProviders.map(provider => {
                    const info = PROVIDER_INFO[provider.type];
                    const isAvailable = available?.includes(provider.type);
                    return (
                      <div key={provider.type} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${isAvailable ? 'bg-green-500/10' : 'bg-muted'}`}>
                            {info?.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{info?.name}</p>
                              {isAvailable && <Badge variant="outline" className="text-green-600">Running</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">{info?.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Switch 
                            checked={provider.enabled}
                            onCheckedChange={(enabled) => handleSaveProvider(provider.type, enabled)}
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => testMutation.mutate({ provider: provider.type })}
                            disabled={!isAvailable || testMutation.isPending}
                          >
                            Test
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Cloud Providers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  Cloud Providers
                </CardTitle>
                <CardDescription>API-based services (requires API keys)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cloudProviders.map(provider => {
                    const info = PROVIDER_INFO[provider.type];
                    return (
                      <div key={provider.type} className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              {info?.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{info?.name}</p>
                                {provider.enabled && <Badge>Enabled</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground">{info?.description}</p>
                            </div>
                          </div>
                          <Switch 
                            checked={provider.enabled}
                            onCheckedChange={(enabled) => handleSaveProvider(provider.type, enabled)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label htmlFor={`key-${provider.type}`} className="sr-only">API Key</Label>
                            <Input
                              id={`key-${provider.type}`}
                              type="password"
                              placeholder="Enter API key..."
                              value={apiKeys[provider.type] || ''}
                              onChange={(e) => setApiKeys(prev => ({ ...prev, [provider.type]: e.target.value }))}
                            />
                          </div>
                          <Button 
                            variant="outline"
                            onClick={() => handleSaveProvider(provider.type, provider.enabled)}
                            disabled={!apiKeys[provider.type]}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => testMutation.mutate({ provider: provider.type })}
                            disabled={testMutation.isPending}
                          >
                            Test
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* CLI Providers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  CLI Tools
                </CardTitle>
                <CardDescription>Use your existing subscriptions via command-line tools</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cliProviders.map(provider => {
                    const info = PROVIDER_INFO[provider.type];
                    const isAvailable = available?.includes(provider.type);
                    return (
                      <div key={provider.type} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${isAvailable ? 'bg-green-500/10' : 'bg-muted'}`}>
                            {info?.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{info?.name}</p>
                              {isAvailable ? (
                                <Badge variant="outline" className="text-green-600">Installed</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">Not Found</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{info?.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Switch 
                            checked={provider.enabled}
                            onCheckedChange={(enabled) => handleSaveProvider(provider.type, enabled)}
                            disabled={!isAvailable}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="routing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Task Routing Rules</CardTitle>
                <CardDescription>Configure which providers handle which tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">Simple Tasks</p>
                      <Badge variant="secondary">Local First</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Sentiment analysis, keyword extraction, language detection, classification
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Priority: Ollama → LM Studio → Groq → OpenRouter
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">Medium Tasks</p>
                      <Badge variant="secondary">Balanced</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Short summarization, entity extraction, rewriting, translation
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Priority: Ollama → Groq → OpenRouter → Google
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">Complex Tasks</p>
                      <Badge variant="secondary">Cloud Preferred</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Long summarization, deep analysis, code generation, reasoning
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Priority: Anthropic → OpenAI → Google → Claude CLI
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">Embeddings</p>
                      <Badge variant="secondary">Local Preferred</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Text embeddings for semantic search and similarity
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Priority: Ollama (nomic-embed) → OpenAI → Cohere
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
                <CardDescription>Platform configuration and status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Platform</span>
                    <span className="font-medium">MCP Tool Shop</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-medium">1.0.0</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Active Tools</span>
                    <span className="font-medium">28</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Python Bridge</span>
                    <Badge variant="outline" className="text-green-600">Available</Badge>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Content Store</span>
                    <Badge variant="outline" className="text-green-600">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
