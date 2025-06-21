declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production';
    NGROK_URL?: string;
    SERVER_URL?: string;
  }
} 