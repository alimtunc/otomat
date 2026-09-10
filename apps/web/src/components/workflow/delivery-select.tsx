import {
  DELIVERY_EXPECTATIONS,
  isDeliveryExpectation,
  type DeliveryExpectation,
} from "@otomat/domain";
import { Field, FieldControl, FieldLabel, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { DELIVERY_EXPECTATION_COPY } from "@web/lib/workflow/delivery-copy";

export interface WorkflowDeliverySelectProps {
  value: DeliveryExpectation;
  onChange: (value: DeliveryExpectation) => void;
  /** Names which step this control belongs to, so a plan of several reads unambiguously. */
  label: string;
}

export function WorkflowDeliverySelect({ value, onChange, label }: WorkflowDeliverySelectProps) {
  return (
    <Field hint={DELIVERY_EXPECTATION_COPY[value].hint}>
      <FieldLabel>Delivery</FieldLabel>
      <FieldControl>
        <SegmentedControl
          type="single"
          value={value}
          onValueChange={(next) => {
            if (isDeliveryExpectation(next)) onChange(next);
          }}
          aria-label={`${label} delivery expectation`}
        >
          {DELIVERY_EXPECTATIONS.map((expectation) => (
            <SegmentedItem key={expectation} value={expectation}>
              {DELIVERY_EXPECTATION_COPY[expectation].label}
            </SegmentedItem>
          ))}
        </SegmentedControl>
      </FieldControl>
    </Field>
  );
}
