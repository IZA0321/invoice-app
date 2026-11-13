import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "@sparticuz/chromium", "puppeteer-core"],
  // サーバー側PDF生成（ヘッドレスChrome）の本体を関数に同梱する
  outputFileTracingIncludes: {
    "/api/documents/create": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
