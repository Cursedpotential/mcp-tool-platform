import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PatternLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<any>(null);

  // TODO: Fetch patterns
  // const { data: patternsData, isLoading } = trpc.patterns.list.useQuery({
  //   page: 1,
  //   pageSize: 50,
  //   search: searchQuery,
  //   category: selectedCategory,
  // });

  // TODO: Fetch categories
  // const { data: categories } = trpc.patterns.getCategories.useQuery();

  // TODO: Fetch stats
  // const { data: stats } = trpc.patterns.getStats.useQuery();

  // TODO: Create mutations
  // const createPattern = trpc.patterns.create.useMutation();
  // const updatePattern = trpc.patterns.update.useMutation();
  // const deletePattern = trpc.patterns.delete.useMutation();
  // const testPattern = trpc.patterns.testPattern.useMutation();

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Pattern Library</h1>
          <p className="text-muted-foreground">
            Manage 256+ behavioral patterns for forensic analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Import Patterns</Button>
          <Button variant="outline">Export Patterns</Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>Add Pattern</Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">256</div>
            <p className="text-xs text-muted-foreground">
              Built-in + Custom
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custom Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              User-created
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18</div>
            <p className="text-xs text-muted-foreground">
              Gaslighting, DARVO, etc.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Severity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">6.8</div>
            <p className="text-xs text-muted-foreground">
              Out of 10
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search patterns by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="gaslighting">Gaslighting</SelectItem>
                <SelectItem value="darvo">DARVO</SelectItem>
                <SelectItem value="parental_alienation">Parental Alienation</SelectItem>
                <SelectItem value="substance_abuse">Substance Abuse</SelectItem>
                <SelectItem value="financial_control">Financial Control</SelectItem>
                {/* TODO: Populate from categories query */}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => {
              setSearchQuery("");
              setSelectedCategory(undefined);
            }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Patterns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Patterns</CardTitle>
          <CardDescription>
            Click a pattern to view details or edit
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* TODO: Add loading skeleton */}
          {/* TODO: Add empty state */}
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>MCL Factors</TableHead>
                <TableHead>Matches</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* TODO: Map over patternsData.patterns */}
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  TODO: Implement patterns table
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Pattern Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Pattern</DialogTitle>
            <DialogDescription>
              Create a custom behavioral pattern for forensic analysis
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Pattern Name</Label>
              <Input
                id="name"
                placeholder="e.g., Denial of Parenting Time"
                // TODO: Wire to state
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gaslighting">Gaslighting</SelectItem>
                  <SelectItem value="darvo">DARVO</SelectItem>
                  <SelectItem value="parental_alienation">Parental Alienation</SelectItem>
                  {/* TODO: Populate from categories */}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pattern">Regex Pattern</Label>
              <Textarea
                id="pattern"
                placeholder="e.g., (you can't see|not allowed|won't let you)"
                className="font-mono text-sm"
                // TODO: Wire to state
              />
              <p className="text-sm text-muted-foreground">
                Use regex syntax for pattern matching
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this pattern detects..."
                // TODO: Wire to state
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="severity">Severity (1-10)</Label>
                <Input
                  id="severity"
                  type="number"
                  min={1}
                  max={10}
                  defaultValue={5}
                  // TODO: Wire to state
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mclFactors">MCL Factors</Label>
                <Input
                  id="mclFactors"
                  placeholder="e.g., J, K"
                  // TODO: Wire to state
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="examples">Examples (one per line)</Label>
              <Textarea
                id="examples"
                placeholder="You can't see her this weekend&#10;I won't let you talk to him"
                rows={3}
                // TODO: Wire to state
              />
            </div>

            {/* Test Pattern Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Test Pattern</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  placeholder="Enter sample text to test pattern..."
                  rows={3}
                  // TODO: Wire to state
                />
                <Button variant="outline" size="sm">
                  Test Pattern
                </Button>
                {/* TODO: Show test results */}
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              // TODO: Call createPattern.mutate()
              toast("TODO: Implement pattern creation");
            }}>
              Add Pattern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pattern Dialog */}
      {/* TODO: Implement edit dialog (similar to add dialog but with existing data) */}
    </div>
  );
}
