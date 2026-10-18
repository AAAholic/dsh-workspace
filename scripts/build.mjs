import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const result = await build({ absWorkingDir: root, entryPoints: [root + 'lib/client/index.mjs'], bundle: true, write: false,
  format: 'cjs', platform: 'browser', target: 'es2020', external: ['react', 'react-dom'], logLevel: 'silent' })
const code = `window.__ModuleLoader__.load({id:"dsh-workspace",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${result.outputFiles[0].text}\nreturn module.exports;}});\n`
const output = root + 'lib/client.js'
if (process.argv.includes('--check')) {
  if (await readFile(output, 'utf8') !== code) throw new Error('Client bundle is stale; run npm run build')
  console.log('dsh-workspace client bundle is current')
} else { await writeFile(output, code); console.log('Built dsh-workspace client bundle') }
