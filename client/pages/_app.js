import './globals.css'
import type { ReactNode } from 'react'
import { useAuth } from '../src/auth-context'

function MyApp({ Component, pageProps }: { Component: React.ComponentType, pageProps: any }) {
  const { login, loginAdmin, logout } = useAuth()
  return <Component {...pageProps} />
}

export default MyApp