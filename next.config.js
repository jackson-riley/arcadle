/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable when you add external screenshot images:
  // images: {
  //   remotePatterns: [
  //     { protocol: 'https', hostname: 'images.igdb.com' },
  //   ],
  // },
  experimental: {
    // QA pages use fs on public/screenshots*; without this, file tracing pulls every JPEG into
    // the serverless bundle and exceeds Vercel’s ~300MB function limit.
    outputFileTracingExcludes: {
      "**/*": [
        "public/screenshots/**/*",
        "public/screenshots-staging/**/*",
      ],
    },
  },
};

module.exports = nextConfig;
