import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',
  server: {
    port: 3000,
    open: '/index.html'
  },
  build: {
    rollupOptions: {
      input: {
        main:          resolve(__dirname, 'index.html'),
        notFound:      resolve(__dirname, '404.html'),
        auth:          resolve(__dirname, 'auth.html'),
        mfa:           resolve(__dirname, 'mfa.html'),
        onboarding:    resolve(__dirname, 'onboarding.html'),
        profileSetup:  resolve(__dirname, 'profile-setup.html'),
        dashboard:     resolve(__dirname, 'dashboard.html'),
        matches:       resolve(__dirname, 'matches.html'),
        profile:       resolve(__dirname, 'profile.html'),
        chat:          resolve(__dirname, 'chat.html'),
        restaurants:   resolve(__dirname, 'restaurants.html'),
        reservations:  resolve(__dirname, 'reservations.html'),
        notifications: resolve(__dirname, 'notifications.html'),
        browse:        resolve(__dirname, 'browse.html'),
        membership:    resolve(__dirname, 'membership.html'),
        adminLogin:    resolve(__dirname, 'admin-login.html'),
        admin:         resolve(__dirname, 'admin.html'),
      }
    }
  }
})
