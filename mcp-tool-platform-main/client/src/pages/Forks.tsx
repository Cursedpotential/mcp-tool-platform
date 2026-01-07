import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { 
  GitFork, 
  Plus, 
  Download, 
  Trash2, 
  Copy,
  Code,
  FileJson,
  Loader2,
  Sparkles,
  Puzzle,
  Zap,
  Box
} from 'lucide-react';
import { format } from 'date-fns';

type Platform = 'generic' | 'claude-mcp' | 'gemini-extension' | 'openai-function';

const platformInfo: Record<Platform, { name: string; icon: React.ReactNode; color: string }> = {
  'generic': { name: 'Generic MCP', icon: <Box className="h-4 w-4" />, color: 'bg-gray-100 text-gray-700' },
  'claude-mcp': { name: 'Claude MCP', icon: <Sparkles className="h-4 w-4" />, color: 'bg-orange-100 text-orange-700' },
  'gemini-extension': { name: 'Gemini Extension', icon: <Puzzle className="h-4 w-4" />, color: 'bg-blue-100 text-blue-700' },
  'openai-function': { name: 'OpenAI Function', icon: <Zap className="h-4 w-4" />, color: 'bg-green-100 text-green-700' },
};

export default function Forks() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedFork, setSelectedFork] = useState<string | null>(null);
  const [exportTab, setExportTab] = useState<'claude' | 'gemini' | 'openai'>('claude');
  const [newFork, setNewFork] = useState({
    parentToolName: '',
    platform: 'generic' as Platform,
    name: '',
    description: '',
  });

  const utils = trpc.useUtils();
  const { data: forks, isLoading } = trpc.fork.list.useQuery({});

  const createMutation = trpc.fork.create.useMutation({
    onSuccess: () => {
      toast.success('Fork created successfully');
      setIsCreateDialogOpen(false);
      setNewFork({
        parentToolName: '',
        platform: 'generic',
        name: '',
        description: '',
      });
      utils.fork.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to create fork: ${error.message}`);
    },
  });

  const deleteMutation = trpc.fork.delete.useMutation({
    onSuccess: () => {
      toast.success('Fork deleted');
      setSelectedFork(null);
      utils.fork.list.invalidate();
    },
  });

  const { data: claudeExport } = trpc.fork.exportClaudeMCP.useQuery(
    { id: selectedFork! },
    { enabled: !!selectedFork && exportTab === 'claude' }
  );

  const { data: geminiExport } = trpc.fork.exportGeminiExtension.useQuery(
    { id: selectedFork!, baseUrl: window.location.origin },
    { enabled: !!selectedFork && exportTab === 'gemini' }
  );

  const { data: openaiExport } = trpc.fork.exportOpenAIFunction.useQuery(
    { id: selectedFork! },
    { enabled: !!selectedFork && exportTab === 'openai' }
  );

  const handleCreate = () => {
    if (!newFork.parentToolName || !newFork.name) {
      toast.error('Parent tool and name are required');
      return;
    }
    createMutation.mutate(newFork);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedForkData = forks?.find(f => f.id === selectedFork);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tool Forks</h1>
            <p className="text-muted-foreground">
              Create custom versions of tools and export for different platforms
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Fork
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Tool Fork</DialogTitle>
                <DialogDescription>
                  Create a customized version of an existing tool
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Parent Tool</Label>
                  <Input
                    placeholder="e.g., nlp.extract_entities"
                    value={newFork.parentToolName}
                    onChange={(e) => setNewFork({ ...newFork, parentToolName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fork Name</Label>
                  <Input
                    placeholder="my_custom_extractor"
                    value={newFork.name}
                    onChange={(e) => setNewFork({ ...newFork, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="What does this fork do differently?"
                    value={newFork.description}
                    onChange={(e) => setNewFork({ ...newFork, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Platform</Label>
                  <Select
                    value={newFork.platform}
                    onValueChange={(v) => setNewFork({ ...newFork, platform: v as Platform })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(platformInfo).map(([key, info]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            {info.icon}
                            {info.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Fork
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Platform Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(platformInfo).map(([key, info]) => {
            const count = forks?.filter(f => f.platform === key).length || 0;
            return (
              <Card key={key}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${info.color}`}>
                      {info.icon}
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-sm text-muted-foreground">{info.name}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fork List */}
          <Card>
            <CardHeader>
              <CardTitle>Your Forks</CardTitle>
              <CardDescription>
                Click a fork to view export options
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : forks && forks.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {forks.map((fork) => (
                      <div
                        key={fork.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedFork === fork.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedFork(fork.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GitFork className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{fork.name}</span>
                          </div>
                          <Badge className={platformInfo[fork.platform as Platform].color}>
                            {platformInfo[fork.platform as Platform].name}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {fork.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>v{fork.version}</span>
                          <span>from {fork.parentId}</span>
                          <span>{format(new Date(fork.createdAt), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12">
                  <GitFork className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No forks yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first tool fork to customize and export
                  </p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Fork
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Export Options</CardTitle>
              <CardDescription>
                {selectedForkData 
                  ? `Export "${selectedForkData.name}" for different platforms`
                  : 'Select a fork to view export options'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedFork && selectedForkData ? (
                <div className="space-y-4">
                  <Tabs value={exportTab} onValueChange={(v) => setExportTab(v as 'claude' | 'gemini' | 'openai')}>
                    <TabsList className="grid grid-cols-3">
                      <TabsTrigger value="claude">
                        <Sparkles className="h-4 w-4 mr-1" />
                        Claude
                      </TabsTrigger>
                      <TabsTrigger value="gemini">
                        <Puzzle className="h-4 w-4 mr-1" />
                        Gemini
                      </TabsTrigger>
                      <TabsTrigger value="openai">
                        <Zap className="h-4 w-4 mr-1" />
                        OpenAI
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="claude" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Claude MCP Manifest</h4>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => claudeExport && copyToClipboard(JSON.stringify(claudeExport, null, 2))}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => claudeExport && downloadJson(claudeExport, `${selectedForkData.name}-claude-mcp.json`)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                      <ScrollArea className="h-[250px] border rounded p-3">
                        <pre className="text-xs font-mono">
                          {claudeExport ? JSON.stringify(claudeExport, null, 2) : 'Loading...'}
                        </pre>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="gemini" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Gemini Extension Manifest</h4>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => geminiExport && copyToClipboard(JSON.stringify(geminiExport, null, 2))}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => geminiExport && downloadJson(geminiExport, `${selectedForkData.name}-gemini-extension.json`)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                      <ScrollArea className="h-[250px] border rounded p-3">
                        <pre className="text-xs font-mono">
                          {geminiExport ? JSON.stringify(geminiExport, null, 2) : 'Loading...'}
                        </pre>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="openai" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">OpenAI Function Definition</h4>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openaiExport && copyToClipboard(JSON.stringify(openaiExport, null, 2))}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openaiExport && downloadJson(openaiExport, `${selectedForkData.name}-openai-function.json`)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                      <ScrollArea className="h-[250px] border rounded p-3">
                        <pre className="text-xs font-mono">
                          {openaiExport ? JSON.stringify(openaiExport, null, 2) : 'Loading...'}
                        </pre>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>

                  <div className="flex justify-end pt-4 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this fork?')) {
                          deleteMutation.mutate({ id: selectedFork });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Fork
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileJson className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a fork from the list to view export options</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
