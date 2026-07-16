import { createFileRoute } from "@tanstack/react-router";
import { ReviewsView } from "@web/components/reviews/reviews-view";

export const Route = createFileRoute("/reviews")({
  component: ReviewsView,
});
