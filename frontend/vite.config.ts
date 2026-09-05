import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const tunnelUrl = env.TUNNEL_URL ? new URL(env.TUNNEL_URL) : undefined
  const allowedHosts = tunnelUrl ? [tunnelUrl.hostname] : []
  const backendProxy: ProxyOptions = {
    target: env.BACKEND_URL || 'http://127.0.0.1:8000',
    // Preserve the browser host for Sanctum sessions and generated upload URLs.
    changeOrigin: false,
  }
  const proxy = Object.fromEntries(
    ['/api', '/sanctum', '/storage', '/up'].map((path) => [path, backendProxy]),
  )

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          navigateFallbackDenylist: [/^\/(api|sanctum|storage|up)(\/|$)/],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => /^\/(api|sanctum)(\/|$)/.test(url.pathname),
              handler: 'NetworkOnly',
            }
          ]
        },
        manifest: {
          name: 'MoneyPad',
          short_name: 'MoneyPad',
          description: 'Read and Write Stories',
          theme_color: '#16a34a',
          icons: []
        }
      })
    ],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      allowedHosts,
      proxy,
      ws: tunnelUrl ? {
        protocol: tunnelUrl.protocol === 'https:' ? 'wss' : 'ws',
        host: tunnelUrl.hostname,
        clientPort: Number(tunnelUrl.port || (tunnelUrl.protocol === 'https:' ? 443 : 80)),
      } : undefined,
    },
    preview: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      allowedHosts,
      proxy,
    },
  }
})
