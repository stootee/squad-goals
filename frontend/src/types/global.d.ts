export {};

declare global {
  interface Window {
    APP_CONFIG: {
      API_URL: string;
      FRONTEND_URL: string;
    };
  }
}
