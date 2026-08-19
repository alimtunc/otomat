import { vi } from "vitest";

export function stubLinuxPlatform(): void {
  vi.spyOn(process, "platform", "get").mockReturnValue("linux");
}
