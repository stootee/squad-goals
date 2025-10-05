/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string
    // add more env vars here, e.g.:
    // readonly VITE_OTHER_KEY: string
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
  