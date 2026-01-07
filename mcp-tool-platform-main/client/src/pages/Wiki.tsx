import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Search, Book, FileText, ChevronRight, Home } from "lucide-react";
import { Streamdown } from "streamdown";

export default function Wiki() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>("overview");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: categories } = trpc.wiki.categories.useQuery();
  const { data: currentPage } = trpc.wiki.page.useQuery(
    { slug: selectedSlug || "" },
    { enabled: !!selectedSlug }
  );
  const { data: searchResults } = trpc.wiki.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 2 }
  );

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <div className="w-72 border-r bg-muted/30 flex flex-col">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {searchQuery.length > 2 && searchResults ? (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Search Results ({searchResults.length})
                  </h3>
                  <div className="space-y-1">
                    {searchResults.map((page) => (
                      <Button
                        key={page.slug}
                        variant={selectedSlug === page.slug ? "secondary" : "ghost"}
                        className="w-full justify-start text-left h-auto py-2"
                        onClick={() => {
                          setSelectedSlug(page.slug);
                          setSearchQuery("");
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2 shrink-0" />
                        <div className="truncate">
                          <div className="font-medium">{page.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {page.category}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                categories?.map((category) => (
                  <div key={category.name}>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Book className="h-4 w-4" />
                      {category.name}
                    </h3>
                    <div className="space-y-1 ml-6">
                      {category.pages.map((slug) => (
                        <Button
                          key={slug}
                          variant={selectedSlug === slug ? "secondary" : "ghost"}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setSelectedSlug(slug)}
                        >
                          <ChevronRight className="h-3 w-3 mr-1" />
                          {slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {currentPage ? (
            <div className="max-w-4xl mx-auto p-8">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => setSelectedSlug("overview")}
                >
                  <Home className="h-4 w-4" />
                </Button>
                <ChevronRight className="h-4 w-4" />
                <span>{currentPage.category}</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground">{currentPage.title}</span>
              </div>

              {/* Tags */}
              <div className="flex gap-2 mb-4">
                {currentPage.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Last Updated */}
              <p className="text-sm text-muted-foreground mb-6">
                Last updated: {currentPage.lastUpdated}
              </p>

              <Separator className="mb-8" />

              {/* Content */}
              <article className="prose prose-slate dark:prose-invert max-w-none">
                <Streamdown>{currentPage.content}</Streamdown>
              </article>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Card className="max-w-md">
                <CardHeader>
                  <CardTitle>Welcome to the Documentation</CardTitle>
                  <CardDescription>
                    Select a page from the sidebar to get started, or use the search to find what you're looking for.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="h-auto py-4 flex-col"
                      onClick={() => setSelectedSlug("quick-start")}
                    >
                      <FileText className="h-6 w-6 mb-2" />
                      Quick Start
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto py-4 flex-col"
                      onClick={() => setSelectedSlug("document-tools")}
                    >
                      <Book className="h-6 w-6 mb-2" />
                      Tool Catalog
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
