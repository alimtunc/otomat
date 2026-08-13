import { permissionDiagnosisText } from "@web/lib/run/permission-diagnosis";
import { expect, it } from "vitest";

it("answers each of the four refusals differently, and never says autonomy was off", () => {
  expect(permissionDiagnosisText("unfrozen", "acceptEdits")).toMatch(/froze no permission mode/);
  expect(permissionDiagnosisText("unannounced", "auto")).toMatch(/execution host/);
  expect(permissionDiagnosisText("autonomous", "auto")).toMatch(/Autonomy was not lost/);
  expect(permissionDiagnosisText("supervised", "acceptEdits")).toMatch(
    /cannot approve one mid-run/,
  );
});
