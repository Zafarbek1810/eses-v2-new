import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createDeviceLauncherMiddleware } from './server/deviceLauncher'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const deviceEnv = loadEnv(mode, path.resolve(__dirname, 'device'), '')
  const backendUrl = (env.VITE_API_BASE_URL || 'https://eses.uz/api').replace(/\/$/, '')
  const devicePort = Number(env.DEVICE_PORT || deviceEnv.DEVICE_PORT || 5180)

  const proxyPaths = ['/user', '/role', '/laboratory', '/baselaboratory', '/patient', '/region', '/analysis', '/baseanalysis', '/order', '/pattern', '/result', '/company', '/onlinestorage', '/globalstorage', '/plan', '/subscription'] as const
  const proxy = Object.fromEntries(
    proxyPaths.map(p => [p, { target: backendUrl, changeOrigin: true }]),
  )

  const deviceLauncher = command === 'serve'
    ? {
        name: 'device-launcher',
        configureServer(server: { middlewares: { use: (fn: ReturnType<typeof createDeviceLauncherMiddleware>) => void } }) {
          server.middlewares.use(createDeviceLauncherMiddleware({
            port: devicePort,
            deviceDir: path.resolve(__dirname, 'device'),
          }))
        },
      }
    : null

  return {
    plugins: [
      figmaAssetResolver(),
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
      ...(deviceLauncher ? [deviceLauncher] : []),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // Dev: frontend → Vite proxy → VITE_API_BASE_URL (.env)
      port: 5173,
      proxy,
    },
    preview: {
      // `vite preview` / serverda static build: xuddi shu proxy
      port: 4173,
      proxy,
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
