import './globals.css'

export const metadata = {
  metadataBase: new URL(process.env.NIGI_SITE_URL || 'https://nigi.vercel.app'),
  title: 'Nigi — Know where your business belongs',
  description: 'Ask a natural-language question about a commercial location. Nigi interprets AskLizy KPIs and explains whether the site fits your business.',
  openGraph: {
    title: 'Nigi — Location intelligence, explained',
    description: 'Ask whether a location fits your business and get an evidence-based answer powered by AskLizy KPIs.',
    type: 'website',
    siteName: 'Nigi',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nigi — Know where your business belongs',
    description: 'Natural-language location intelligence powered by AskLizy KPIs.',
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
