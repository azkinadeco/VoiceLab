/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['msedge-tts'],
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@huggingface/transformers/**',
        'node_modules/onnxruntime-node/**',
        'node_modules/onnxruntime-web/**',
        'node_modules/sharp/**',
        'data/**',
      ],
    },
  },
  async headers() {
    return [
      {
        source: '/storage/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
