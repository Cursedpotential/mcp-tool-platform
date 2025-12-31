import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { 
  Activity, 
  Zap, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  BarChart3,
  Cpu,
  Layers
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

export default function Stats() {
  const { user, loading: authLoading } = useAuth();
  const { data: dashboard, isLoading, refetch } = trpc.stats.dashboard.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
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
          <p className="text-muted-foreground">Please log in to view stats</p>
        </div>
      </DashboardLayout>
    );
  }

  const summary = dashboard?.summary || {
    totalCalls: 0,
    successRate: 0,
    avgLatency: 0,
    totalTokens: 0,
    totalCost: 0,
    activeTools: 0,
    activeProviders: 0,
  };

  const hourlyData = dashboard?.hourlyTrend?.map(h => ({
    time: new Date(h.hour).toLocaleTimeString([], { hour: '2-digit' }),
    calls: h.calls,
    successes: h.successes,
    failures: h.failures,
  })) || [];

  const topToolsData = dashboard?.topTools?.map(t => ({
    name: t.name.split('.').pop() || t.name,
    calls: t.calls,
    avgDuration: Math.round(t.avgDuration),
  })) || [];

  const providerData = dashboard?.providerStats?.map(p => ({
    name: p.provider,
    value: p.totalCalls,
    cost: p.totalCost,
  })) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Real-time tool usage and performance metrics</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalCalls.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {summary.activeTools} active tools
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(summary.successRate * 100).toFixed(1)}%</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-green-500" />
                Healthy
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(summary.avgLatency)}ms</div>
              <p className="text-xs text-muted-foreground">
                Across all tools
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${summary.totalCost.toFixed(4)}</div>
              <p className="text-xs text-muted-foreground">
                {summary.totalTokens.toLocaleString()} tokens used
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Hourly Trend */}
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>Hourly Activity</CardTitle>
                  <CardDescription>Tool calls over the last 24 hours</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))' 
                          }} 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="successes" 
                          stackId="1"
                          stroke="#22c55e" 
                          fill="#22c55e" 
                          fillOpacity={0.6}
                          name="Successes"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="failures" 
                          stackId="1"
                          stroke="#ef4444" 
                          fill="#ef4444" 
                          fillOpacity={0.6}
                          name="Failures"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Top Tools */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Tools</CardTitle>
                  <CardDescription>Most frequently used tools</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topToolsData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" className="text-xs" />
                        <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))' 
                          }} 
                        />
                        <Bar dataKey="calls" fill="#6366f1" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Provider Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Provider Usage</CardTitle>
                  <CardDescription>Distribution across LLM providers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {providerData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={providerData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {providerData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))' 
                            }} 
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No provider data yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tool Performance</CardTitle>
                <CardDescription>Detailed metrics for each tool</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {dashboard?.toolStats?.map((tool) => (
                      <div key={tool.toolName} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Layers className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{tool.toolName}</p>
                            <p className="text-sm text-muted-foreground">{tool.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <p className="font-medium">{tool.totalCalls}</p>
                            <p className="text-muted-foreground">Calls</p>
                          </div>
                          <div className="text-center">
                            <p className="font-medium text-green-500">
                              {((tool.successfulCalls / tool.totalCalls) * 100).toFixed(1)}%
                            </p>
                            <p className="text-muted-foreground">Success</p>
                          </div>
                          <div className="text-center">
                            <p className="font-medium">{Math.round(tool.avgDuration)}ms</p>
                            <p className="text-muted-foreground">Avg</p>
                          </div>
                          <div className="text-center">
                            <p className="font-medium">{Math.round(tool.p95Duration)}ms</p>
                            <p className="text-muted-foreground">P95</p>
                          </div>
                        </div>
                      </div>
                    )) || (
                      <p className="text-center text-muted-foreground py-8">No tool data yet</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="providers" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dashboard?.providerStats?.map((provider) => (
                <Card key={provider.provider}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium capitalize">{provider.provider}</CardTitle>
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Calls</span>
                        <span className="font-medium">{provider.totalCalls}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Success Rate</span>
                        <span className="font-medium text-green-500">
                          {((provider.successfulCalls / provider.totalCalls) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Latency</span>
                        <span className="font-medium">{Math.round(provider.avgLatency)}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tokens</span>
                        <span className="font-medium">{provider.totalTokens.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cost</span>
                        <span className="font-medium">${provider.totalCost.toFixed(4)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )) || (
                <p className="col-span-full text-center text-muted-foreground py-8">No provider data yet</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Errors</CardTitle>
                <CardDescription>Latest tool execution failures</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {dashboard?.errors?.map((error, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 border rounded-lg bg-destructive/5">
                        <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{error.tool}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(error.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm mt-1 text-muted-foreground truncate">{error.error}</p>
                        </div>
                      </div>
                    )) || (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mb-2 text-green-500" />
                        <p>No errors recorded</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
