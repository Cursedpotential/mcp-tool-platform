import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { mcpGatewayRouter } from "./mcp/gateway";

export const appRouter = router({
  // System and auth routes
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // MCP Gateway API - Token-efficient tool orchestration
  // Endpoints: searchTools, describeTool, invokeTool, getRef
  mcp: mcpGatewayRouter,
});

export type AppRouter = typeof appRouter;
