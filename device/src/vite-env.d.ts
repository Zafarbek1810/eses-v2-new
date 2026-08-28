/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HIKVISION_HOST?: string;
  readonly VITE_HIKVISION_USER?: string;
  readonly VITE_HIKVISION_PASSWORD?: string;
  readonly VITE_WORK_START_HOUR?: string;
  readonly VITE_WORK_START_MINUTE?: string;
  readonly VITE_EXPECTED_EMPLOYEES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
