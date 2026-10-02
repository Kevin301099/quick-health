/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: false,
  reactStrictMode: true,
  devIndicators: false,
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
