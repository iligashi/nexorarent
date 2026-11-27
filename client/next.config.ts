import type { NextConfig } from "next";

/**
 * API routing.
 *
 * When EXPRESS_API_URL is set, the browser calls the API on this site's own
 * origin (NEXT_PUBLIC_API_URL=/api/v1) and Next.js forwards each request to
 * the backend that owns the route. That keeps the refresh-token cookie
 * first-party and lets routes move from Express to the .NET API one group at
 * a time (see https://github.com/iligashi/nexorarent-api).
 *
 * When EXPRESS_API_URL is not set, no rewrites are added and the client calls
 * NEXT_PUBLIC_API_URL directly, as before.
 */
const expressApiUrl = process.env.EXPRESS_API_URL?.replace(/\/+$/, "");
const dotnetApiUrl = process.env.DOTNET_API_URL?.replace(/\/+$/, "");

/** Route groups under /api/v1 that the .NET API serves when DOTNET_API_URL is set. */
const DOTNET_ROUTE_GROUPS = ["cars", "locations", "extras", "blog", "auth"] as const;

function apiRewrites() {
  if (!expressApiUrl) return [];

  const dotnetRoutes = dotnetApiUrl
    ? DOTNET_ROUTE_GROUPS.flatMap((group) => [
        { source: `/api/v1/${group}`, destination: `${dotnetApiUrl}/api/v1/${group}` },
        { source: `/api/v1/${group}/:path*`, destination: `${dotnetApiUrl}/api/v1/${group}/:path*` },
      ])
    : [];

  return [
    ...dotnetRoutes,
    { source: "/api/v1/:path*", destination: `${expressApiUrl}/api/v1/:path*` },
    // Uploaded car images are served by Express.
    { source: "/uploads/:path*", destination: `${expressApiUrl}/uploads/:path*` },
  ];
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.unsplash.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'nexora-rent-production.up.railway.app' },
    ],
  },
  async rewrites() {
    return apiRewrites();
  },
};

export default nextConfig;
