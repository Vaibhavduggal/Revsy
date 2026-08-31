import '../src/styles.css'
import '../src/styles-crm.css'
import { AuthProvider } from '../src/auth-context'
import { ShellProvider } from '../src/components/ShellContext'

export default function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <ShellProvider>
        <Component {...pageProps} />
      </ShellProvider>
    </AuthProvider>
  )
}