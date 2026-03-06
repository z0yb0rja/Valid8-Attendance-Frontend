/// <reference types="vite/client" />

interface ImportMetaEnv {
    VITE_API_URL: string;
    readonly VITE_GMAPS_KEY: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }