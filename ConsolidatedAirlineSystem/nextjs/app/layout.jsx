import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'AirlineOps — Staff Portal',
  description: 'Airline staff management system',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{ duration: 3500, style: { borderRadius: '10px', fontSize: '14px' } }}
          />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
