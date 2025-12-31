import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Key, Plus, MoreHorizontal, Copy, RefreshCw, Trash2, Shield, Clock } from "lucide-react";

interface Permission {
  resource: string;
  actions: ('read' | 'write' | 'execute')[];
}

export default function ApiKeys() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<Permission[]>([
    { resource: 'tools', actions: ['read', 'execute'] },
  ]);
  const [newKeyExpiry, setNewKeyExpiry] = useState<number | undefined>(undefined);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: apiKeys, isLoading } = trpc.apiKeys.list.useQuery();

  const createMutation = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      setNewlyCreatedKey(data.plainKey);
      utils.apiKeys.list.invalidate();
      toast.success("API key created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create API key: ${error.message}`);
    },
  });

  const revokeMutation = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      utils.apiKeys.list.invalidate();
      toast.success("API key revoked");
    },
    onError: (error) => {
      toast.error(`Failed to revoke API key: ${error.message}`);
    },
  });

  const rotateMutation = trpc.apiKeys.rotate.useMutation({
    onSuccess: (data) => {
      if (data) setNewlyCreatedKey(data.plainKey);
      utils.apiKeys.list.invalidate();
      toast.success("API key rotated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to rotate API key: ${error.message}`);
    },
  });

  const handleCreate = () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }
    createMutation.mutate({
      name: newKeyName,
      permissions: newKeyPermissions,
      expiresInDays: newKeyExpiry,
    });
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("API key copied to clipboard");
  };

  const togglePermission = (resource: string, action: 'read' | 'write' | 'execute') => {
    setNewKeyPermissions((prev) => {
      const existing = prev.find((p) => p.resource === resource);
      if (existing) {
        const hasAction = existing.actions.includes(action);
        if (hasAction) {
          const newActions = existing.actions.filter((a) => a !== action);
          if (newActions.length === 0) {
            return prev.filter((p) => p.resource !== resource);
          }
          return prev.map((p) =>
            p.resource === resource ? { ...p, actions: newActions } : p
          );
        } else {
          return prev.map((p) =>
            p.resource === resource
              ? { ...p, actions: [...p.actions, action] }
              : p
          );
        }
      } else {
        return [...prev, { resource, actions: [action] }];
      }
    });
  };

  const hasPermission = (resource: string, action: 'read' | 'write' | 'execute') => {
    const perm = newKeyPermissions.find((p) => p.resource === resource);
    return perm?.actions.includes(action) || false;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">API Keys</h1>
            <p className="text-muted-foreground">
              Manage API keys for MCP client authentication
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New API Key</DialogTitle>
                <DialogDescription>
                  Generate a new API key for MCP client authentication
                </DialogDescription>
              </DialogHeader>

              {newlyCreatedKey ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                      Your new API key (copy it now, it won't be shown again):
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white dark:bg-black p-2 rounded font-mono break-all">
                        {newlyCreatedKey}
                      </code>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleCopyKey(newlyCreatedKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      setNewlyCreatedKey(null);
                      setNewKeyName("");
                      setIsCreateOpen(false);
                    }}
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="keyName">Key Name</Label>
                    <Input
                      id="keyName"
                      placeholder="e.g., Claude Desktop, My App"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Permissions</Label>
                    <div className="border rounded-lg p-3 space-y-3">
                      {['tools', 'config', 'admin'].map((resource) => (
                        <div key={resource} className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">{resource}</span>
                          <div className="flex gap-2">
                            {['read', 'write', 'execute'].map((action) => (
                              <label
                                key={action}
                                className="flex items-center gap-1 text-xs"
                              >
                                <Checkbox
                                  checked={hasPermission(resource, action as 'read' | 'write' | 'execute')}
                                  onCheckedChange={() =>
                                    togglePermission(resource, action as 'read' | 'write' | 'execute')
                                  }
                                />
                                {action}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expiry">Expires In (days, optional)</Label>
                    <Input
                      id="expiry"
                      type="number"
                      placeholder="Leave empty for no expiration"
                      value={newKeyExpiry || ""}
                      onChange={(e) =>
                        setNewKeyExpiry(e.target.value ? parseInt(e.target.value) : undefined)
                      }
                    />
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Create Key"}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Active API Keys
            </CardTitle>
            <CardDescription>
              API keys are used to authenticate MCP clients with your tool shop
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : !apiKeys || apiKeys.length === 0 ? (
              <div className="text-center py-8">
                <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No API keys yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first API key to connect MCP clients
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key Prefix</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {key.keyPrefix}...
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={key.isActive === 'true' ? "default" : "secondary"}>
                          {key.isActive === 'true' ? "Active" : "Revoked"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {key.lastUsedAt
                          ? new Date(key.lastUsedAt).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell>{key.usageCount} calls</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => rotateMutation.mutate({ id: key.id })}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Rotate Key
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => revokeMutation.mutate({ id: key.id })}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Revoke Key
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Security Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Best Practices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex gap-3">
                <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Set Expiration Dates</p>
                  <p className="text-sm text-muted-foreground">
                    Use expiring keys for temporary access or testing
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Minimal Permissions</p>
                  <p className="text-sm text-muted-foreground">
                    Only grant the permissions each client actually needs
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <RefreshCw className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Rotate Regularly</p>
                  <p className="text-sm text-muted-foreground">
                    Rotate keys periodically, especially after team changes
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Key className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Never Share Keys</p>
                  <p className="text-sm text-muted-foreground">
                    Create separate keys for each client or application
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
