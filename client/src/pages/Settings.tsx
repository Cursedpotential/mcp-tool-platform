// File: client/src/pages/Settings.tsx | Date: 2026-01-21 | Agent: Antigravity | Model: Gemini 2.0 Flash
import { useAuth } from "@/core/hooks/useAuth";

import DashboardLayout from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Cloud,
  Cpu,
  Terminal,
  CheckCircle,
  RefreshCw,
  Save,
  Download,
  Upload,
  Zap,
  Globe,
  Server,
  Rocket,
} from "lucide-react";

// Types for our providers to avoid implicit any
type ProviderInfo = {
  name: string;
  icon: React.ReactNode;
  description: string;
  type: "local" | "cloud" | "cli";
};

type ConfiguredKey = {
  id: number;
  providerName: string;
  apiKeyMasked: string;
  baseUrl: string | null;
  isActive: boolean;
  priority: number;
};

const PROVIDER_INFO: Record<string, ProviderInfo> = {
  ollama: {
    name: "Ollama",
    icon: <Cpu className="h-4 w-4" />,
    description: "Local LLM server (CPU-friendly)",
    type: "local",
  },
  lmstudio: {
    name: "LM Studio",
    icon: <Cpu className="h-4 w-4" />,
    description: "Local model runner",
    type: "local",
  },
  llamacpp: {
    name: "llama.cpp",
    icon: <Cpu className="h-4 w-4" />,
    description: "Native C++ inference",
    type: "local",
  },
  openai: {
    name: "OpenAI",
    icon: <Cloud className="h-4 w-4" />,
    description: "GPT-4, GPT-4o, embeddings",
    type: "cloud",
  },
  anthropic: {
    name: "Anthropic",
    icon: <Cloud className="h-4 w-4" />,
    description: "Claude 3 models",
    type: "cloud",
  },
  google: {
    name: "Google Gemini",
    icon: <Cloud className="h-4 w-4" />,
    description: "Gemini Pro, Flash, Ultra",
    type: "cloud",
  },
  groq: {
    name: "Groq",
    icon: <Zap className="h-4 w-4" />,
    description: "Ultra-fast inference",
    type: "cloud",
  },
  openrouter: {
    name: "OpenRouter",
    icon: <Globe className="h-4 w-4" />,
    description: "Multi-model gateway",
    type: "cloud",
  },
  perplexity: {
    name: "Perplexity",
    icon: <Cloud className="h-4 w-4" />,
    description: "Search-augmented LLM",
    type: "cloud",
  },
  together: {
    name: "Together AI",
    icon: <Cloud className="h-4 w-4" />,
    description: "Open model hosting",
    type: "cloud",
  },
  mistral: {
    name: "Mistral",
    icon: <Cloud className="h-4 w-4" />,
    description: "Mistral models",
    type: "cloud",
  },
  cohere: {
    name: "Cohere",
    icon: <Cloud className="h-4 w-4" />,
    description: "Command, embeddings",
    type: "cloud",
  },
  "claude-cli": {
    name: "Claude CLI",
    icon: <Terminal className="h-4 w-4" />,
    description: "Use your Claude subscription",
    type: "cli",
  },
  "gemini-cli": {
    name: "Gemini CLI",
    icon: <Terminal className="h-4 w-4" />,
    description: "Use your Gemini subscription",
    type: "cli",
  },
  aider: {
    name: "Aider",
    icon: <Terminal className="h-4 w-4" />,
    description: "AI pair programming",
    type: "cli",
  },
};

