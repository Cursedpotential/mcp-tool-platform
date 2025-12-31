import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { trpc } from '@/lib/trpc';
import { 
  RefreshCw, 
  Download, 
  Search, 
  Filter,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Skull,
  Clock,
  Activity,
  Zap,
  Server,
  Database
} from 'lucide-react';
import { format } from 'date-fns';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const levelIcons: Record<LogLevel, React.ReactNode> = {
  debug: <Bug className="h-4 w-4 text-gray-400" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
  warn: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  fatal: <Skull className="h-4 w-4 text-red-700" />,
};

const levelColors: Record<LogLevel, string> = {
  debug: 'bg-gray-100 text-gray-700',
  info: 'bg-blue-100 text-blue-700',
  warn: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  fatal: 'bg-red-200 text-red-900',
};

export default function Logs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>(['info', 'warn', 'error', 'fatal']);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(2000);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: logs, refetch, isLoading } = trpc.logs.recent.useQuery({
    count: 200,
    filter: {
      levels: selectedLevels.length > 0 ? selectedLevels : undefined,
      search: searchQuery || undefined,
    },
  }, {
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const { data: metrics } = trpc.logs.metrics.useQuery(undefined, {
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const exportMutation = trpc.logs.export.useQuery({
    filter: {
      levels: selectedLevels.length > 0 ? selectedLevels : undefined,
      search: searchQuery || undefined,
    },
  }, {
    enabled: false,
  });

  const handleExport = async () => {
    const result = await exportMutation.refetch();
    if (result.data) {
      const blob = new Blob([result.data], { type: 'application/x-ndjson' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.ndjson`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const toggleLevel = (level: LogLevel) => {
    setSelectedLevels(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current && autoRefresh) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoRefresh]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Real-time Logs</h1>
            <p className="text-muted-foreground">
              Live log streaming with filtering and search
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'bg-green-50' : ''}
            >
              <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse text-green-500' : ''}`} />
              {autoRefresh ? 'Live' : 'Paused'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Connections</span>
                </div>
                <p className="text-2xl font-bold">{metrics.activeConnections}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Req/sec</span>
                </div>
                <p className="text-2xl font-bold">{metrics.requestsPerSecond.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Avg Latency</span>
                </div>
                <p className="text-2xl font-bold">{metrics.avgLatencyMs}ms</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Error Rate</span>
                </div>
                <p className="text-2xl font-bold">{(metrics.errorRate * 100).toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Queue Depth</span>
                </div>
                <p className="text-2xl font-bold">{metrics.queueDepth}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Cache Hit</span>
                </div>
                <p className="text-2xl font-bold">{(metrics.cacheHitRate * 100).toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Level Filters */}
              <div className="flex items-center gap-2">
                {(['debug', 'info', 'warn', 'error', 'fatal'] as LogLevel[]).map((level) => (
                  <label
                    key={level}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors ${
                      selectedLevels.includes(level) ? levelColors[level] : 'bg-gray-50 text-gray-400'
                    }`}
                  >
                    <Checkbox
                      checked={selectedLevels.includes(level)}
                      onCheckedChange={() => toggleLevel(level)}
                      className="hidden"
                    />
                    {levelIcons[level]}
                    <span className="text-xs font-medium capitalize">{level}</span>
                  </label>
                ))}
              </div>

              {/* Refresh Interval */}
              <Select
                value={refreshInterval.toString()}
                onValueChange={(v) => setRefreshInterval(parseInt(v))}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Refresh rate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">1 second</SelectItem>
                  <SelectItem value="2000">2 seconds</SelectItem>
                  <SelectItem value="5000">5 seconds</SelectItem>
                  <SelectItem value="10000">10 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Log Stream */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Log Stream</CardTitle>
            <CardDescription>
              {logs?.length || 0} entries • {autoRefresh ? 'Auto-refreshing' : 'Paused'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] rounded border" ref={scrollRef}>
              <div className="p-2 space-y-1 font-mono text-sm">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading logs...
                  </div>
                ) : logs && logs.length > 0 ? (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={`flex items-start gap-2 p-2 rounded hover:bg-muted/50 ${
                        log.level === 'error' || log.level === 'fatal' ? 'bg-red-50/50' : ''
                      }`}
                    >
                      {/* Timestamp */}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                      </span>

                      {/* Level */}
                      <Badge variant="outline" className={`${levelColors[log.level as LogLevel]} text-xs`}>
                        {levelIcons[log.level as LogLevel]}
                      </Badge>

                      {/* Category */}
                      <Badge variant="secondary" className="text-xs">
                        {log.category}
                      </Badge>

                      {/* Tool (if present) */}
                      {log.tool && (
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                          {log.tool}
                        </Badge>
                      )}

                      {/* Message */}
                      <span className="flex-1 break-all">{log.message}</span>

                      {/* Duration (if present) */}
                      {log.duration && (
                        <span className="text-xs text-muted-foreground">
                          {log.duration}ms
                        </span>
                      )}

                      {/* Trace ID (if present) */}
                      {log.traceId && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {log.traceId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No logs matching filters
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
