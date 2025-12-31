import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { 
  FileText,
  Brain,
  BookOpen,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  Search,
  Tag,
  AlertTriangle
} from "lucide-react";

export default function Config() {
  const { user, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [newPatternOpen, setNewPatternOpen] = useState(false);
  const [newBehaviorOpen, setNewBehaviorOpen] = useState(false);
  
  const { data: patterns, isLoading: patternsLoading, refetch: refetchPatterns } = trpc.config.listPatterns.useQuery();
  const { data: behaviors, isLoading: behaviorsLoading, refetch: refetchBehaviors } = trpc.config.listBehaviors.useQuery();
  const { data: dictionaries, isLoading: dictionariesLoading, refetch: refetchDictionaries } = trpc.config.listDictionaries.useQuery();
  const { data: configExport } = trpc.config.exportAll.useQuery();

  const createPatternMutation = trpc.config.createPattern.useMutation({
    onSuccess: () => {
      toast.success('Pattern created');
      setNewPatternOpen(false);
      refetchPatterns();
    },
    onError: (err) => toast.error(err.message),
  });

  const deletePatternMutation = trpc.config.deletePattern.useMutation({
    onSuccess: () => {
      toast.success('Pattern deleted');
      refetchPatterns();
    },
    onError: (err) => toast.error(err.message),
  });

  const createBehaviorMutation = trpc.config.createBehavior.useMutation({
    onSuccess: () => {
      toast.success('Behavior definition created');
      setNewBehaviorOpen(false);
      refetchBehaviors();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteBehaviorMutation = trpc.config.deleteBehavior.useMutation({
    onSuccess: () => {
      toast.success('Behavior deleted');
      refetchBehaviors();
    },
    onError: (err) => toast.error(err.message),
  });

  const isLoading = authLoading || patternsLoading || behaviorsLoading || dictionariesLoading;

  if (isLoading) {
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
          <p className="text-muted-foreground">Please log in to access configuration</p>
        </div>
      </DashboardLayout>
    );
  }

  const handleExport = () => {
    if (configExport) {
      const blob = new Blob([JSON.stringify(configExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mcp-definitions-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Definitions exported');
    }
  };

  const filteredPatterns = patterns?.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredBehaviors = behaviors?.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.category.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Definitions & Patterns</h1>
            <p className="text-muted-foreground">Manage search patterns, behavioral definitions, and custom dictionaries</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export All
            </Button>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patterns, behaviors, dictionaries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs defaultValue="patterns" className="space-y-4">
          <TabsList>
            <TabsTrigger value="patterns" className="gap-2">
              <FileText className="h-4 w-4" />
              Patterns ({patterns?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="behaviors" className="gap-2">
              <Brain className="h-4 w-4" />
              Behaviors ({behaviors?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="dictionaries" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Dictionaries ({dictionaries?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Patterns Tab */}
          <TabsContent value="patterns" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Regex, keyword, and phrase patterns for text matching and extraction
              </p>
              <Dialog open={newPatternOpen} onOpenChange={setNewPatternOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Pattern
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Pattern Definition</DialogTitle>
                    <DialogDescription>
                      Define a new pattern set for text matching
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    createPatternMutation.mutate({
                      name: formData.get('name') as string,
                      description: formData.get('description') as string,
                      category: formData.get('category') as string,
                      patterns: [{
                        type: formData.get('patternType') as 'regex' | 'keyword' | 'phrase' | 'semantic',
                        value: formData.get('patternValue') as string,
                        weight: 1,
                      }],
                    });
                  }}>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input id="name" name="name" placeholder="e.g., Email Addresses" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category">Category</Label>
                          <Input id="category" name="category" placeholder="e.g., contact-info" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" name="description" placeholder="What this pattern matches..." />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="patternType">Pattern Type</Label>
                          <Select name="patternType" defaultValue="regex">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="regex">Regex</SelectItem>
                              <SelectItem value="keyword">Keyword</SelectItem>
                              <SelectItem value="phrase">Phrase</SelectItem>
                              <SelectItem value="semantic">Semantic</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="patternValue">Pattern Value</Label>
                          <Input id="patternValue" name="patternValue" placeholder="[a-z]+@[a-z]+\.[a-z]+" required />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={createPatternMutation.isPending}>
                        {createPatternMutation.isPending ? 'Creating...' : 'Create Pattern'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredPatterns.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No patterns defined yet</p>
                      <Button variant="link" onClick={() => setNewPatternOpen(true)}>
                        Create your first pattern
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  filteredPatterns.map((pattern) => (
                    <Card key={pattern.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{pattern.name}</CardTitle>
                            <Badge variant="outline">{pattern.category}</Badge>
                            {!pattern.enabled && <Badge variant="secondary">Disabled</Badge>}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => deletePatternMutation.mutate({ id: pattern.id })}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {pattern.description && (
                          <CardDescription>{pattern.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {pattern.patterns.map((p, i) => (
                            <Badge key={i} variant="secondary" className="font-mono text-xs">
                              {p.type}: {p.value.length > 40 ? p.value.slice(0, 40) + '...' : p.value}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Behaviors Tab */}
          <TabsContent value="behaviors" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Behavioral analysis definitions with indicators and thresholds
              </p>
              <Dialog open={newBehaviorOpen} onOpenChange={setNewBehaviorOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Behavior
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Behavioral Definition</DialogTitle>
                    <DialogDescription>
                      Define indicators and thresholds for behavioral analysis
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    createBehaviorMutation.mutate({
                      name: formData.get('name') as string,
                      description: formData.get('description') as string,
                      category: formData.get('category') as string,
                      indicators: [{
                        name: formData.get('indicatorName') as string,
                        type: formData.get('indicatorType') as 'keyword' | 'pattern' | 'sentiment' | 'frequency' | 'context',
                        value: (formData.get('indicatorValue') as string).split(',').map(s => s.trim()),
                        weight: 1,
                        polarity: formData.get('polarity') as 'positive' | 'negative' | 'neutral',
                      }],
                      thresholds: {
                        low: parseFloat(formData.get('thresholdLow') as string) || 0.3,
                        medium: parseFloat(formData.get('thresholdMedium') as string) || 0.6,
                        high: parseFloat(formData.get('thresholdHigh') as string) || 0.8,
                      },
                    });
                  }}>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input id="name" name="name" placeholder="e.g., Urgency Detection" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category">Category</Label>
                          <Input id="category" name="category" placeholder="e.g., sentiment" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" name="description" placeholder="What this behavior detects..." />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="indicatorName">Indicator Name</Label>
                          <Input id="indicatorName" name="indicatorName" placeholder="e.g., urgent_words" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="indicatorType">Type</Label>
                          <Select name="indicatorType" defaultValue="keyword">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="keyword">Keyword</SelectItem>
                              <SelectItem value="pattern">Pattern</SelectItem>
                              <SelectItem value="sentiment">Sentiment</SelectItem>
                              <SelectItem value="frequency">Frequency</SelectItem>
                              <SelectItem value="context">Context</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="polarity">Polarity</Label>
                          <Select name="polarity" defaultValue="neutral">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="positive">Positive</SelectItem>
                              <SelectItem value="negative">Negative</SelectItem>
                              <SelectItem value="neutral">Neutral</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="indicatorValue">Keywords/Patterns (comma-separated)</Label>
                        <Input id="indicatorValue" name="indicatorValue" placeholder="urgent, asap, immediately, critical" required />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="thresholdLow">Low Threshold</Label>
                          <Input id="thresholdLow" name="thresholdLow" type="number" step="0.1" defaultValue="0.3" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="thresholdMedium">Medium Threshold</Label>
                          <Input id="thresholdMedium" name="thresholdMedium" type="number" step="0.1" defaultValue="0.6" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="thresholdHigh">High Threshold</Label>
                          <Input id="thresholdHigh" name="thresholdHigh" type="number" step="0.1" defaultValue="0.8" />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={createBehaviorMutation.isPending}>
                        {createBehaviorMutation.isPending ? 'Creating...' : 'Create Behavior'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredBehaviors.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No behavioral definitions yet</p>
                      <Button variant="link" onClick={() => setNewBehaviorOpen(true)}>
                        Create your first behavior
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  filteredBehaviors.map((behavior) => (
                    <Card key={behavior.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{behavior.name}</CardTitle>
                            <Badge variant="outline">{behavior.category}</Badge>
                            {!behavior.enabled && <Badge variant="secondary">Disabled</Badge>}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => deleteBehaviorMutation.mutate({ id: behavior.id })}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {behavior.description && (
                          <CardDescription>{behavior.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {behavior.indicators.map((ind, i) => (
                              <Badge key={i} variant="secondary">
                                {ind.name} ({ind.type})
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>Low: {behavior.thresholds.low}</span>
                            <span>Medium: {behavior.thresholds.medium}</span>
                            <span>High: {behavior.thresholds.high}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Dictionaries Tab */}
          <TabsContent value="dictionaries" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Custom dictionaries for domain-specific terminology and synonyms
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Dictionary
              </Button>
            </div>

            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {dictionaries?.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No dictionaries defined yet</p>
                      <Button variant="link">Create your first dictionary</Button>
                    </CardContent>
                  </Card>
                ) : (
                  dictionaries?.map((dict) => (
                    <Card key={dict.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{dict.name}</CardTitle>
                            <Badge variant="outline">{dict.language}</Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {dict.description && (
                          <CardDescription>{dict.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {dict.entries.length} entries
                        </p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