export default function Settings() {
  const { user, loading: authLoading } = useAuth();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  // Fetch configured keys
  const {
    data: configuredKeys,
    isLoading,
    refetch,
  } = trpc.settings.getApiKeys.useQuery();

  // Mock detection for now
  const available: string[] = ["ollama"];

  const { data: configExport } = trpc.settings.getNlpConfig.useQuery();

  const [colabConfig, setColabConfig] = useState({
    projectId: "",
    region: "",
    runtimeTemplate: "",
    serviceAccountJson: "",
    notebookPath: "",
    syncBucket: "",
  });

  const addKeyMutation = trpc.settings.addApiKey.useMutation({
    onSuccess: () => {
      toast.success("Provider configured");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateKeyMutation = trpc.settings.updateApiKey.useMutation({
    onSuccess: () => {
      toast.success("Provider updated");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const testConnectionMutation = trpc.settings.testConnection.useMutation({
    onSuccess: (result: any) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(`Test failed: ${result.message}`);
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  trpc.settings.getColabConfig.useQuery(undefined, {
    onSuccess: (data) => {
      if (data) setColabConfig(data);
    }
  });

  const testColab = trpc.settings.testColabConfig.useMutation({
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  const saveColab = trpc.settings.saveColabConfig.useMutation({
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
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
          <p className="text-muted-foreground">
            Please log in to access settings
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const handleSaveProvider = (providerKey: string, enabled: boolean) => {
    // configuredKeys might be undefined if loading or error
    // Use 'any' cast if necessary or proper type if inference works
    // We expect configuredKeys to be Array<{id, providerName...}>
    const keysList = (configuredKeys as unknown as ConfiguredKey[]) || [];
    const existingKey = keysList.find((k) => k.providerName === providerKey);
    const newKeyValue = apiKeys[providerKey];

    if (existingKey) {
      updateKeyMutation.mutate({
        id: existingKey.id,
        isActive: enabled,
        apiKey: newKeyValue || undefined,
      });
    } else {
      if (!newKeyValue && enabled) {
        toast.error("API Key is required to enable a new provider");
        return;
      }
      if (newKeyValue) {
        addKeyMutation.mutate({
          providerName: providerKey,
          apiKey: newKeyValue,
        });
      }
    }
  };

  const handleTestProvider = (providerKey: string) => {
    const keysList = (configuredKeys as unknown as ConfiguredKey[]) || [];
    const existingKey = keysList.find((k) => k.providerName === providerKey);
    if (existingKey) {
      testConnectionMutation.mutate({
        type: 'llm_provider',
        providerId: existingKey.id
      });
    } else {
      toast.error("Please save the provider first before testing");
    }
  };

  const handleExport = () => {
    if (configExport) {
      const blob = new Blob([JSON.stringify(configExport, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mcp-config-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Configuration exported");
    }
  };

  const getAllProviders = (typeFilter: "local" | "cloud" | "cli") => {
    return Object.entries(PROVIDER_INFO)
      .filter(([_, info]) => info.type === typeFilter)
      .map(([key, _]) => {
        const keysList = (configuredKeys as unknown as ConfiguredKey[]) || [];
        const config = keysList.find((k) => k.providerName === key);
        return {
          type: key,
          enabled: config?.isActive ?? false,
          apiKeyMasked: config?.apiKeyMasked,
        };
      });
  };

  const localProviders = getAllProviders("local");
  const cloudProviders = getAllProviders("cloud");
  const cliProviders = getAllProviders("cli");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Configure LLM providers, API keys, and system settings
            </p>
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
            <TabsTrigger value="databases">Databases</TabsTrigger>
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
                  <CardDescription>
                    These services are running on your machine
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {available.map(p => (
                      <Badge
                        key={p}
                        variant="secondary"
                        className="bg-green-500/10 text-green-600"
                      >
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
                <CardDescription>
                  Free, private, runs on your machine (CPU-friendly for i7-7700)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {localProviders.map(provider => {
                    const info = PROVIDER_INFO[provider.type];
                    const isAvailable = available?.includes(provider.type);
                    return (
                      <div
                        key={provider.type}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-2 rounded-lg ${isAvailable ? "bg-green-500/10" : "bg-muted"}`}
                          >
                            {info?.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{info?.name}</p>
                              {isAvailable && (
                                <Badge
                                  variant="outline"
                                  className="text-green-600"
                                >
                                  Running
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {info?.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={provider.enabled}
                            onCheckedChange={enabled =>
                              handleSaveProvider(provider.type, enabled)
                            }
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleTestProvider(provider.type)
                            }
                            disabled={!isAvailable || testConnectionMutation.isPending}
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
                <CardDescription>
                  API-based services (requires API keys)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cloudProviders.map(provider => {
                    const info = PROVIDER_INFO[provider.type];
                    return (
                      <div
                        key={provider.type}
                        className="p-4 border rounded-lg space-y-4"
                      >
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
                              <p className="text-sm text-muted-foreground">
                                {info?.description}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={provider.enabled}
                            onCheckedChange={enabled =>
                              handleSaveProvider(provider.type, enabled)
                            }
                          />
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label
                              htmlFor={`key-${provider.type}`}
                              className="sr-only"
                            >
                              API Key
                            </Label>
                            <Input
                              id={`key-${provider.type}`}
                              type="password"
                              placeholder="Enter API key..."
                              value={apiKeys[provider.type] || ""}
                              onChange={e =>
                                setApiKeys(prev => ({
                                  ...prev,
                                  [provider.type]: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <Button
                            variant="outline"
                            onClick={() =>
                              handleSaveProvider(
                                provider.type,
                                provider.enabled
                              )
                            }
                            disabled={!apiKeys[provider.type]}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              handleTestProvider(provider.type)
                            }
                            disabled={testConnectionMutation.isPending}
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
                <CardDescription>
                  Use your existing subscriptions via command-line tools
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cliProviders.map(provider => {
                    const info = PROVIDER_INFO[provider.type];
                    const isAvailable = available?.includes(provider.type);
                    return (
                      <div
                        key={provider.type}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-2 rounded-lg ${isAvailable ? "bg-green-500/10" : "bg-muted"}`}
                          >
                            {info?.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{info?.name}</p>
                              {isAvailable ? (
                                <Badge
                                  variant="outline"
                                  className="text-green-600"
                                >
                                  Installed
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-muted-foreground"
                                >
                                  Not Found
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {info?.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={provider.enabled}
                            onCheckedChange={enabled =>
                              handleSaveProvider(provider.type, enabled)
                            }
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

          <TabsContent value="databases" className="space-y-6">
            {/* Neo4j Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Neo4j Graph Database
                </CardTitle>
                <CardDescription>
                  Configure Neo4j connection for entity relationships and
                  knowledge graphs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="neo4j-uri">URI</Label>
                      <Input
                        id="neo4j-uri"
                        placeholder="neo4j://localhost:7687"
                        defaultValue=""
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="neo4j-database">Database</Label>
                      <Input
                        id="neo4j-database"
                        placeholder="neo4j"
                        defaultValue="neo4j"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="neo4j-username">Username</Label>
                      <Input
                        id="neo4j-username"
                        placeholder="neo4j"
                        defaultValue=""
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="neo4j-password">Password</Label>
                      <Input
                        id="neo4j-password"
                        type="password"
                        placeholder="••••••••"
                        defaultValue=""
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Test Connection
                    </Button>
                    <Button size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Supabase Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  Supabase
                </CardTitle>
                <CardDescription>
                  Configure Supabase connection for structured data and
                  authentication
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="supabase-url">Project URL</Label>
                    <Input
                      id="supabase-url"
                      placeholder="https://your-project.supabase.co"
                      defaultValue=""
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supabase-anon-key">Anon Key</Label>
                    <Input
                      id="supabase-anon-key"
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      defaultValue=""
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supabase-service-key">
                      Service Role Key (Optional)
                    </Label>
                    <Input
                      id="supabase-service-key"
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      defaultValue=""
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Test Connection
                    </Button>
                    <Button size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vector Database Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Vector Database
                </CardTitle>
                <CardDescription>
                  Configure vector database for embeddings and semantic search
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vectordb-provider">Provider</Label>
                    <Input
                      id="vectordb-provider"
                      placeholder="chroma, qdrant, pinecone, or weaviate"
                      defaultValue="chroma"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vectordb-url">URL</Label>
                    <Input
                      id="vectordb-url"
                      placeholder="http://localhost:8000"
                      defaultValue=""
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vectordb-api-key">
                      API Key (if required)
                    </Label>
                    <Input
                      id="vectordb-api-key"
                      type="password"
                      placeholder="Optional for cloud providers"
                      defaultValue=""
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vectordb-collection">
                      Default Collection
                    </Label>
                    <Input
                      id="vectordb-collection"
                      placeholder="preprocessing_embeddings"
                      defaultValue="preprocessing_embeddings"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Test Connection
                    </Button>
                    <Button size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Colab Enterprise (Headless GPU Jobs) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  Colab Enterprise (Headless)
                </CardTitle>
                <CardDescription>
                  Configure Colab Enterprise for GPU notebooks/jobs (headless)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="colab-project">Project ID</Label>
                      <Input
                        id="colab-project"
                        placeholder="gcp-project-id"
                        value={colabConfig.projectId}
                        onChange={e =>
                          setColabConfig({
                            ...colabConfig,
                            projectId: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="colab-region">Region</Label>
                      <Input
                        id="colab-region"
                        placeholder="us-central1"
                        value={colabConfig.region}
                        onChange={e =>
                          setColabConfig({
                            ...colabConfig,
                            region: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="colab-runtime">Runtime template</Label>
                      <Input
                        id="colab-runtime"
                        placeholder="gpu-template-name"
                        value={colabConfig.runtimeTemplate}
                        onChange={e =>
                          setColabConfig({
                            ...colabConfig,
                            runtimeTemplate: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="colab-notebook">
                        Notebook path (optional)
                      </Label>
                      <Input
                        id="colab-notebook"
                        placeholder="gs://bucket/path/notebook.ipynb"
                        value={colabConfig.notebookPath}
                        onChange={e =>
                          setColabConfig({
                            ...colabConfig,
                            notebookPath: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="colab-sa">
                      Service account JSON (optional)
                    </Label>
                    <Input
                      id="colab-sa"
                      placeholder='{ "type": "service_account", ... }'
                      value={colabConfig.serviceAccountJson}
                      onChange={e =>
                        setColabConfig({
                          ...colabConfig,
                          serviceAccountJson: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="colab-sync">
                      Sync bucket / storage (optional)
                    </Label>
                    <Input
                      id="colab-sync"
                      placeholder="gs://bucket-or-r2-path"
                      value={colabConfig.syncBucket}
                      onChange={e =>
                        setColabConfig({
                          ...colabConfig,
                          syncBucket: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testColab.mutate(colabConfig)}
                      disabled={testColab.isPending}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Test Connection
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveColab.mutate(colabConfig)}
                      disabled={saveColab.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="routing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Task Routing Rules</CardTitle>
                <CardDescription>
                  Configure which providers handle which tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">Simple Tasks</p>
                      <Badge variant="secondary">Local First</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Sentiment analysis, keyword extraction, language
                      detection, classification
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
                      Short summarization, entity extraction, rewriting,
                      translation
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
                      Long summarization, deep analysis, code generation,
                      reasoning
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
                <CardDescription>
                  Platform configuration and status
                </CardDescription>
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
                    <Badge variant="outline" className="text-green-600">
                      Available
                    </Badge>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Content Store</span>
                    <Badge variant="outline" className="text-green-600">
                      Active
                    </Badge>
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
