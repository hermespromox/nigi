import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const pageSource = fs.readFileSync(new URL('../app/page.js', import.meta.url), 'utf8')
const cssSource = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

test('advice cards use Google Material Symbols instead of Unicode placeholders', () => {
  assert.match(cssSource, /family=Material\+Symbols\+Rounded/)
  assert.match(cssSource, /\.material-symbols-rounded/)

  for (const icon of ['monitoring', 'storefront', 'lightbulb', 'route']) {
    assert.match(pageSource, new RegExp(`<span className="material-symbols-rounded" aria-hidden="true">${icon}<\\/span>`))
  }

  assert.doesNotMatch(pageSource, /<div className="advice-title"><span>[◎↗◇→]<\/span>/)
})
