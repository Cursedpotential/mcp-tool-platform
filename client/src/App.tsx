import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Tools from "./pages/Tools";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";
import Config from "./pages/Config";
import Logs from "./pages/Logs";
import Proxy from "./pages/Proxy";
import Forks from "./pages/Forks";
import Wiki from "./pages/Wiki";
import ApiKeys from "./pages/ApiKeys";
import McpConfig from "./pages/McpConfig";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/tools"} component={Tools} />
      <Route path={"/stats"} component={Stats} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/config"} component={Config} />
      <Route path={"/logs"} component={Logs} />
      <Route path={"/proxy"} component={Proxy} />
      <Route path={"/forks"} component={Forks} />
      <Route path={"/wiki"} component={Wiki} />
      <Route path={"/api-keys"} component={ApiKeys} />
      <Route path={"/mcp-config"} component={McpConfig} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
