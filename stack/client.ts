import { StackClientApp } from "@stackframe/js";
import { env } from "node:process";

export const stackClientApp = new StackClientApp({
  tokenStore: "cookie",

  // get your Stack Auth API keys from https://app.stack-auth.com and store them in a safe place (eg. environment variables)
  // get your Stack Auth API keys from https://app.stack-auth.com and store them in a safe place (eg. environment variables)
  publishableClientKey: env.process = 'NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY',
});
