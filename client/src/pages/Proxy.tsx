import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { 
  Plus, 
  Server, 
  RefreshCw, 
  Trash2, 
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Globe,
  Terminal,
  Wifi,
  Download,
  Wrench
} from 'lucide-react';

type ServerStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

const statusIcons: Record<ServerStatus, React.ReactNode> = {
  connected: <CheckCircle className="h-4 w-4 text-green-500" />,
  disconnected: <XCircle className="h-4 w-4 text-gray-400" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  connecting: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
};

const transportIcons: Record<string, React.ReactNode> = {
  http: <Globe className="h-4 w-4" />,
  websocket: <Wifi className="h-4 w-4" />,
  stdio: <Terminal className="h-4 w-4" />,
};

export default function Proxy() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newServer, setNewServer] = useState({
    name: '',
    description: '',
    transport: 'http' as 'http' | 'websocket' | 'stdio',
    endpoint: '',
    apiKey: '',
    enabled: true,
    priority: 50,
  });

  const utils = trpc.useUtils();
  const { data: servers, isLoading } = trpc.proxy.listServers.useQuery();
  const { data: aggregatedTools } = trpc.proxy.getAllTools.useQuery();

  const registerMutation = trpc.proxy.registerServer.useMutation({
    onSuccess: () => {
      toast.success('Server registered successfully');
      setIsAddDialogOpen(false);
      setNewServer({
        name: '',
        description: '',
        transport: 'http',
        endpoint: '',
        apiKey: '',
        enabled: true,
        priority: 50,
      });
      utils.proxy.listServers.invalidate();
      utils.proxy.getAllTools.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to register server: ${error.message}`);
    },
  });

  const unregisterMutation = trpc.proxy.unregisterServer.useMutation({
    onSuccess: () => {
      toast.success('Server removed');
      utils.proxy.listServers.invalidate();
      utils.proxy.getAllTools.invalidate();
    },
  });

  const refreshMutation = trpc.proxy.refreshServer.useMutation({
    onSuccess: () => {
      toast.success('Server refreshed');
      utils.proxy.listServers.invalidate();
      utils.proxy.getAllTools.invalidate();
    },
  });

  const handleAddServer = () => {
    if (!newServer.name || !newServer.endpoint) {
      toast.error('Name and endpoint are required');
      return;
    }
    registerMutation.mutate(newServer);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">MCP Server Proxy</h1>
            <p className="text-muted-foreground">
              Aggregate and manage multiple MCP servers from a single interface
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Server
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Register MCP Server</DialogTitle>
                <DialogDescription>
                  Add a remote MCP server to aggregate its tools
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder="my-mcp-server"
                    value={newServer.name}
                    onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="Optional description"
                    value={newServer.description}
                    onChange={(e) => setNewServer({ ...newServer, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Transport</Label>
                  <Select
                    value={newServer.transport}
                    onValueChange={(v) => setNewServer({ ...newServer, transport: v as 'http' | 'websocket' | 'stdio' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="http">HTTP</SelectItem>
                      <SelectItem value="websocket">WebSocket</SelectItem>
                      <SelectItem value="stdio">Stdio (local)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Endpoint</Label>
                  <Input
                    placeholder={newServer.transport === 'stdio' ? '/path/to/mcp-server' : 'https://api.example.com'}
                    value={newServer.endpoint}
                    onChange={(e) => setNewServer({ ...newServer, endpoint: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key (optional)</Label>
                  <Input
                    type="password"
                    placeholder="Bearer token or API key"
                    value={newServer.apiKey}
                    onChange={(e) => setNewServer({ ...newServer, apiKey: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enabled</Label>
                  <Switch
                    checked={newServer.enabled}
                    onCheckedChange={(checked) => setNewServer({ ...newServer, enabled: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddServer} disabled={registerMutation.isPending}>
                  {registerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Register
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Server className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{servers?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Registered Servers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {servers?.filter(s => s.status === 'connected').length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Connected</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Wrench className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{aggregatedTools?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Aggregated Tools</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Server List */}
        <Card>
          <CardHeader>
            <CardTitle>Registered Servers</CardTitle>
            <CardDescription>
              Manage your connected MCP servers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Loading servers...</p>
              </div>
            ) : servers && servers.length > 0 ? (
              <div className="space-y-4">
                {servers.map((server) => (
                  <div
                    key={server.config.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      {statusIcons[server.status as ServerStatus]}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{server.config.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {transportIcons[server.config.transport]}
                            <span className="ml-1">{server.config.transport}</span>
                          </Badge>
                          {!server.config.enabled && (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {server.config.endpoint}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{server.tools.length} tools</span>
                          {server.latencyMs && <span>{server.latencyMs}ms latency</span>}
                          {server.lastError && (
                            <span className="text-red-500">{server.lastError}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => refreshMutation.mutate({ id: server.config.id })}
                        disabled={refreshMutation.isPending}
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Remove this server?')) {
                            unregisterMutation.mutate({ id: server.config.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No servers registered</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first MCP server to start aggregating tools
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Server
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aggregated Tools */}
        {aggregatedTools && aggregatedTools.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Aggregated Tools</CardTitle>
              <CardDescription>
                All tools available through the proxy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {aggregatedTools.map((tool) => (
                  <div
                    key={tool.name}
                    className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Wrench className="h-4 w-4 text-purple-500" />
                      <span className="font-medium text-sm">{tool.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {tool.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
