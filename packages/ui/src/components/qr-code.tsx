import type { QrModules } from "../lib/markdown";

const QUIET_ZONE = 4;
const MAX_MODULE_PX = 8;

/** Literal black on white: a phone camera needs the contrast, not the theme palette. */
export function QrCode({ modules }: { modules: QrModules }) {
  const size = modules.length + QUIET_ZONE * 2;
  const path = modules
    .flatMap((row, y) =>
      row.flatMap((dark, x) => (dark ? [`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`] : [])),
    )
    .join("");
  return (
    <svg
      role="img"
      aria-label="QR code"
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="block h-auto w-full"
      style={{ maxWidth: size * MAX_MODULE_PX }}
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
