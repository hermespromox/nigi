export function pdfDocumentTitle(locationLabel = '') {
  const safeLabel = String(locationLabel)
    .normalize('NFC')
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}._ -]+/gu, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)

  return safeLabel ? `Nigi-${safeLabel}` : 'Nigi-location-analysis'
}

export function exportVisualPdf({
  document = globalThis.document,
  browser = globalThis.window,
  locationLabel = '',
} = {}) {
  if (!document?.documentElement || typeof browser?.print !== 'function') {
    throw new Error('PDF export is only available in a browser.')
  }

  const root = document.documentElement
  const previousTitle = document.title
  root.classList.add('pdf-export-mode')
  document.title = pdfDocumentTitle(locationLabel)

  // Force the print-only layout to be calculated before the browser snapshots it.
  void document.body?.offsetHeight

  try {
    browser.print()
  } finally {
    document.title = previousTitle
    root.classList.remove('pdf-export-mode')
  }
}
