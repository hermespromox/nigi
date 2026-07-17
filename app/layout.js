import './globals.css'

export const metadata = {
  metadataBase: new URL(process.env.NIGI_SITE_URL || 'https://nigi.vercel.app'),
  title: 'Nigi — Know where your business belongs',
  description: 'Turn any commercial address into a decision-ready synthesis of footfall, demand, competition and opportunity.',
  openGraph: {
    title: 'Nigi — Know where your business belongs',
    description: 'A proprietary commercial synthesis for the location and concept you are considering.',
    type: 'website',
    siteName: 'Nigi',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nigi — Know where your business belongs',
    description: 'Footfall, demand, competition and opportunity—distilled into one clear decision.',
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
