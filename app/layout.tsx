import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Appquiler',
  description: 'Gestión de alquileres comerciales y residenciales',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
