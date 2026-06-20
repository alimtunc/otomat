/// <reference types="vite/client" />

declare module "*.css";
declare module "@otomat/ui/styles.css";

interface ImportMetaEnv {
  readonly VITE_OTOMAT_DAEMON_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
