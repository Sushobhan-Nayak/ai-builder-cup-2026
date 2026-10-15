/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: "https://gembaos-gateway-100149412472.asia-southeast1.run.app/v1/:path*",
      },
    ];
  },
};

export default nextConfig;

