import { StackServerApp } from "@stackframe/js";

export const stackServerApp = new StackServerApp({
  tokenStore: "memory",

  // get your Stack Auth API keys from https://app.stack-auth.com
  publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  secretServerKey: process.env.STACK_SECRET_SERVER_KEY,
});
