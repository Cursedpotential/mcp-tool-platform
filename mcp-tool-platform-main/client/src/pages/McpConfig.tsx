import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Download, Copy, Sparkles, Settings2, FileJson, Code, CheckCircle } from "lucide-react";

type Platform = 'claude' | 'gemini' | 'openai' | 'generic';

interface PlatformInfo {
  id: Platform;
  name: string;
  description: string;
  icon: string;
  configPath: string;
  features: string[];
}

const PLATFORMS: PlatformInfo[] = [
  {
    id: 'claude',
    name: 'Claude Desktop',
    description: 'Anthropic Claude Desktop app with MCP support',
    icon: '🤖',
    configPath: '~/Library/Application Support/Claude/claude_desktop_config.json',
    features: ['MCP Tools', 'Skills', 'Prompt Caching'],
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    description: 'Google Gemini CLI with extensions',
    icon: '✨',
    configPath: '~/.gemini/extensions/',
    features: ['Extensions', 'Long Context', 'Multimodal'],
  },
  {
    id: 'openai',
    name: 'OpenAI / GPT',
    description: 'OpenAI function calling format',
    icon: '🧠',
    configPath: 'API Integration',
    features: ['Function Calling', 'Tool Use', 'JSON Mode'],
  },
  {
    id: 'generic',
    name: 'Generic MCP',
    description: 'Standard MCP protocol for any client',
    icon: '🔧',
    configPath: 'Custom Integration',
    features: ['Standard Protocol', 'HTTP/WebSocket', 'Streaming'],
  },
];

export default function McpConfig() {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('claude');
  const [includeAllTools, setIncludeAllTools] = useState(true);
  const [generateWithAI, setGenerateWithAI] = useState(true);
  const [generatedConfig, setGeneratedConfig] = useState<{
    config: unknown;
    file: { filename: string; content: string };
    apiKeyId: number;
    apiKeyName: string;
  } | null>(null);

  const generateMutation = trpc.mcpConfig.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedConfig(data);
      toast.success("MCP configuration generated successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to generate config: ${error.message}`);
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      platform: selectedPlatform,
      includeAllTools,
      generateWithAI,
    });
  };

  const handleCopy = () => {
    if (generatedConfig) {
      navigator.clipboard.writeText(generatedConfig.file.content);
      toast.success("Configuration copied to clipboard!");
    }
  };

  const handleDownload = () => {
    if (generatedConfig) {
      const blob = new Blob([generatedConfig.file.content], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generatedConfig.file.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Configuration downloaded!");
    }
  };

  const currentPlatform = PLATFORMS.find((p) => p.id === selectedPlatform)!;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">MCP Configuration</h1>
          <p className="text-muted-foreground">
            Generate platform-specific MCP configurations with AI-optimized prompts and skills
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Platform Selection */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  Select Platform
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {PLATFORMS.map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => setSelectedPlatform(platform.id)}
                    className={`w-full p-4 rounded-lg border text-left transition-all ${
                      selectedPlatform === platform.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{platform.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{platform.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {platform.description}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {platform.features.map((feature) => (
                            <Badge key={feature} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {selectedPlatform === platform.id && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="includeAll" className="flex-1">
                    <div>Include All Tools</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      Add all available tools to the config
                    </div>
                  </Label>
                  <Switch
                    id="includeAll"
                    checked={includeAllTools}
                    onCheckedChange={setIncludeAllTools}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="aiGenerate" className="flex-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-yellow-500" />
                      AI-Enhanced
                    </div>
                    <div className="text-sm text-muted-foreground font-normal">
                      Use AI to optimize prompts and skills
                    </div>
                  </Label>
                  <Switch
                    id="aiGenerate"
                    checked={generateWithAI}
                    onCheckedChange={setGenerateWithAI}
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full"
              size="lg"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                "Generating..."
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Configuration
                </>
              )}
            </Button>
          </div>

          {/* Generated Config */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileJson className="h-5 w-5" />
                      Generated Configuration
                    </CardTitle>
                    <CardDescription>
                      {currentPlatform.name} - {currentPlatform.configPath}
                    </CardDescription>
                  </div>
                  {generatedConfig && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopy}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDownload}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {generatedConfig ? (
                  <Tabs defaultValue="config">
                    <TabsList>
                      <TabsTrigger value="config">Configuration</TabsTrigger>
                      <TabsTrigger value="instructions">Instructions</TabsTrigger>
                    </TabsList>
                    <TabsContent value="config" className="mt-4">
                      <ScrollArea className="h-[500px] rounded-lg border bg-muted/30">
                        <pre className="p-4 text-sm font-mono">
                          <code>{generatedConfig.file.content}</code>
                        </pre>
                      </ScrollArea>
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <p className="text-sm">
                          <strong>API Key Created:</strong> {generatedConfig.apiKeyName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          This key is embedded in the configuration above
                        </p>
                      </div>
                    </TabsContent>
                    <TabsContent value="instructions" className="mt-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <h3>Installation Instructions for {currentPlatform.name}</h3>
                        {selectedPlatform === 'claude' && (
                          <>
                            <ol>
                              <li>Open Claude Desktop settings</li>
                              <li>Navigate to the MCP Servers section</li>
                              <li>
                                Copy the configuration to{' '}
                                <code>{currentPlatform.configPath}</code>
                              </li>
                              <li>Restart Claude Desktop</li>
                              <li>
                                The preprocessing tools will appear in your tool list
                              </li>
                            </ol>
                            <p>
                              <strong>Note:</strong> Make sure to keep your API key
                              secure and never share the configuration file publicly.
                            </p>
                          </>
                        )}
                        {selectedPlatform === 'gemini' && (
                          <>
                            <ol>
                              <li>Save the configuration as an extension file</li>
                              <li>
                                Place it in <code>{currentPlatform.configPath}</code>
                              </li>
                              <li>Enable the extension in Gemini CLI settings</li>
                              <li>
                                Use <code>@preprocessing</code> to invoke tools
                              </li>
                            </ol>
                          </>
                        )}
                        {selectedPlatform === 'openai' && (
                          <>
                            <ol>
                              <li>
                                Use the function definitions in your API calls
                              </li>
                              <li>
                                Include the tool definitions in the{' '}
                                <code>tools</code> parameter
                              </li>
                              <li>
                                Handle tool calls by forwarding to this server
                              </li>
                            </ol>
                          </>
                        )}
                        {selectedPlatform === 'generic' && (
                          <>
                            <ol>
                              <li>Configure your MCP client with the server URL</li>
                              <li>Add the API key to the Authorization header</li>
                              <li>
                                Use the standard MCP protocol to discover and
                                invoke tools
                              </li>
                            </ol>
                          </>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="h-[500px] flex items-center justify-center border rounded-lg bg-muted/30">
                    <div className="text-center">
                      <Code className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Select a platform and click "Generate Configuration"
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        AI will create optimized prompts and skills for your chosen platform
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
