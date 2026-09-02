import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppRouter from './router'
import { AuthProvider } from './auth/AuthProvider'
import './index.css'

// Step 13: Configure Stale-While-Revalidate caching strategy
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes (data considered fresh)
      gcTime: 24 * 60 * 60 * 1000, // 24 hours (keep in garbage collection)
      retry: 1,
      refetchOnWindowFocus: false, // Don't spam API on mobile tab switches
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
