import type { NotificationCategory } from "@otomat/domain";
import { toast } from "@otomat/ui";

export type NotificationToast = typeof toast.info;

export const CATEGORY_TOAST = {
  permission: toast.warning,
  question: toast.warning,
  review: toast.info,
  completed: toast.success,
  blocked: toast.error,
} satisfies Record<NotificationCategory, NotificationToast>;
