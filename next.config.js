/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker uses the traced server; local builds continue to support next start.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  turbopack: { root: __dirname },
}

module.exports = nextConfig
