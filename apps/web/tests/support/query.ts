import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export function withQueryClient(
  node: ReactNode,
  client: QueryClient = testQueryClient(),
): ReactNode {
  return createElement(QueryClientProvider, { client }, node);
}
