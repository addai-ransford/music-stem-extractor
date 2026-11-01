import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 3000,
        allowedHosts: true,
        proxy: {
            '/process': 'http://localhost:8000',
            '/stems': 'http://localhost:8000',
            '/chords': 'http://localhost:8000',
            '/audio': 'http://localhost:8000',
            '/download': 'http://localhost:8000',
            '/ws': { target: 'ws://localhost:8000', ws: true },
        }
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
