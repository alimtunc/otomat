import { createContext, createElement, type ReactNode } from "react";

import { MarkdownMedia, type MarkdownMediaProps } from "./remote-media";

export type MarkdownMediaRenderer = (props: MarkdownMediaProps) => ReactNode;

/** A surface whose media needs its own transport (an authenticated proxy) swaps the renderer here. */
export const MarkdownMediaContext = createContext<MarkdownMediaRenderer>((props) =>
  createElement(MarkdownMedia, props),
);
