import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true, // 强制使用 5173，不准漂移
    cors: true, // 显式允许跨域
    /** 与浏览器地址栏一致；若用公网 IP / 域名 /隧道访问，请改为实际 URL（含端口） */
    origin: 'http://localhost:5173',
  },
});
