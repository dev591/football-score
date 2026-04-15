import './globals.css'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-space-grotesk',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-inter',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})

export const metadata = {
  title: 'STRIKER - College Football Tournament Platform',
  description: 'College football tournament platform with live scoring and auction drafts',
}

import SmoothScroll from '@/components/SmoothScroll'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrains.variable} font-body bg-background text-on-surface antialiased`}>
        <SmoothScroll>
          {children}
        </SmoothScroll>
      </body>
    </html>
  )
}
