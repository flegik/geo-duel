import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {VitePWA} from 'vite-plugin-pwa';
export default defineConfig({server:{allowedHosts:['terminal.local']},plugins:[react(),tailwindcss(),VitePWA({registerType:'prompt',injectRegister:false,includeAssets:['icon.svg','icon-192.png','icon-512.png','icon-maskable.png'],manifest:{name:'GeoDuel – Geografiequiz',short_name:'GeoDuel',description:'Deine Welt. Dein Tempo.',lang:'de',start_url:'/',scope:'/',display:'standalone',background_color:'#101827',theme_color:'#101827',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png'},{src:'/icon-maskable.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},workbox:{globPatterns:['**/*.{js,css,html,svg,png,woff2}'],maximumFileSizeToCacheInBytes:3000000,navigateFallback:'/index.html',navigateFallbackDenylist:[/^\/api/],cleanupOutdatedCaches:true}})]});
