/** @type {import('next').NextConfig} */
const isStatic = process.env.OUTPUT_MODE === "static";

const nextConfig = {
  reactStrictMode: true,
  output: isStatic ? "export" : "standalone",
  ...(isStatic
    ? {}
    : {
        async rewrites() {
          return [
            { source: "/api/:path*", destination: "http://localhost:8000/api/:path*" },
          ];
        },
      }),
};

module.exports = nextConfig;
