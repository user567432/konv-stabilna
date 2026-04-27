/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Build ne sme da pukne zbog lint upozorenja — tipovi su već proverovani preko tsc.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
