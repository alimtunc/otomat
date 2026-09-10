import { z } from "zod";

/** What a plan node's author declares its turn owes before a dependent may start. */
export const DELIVERY_EXPECTATIONS = ["standard", "implementation", "analysis"] as const;

export type DeliveryExpectation = (typeof DELIVERY_EXPECTATIONS)[number];

export const deliveryExpectationSchema = z.enum(DELIVERY_EXPECTATIONS);

export const DEFAULT_DELIVERY_EXPECTATION: DeliveryExpectation = "standard";

export function isDeliveryExpectation(value: string): value is DeliveryExpectation {
  return DELIVERY_EXPECTATIONS.some((expectation) => expectation === value);
}
