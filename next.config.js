/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Local file: SDK — ensure Next/Turbopack compiles subpath exports.
  transpilePackages: ["@virtualiti-peru/universal-auth"],
  // Turbopack on Windows: absolute path aliases fail ("windows imports are not implemented yet").
  // Use POSIX-relative aliases to the copied package dist.
  turbopack: {
    resolveAlias: {
      "@virtualiti-peru/universal-auth/core":
        "./node_modules/@virtualiti-peru/universal-auth/dist/core/index.js",
      "@virtualiti-peru/universal-auth/next":
        "./node_modules/@virtualiti-peru/universal-auth/dist/next/index.js",
    },
  },
};

module.exports = nextConfig;
