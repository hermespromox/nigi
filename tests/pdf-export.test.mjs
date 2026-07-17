import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const helperUrl = new URL('../lib/pdf-export.mjs', import.meta.url)
const page = fs.readFileSync(new URL('../app/page.js', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

test('visual PDF export module exists', () => {
  assert.equal(fs.existsSync(helperUrl), true, 'PDF export helper must exist')
})

test('analysis exposes an Export PDF control and a printable report boundary', () => {
  assert.match(page, /Export PDF/)
  assert.match(page, /pdf-report/)
  assert.match(page, /exportVisualPdf/)
})

test('print stylesheet isolates the analysis and preserves its colors', () => {
  assert.match(css, /@media print[\s\S]*pdf-export-mode[\s\S]*pdf-report/)
  assert.match(css, /print-color-adjust:\s*exact/)
  assert.match(css, /@page\s*\{[^}]*A4 portrait/s)
})

test('PDF helper creates a safe title, prints, and restores page state', async () => {
  assert.equal(fs.existsSync(helperUrl), true, 'PDF export helper must exist before import')
  const { exportVisualPdf, pdfDocumentTitle } = await import(helperUrl.href)
  assert.equal(pdfDocumentTitle('12 rue d’Alésia, Paris / Bakery'), 'Nigi-12-rue-dAlésia-Paris-Bakery')

  const classes = new Set()
  const document = {
    title: 'Nigi — analysis',
    body: { offsetHeight: 900 },
    documentElement: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
      },
    },
  }
  let printCalls = 0
  const browser = { print: () => { printCalls += 1 } }

  exportVisualPdf({ document, browser, locationLabel: '12 rue d’Alésia, Paris / Bakery' })

  assert.equal(printCalls, 1)
  assert.equal(document.title, 'Nigi — analysis')
  assert.equal(classes.has('pdf-export-mode'), false)
})
