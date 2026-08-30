/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Configure alias for src directory
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': false,
    }
    return config
  },
  // Enable images optimization if needed
  images: {
    domains: [''],
  },
}

module.exports = nextConfig