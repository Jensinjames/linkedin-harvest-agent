import { StackClientApp } from "@stackframe/js";
import { PrismaClient } from "@prisma/client";
import { withOptimize } from "@prisma/extension-optimize";

const prisma = new PrismaClient().$extends(
  withOptimize({ apiKey: process.env.OPTIMIZE_API_KEY })
)
export const stackClientApp = new StackClientApp({
  tokenStore: "cookie",

  // get your Stack Auth API keys from https://app.stack-auth.com and store them in a safe place (eg. environment variables)
  publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
});
