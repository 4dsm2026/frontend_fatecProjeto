/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",

  turbopack: {},

  eslint: {
    ignoreDuringBuilds: true,
  },

  // Encaminha ao backend somente após tentar as páginas do frontend.
  async rewrites() {
    const backend =
      process.env.BACKEND_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!backend) return [];

    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: "/:path*",
          destination: `${backend}/:path*`,
        },
      ],
    };
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;