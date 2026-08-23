import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const distributionDirectory = fileURLToPath(new URL('../dist/', import.meta.url))
const indexPath = path.join(distributionDirectory, 'index.html')

function resolveDistributionAsset(assetUrl) {
  const relativeAsset = assetUrl.replace(/^\//, '')
  const assetPath = path.resolve(distributionDirectory, relativeAsset)
  const relativePath = path.relative(distributionDirectory, assetPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`El recurso ${assetUrl} está fuera de la distribución.`)
  }

  return assetPath
}

let html = await readFile(indexPath, 'utf8')

const moduleScriptPattern =
  /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']([^"']+)["'])[^>]*><\/script>/
const stylesheetPattern =
  /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/

const moduleScript = html.match(moduleScriptPattern)
const stylesheet = html.match(stylesheetPattern)

if (!moduleScript || !stylesheet) {
  throw new Error('No se encontraron los recursos generados por Vite para incrustar.')
}

const javascript = (
  await readFile(resolveDistributionAsset(moduleScript[1]), 'utf8')
).replaceAll('</script', '<\\/script')
const css = (
  await readFile(resolveDistributionAsset(stylesheet[1]), 'utf8')
).replaceAll('</style', '<\\/style')

html = html
  .replace(
    moduleScript[0],
    () => `<script type="module">\n${javascript}\n</script>`,
  )
  .replace(stylesheet[0], () => `<style>\n${css}\n</style>`)

await writeFile(indexPath, html, 'utf8')

console.log('Frontend preparado como un único HTML autocontenido.')
