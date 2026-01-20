// File: client/src/lib/trpc.ts | Date: 2026-01-11 | Agent: Claude Code | Model: Opus 4.1
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/api";

export const trpc = createTRPCReact<AppRouter>();
