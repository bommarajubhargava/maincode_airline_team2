import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'SkyWave Air — Staff Portal',
  description: 'Airline staff management and scheduling system for SkyWave Air ground operations.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SkyWave Air',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    title: 'SkyWave Air — Staff Portal',
    description: 'Airline staff management and scheduling system',
  },
}

export const viewport = {
  themeColor: '#1e40af',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__installPrompt=e;});` }} />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" type="image/svg+xml" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SkyWave Air" />
      </head>
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
