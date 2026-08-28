import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createHrLauncherMiddleware } from './server/deviceLauncher'

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
  const hikvisionEnv = loadEnv(mode, path.resolve(__dirname, 'Hikvision'), '')
  const backendUrl = (env.VITE_API_BASE_URL || 'https://eses.uz/api').replace(/\/$/, '')
  const hikvisionFrontendPort = Number(env.HIKVISION_FRONTEND_PORT || hikvisionEnv.HIKVISION_FRONTEND_PORT || 5175)
  const hikvisionBackendPort = Number(env.HIKVISION_BACKEND_PORT || hikvisionEnv.HIKVISION_BACKEND_PORT || 3001)

  const proxyPaths = ['/user', '/role', '/laboratory', '/baselaboratory', '/patient', '/region', '/analysis', '/baseanalysis', '/order', '/pattern', '/result', '/company', '/onlinestorage', '/globalstorage', '/plan', '/subscription'] as const
  const proxy = Object.fromEntries(
    proxyPaths.map(p => [p, { target: backendUrl, changeOrigin: true }]),
  )

  const hrLauncher = command === 'serve'
    ? {
        name: 'hr-launcher',
        configureServer(server: { middlewares: { use: (fn: ReturnType<typeof createHrLauncherMiddleware>) => void } }) {
          server.middlewares.use(createHrLauncherMiddleware({
            frontendPort: hikvisionFrontendPort,
            backendPort: hikvisionBackendPort,
            frontendDir: path.resolve(__dirname, 'Hikvision'),
            backendDir: path.resolve(__dirname, 'NodeJS_Hikvision'),
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
      ...(hrLauncher ? [hrLauncher] : []),
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
