import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 3000,
        allowedHosts: true
    },
    preview: {
        port: 3000,
        allowedHosts: true
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom'],
                    'utility-vendor': ['lodash', 'moment']
                },
            },
        },
        chunkSizeWarningLimit: 10000,
    },
})
