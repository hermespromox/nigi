import './globals.css'

export const metadata = {
  metadataBase: new URL(process.env.NIGI_SITE_URL || 'https://nigi.vercel.app'),
  title: 'Nigi — Know where your business belongs',
  description: 'Ask a natural-language question about a commercial location. Nigi uses GPT-5.4 Mini to analyse Places API competitors, reviews and market signals.',
  openGraph: {
    title: 'Nigi — Location intelligence, explained',
    description: 'Ask whether a location fits your business and get a Places-first competitor and market analysis.',
    type: 'website',
    siteName: 'Nigi',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nigi — Know where your business belongs',
    description: 'Places-first location intelligence analysed by GPT-5.4 Mini.',
  },
  icons: { icon: '/icon.svg' },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
