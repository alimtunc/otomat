import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

/** Retries off so a refusal asserts immediately. */
export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/** A component under test that reads a query needs a client; pass one to share it across rerenders. */
export function withQueryClient(
  node: ReactNode,
  client: QueryClient = testQueryClient(),
): ReactNode {
  return createElement(QueryClientProvider, { client }, node);
}
