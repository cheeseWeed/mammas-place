import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // The image-store originals are read from disk at request time by
  // /api/image-store/download/[id] (they live OUTSIDE public/ so they are not
  // URL-fetchable). Next's build tracer only follows STATIC imports, and that
  // route resolves its path at runtime — without this the files would be left
  // out of the deployed function and every download would 404 in prod while
  // working perfectly on localhost.
  outputFileTracingIncludes: {
    "/api/image-store/download/[id]": ["./assets/image-store/originals/**"],
  },
};

export default nextConfig;
