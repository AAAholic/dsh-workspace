// Each fixture gets an immutable evidence directory and its actual source identity.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { readInstalled } from './helpers/read-installed-asar.mjs'

const root = path.resolve(import.meta.dirname, '..')
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex')
function filesIn(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? filesIn(file) : entry.isFile() ? [file] : []
  })
}

export function verificationOutput(suite, {hostInputs = {}} = {}) {
  if (!/^[a-z0-9-]+$/.test(suite)) throw new Error('Use a simple fixture suite name')
  const parent = process.env.DSH_VERIFICATION_DIR
    ? path.resolve(process.env.DSH_VERIFICATION_DIR)
    : path.resolve(root, 'verification/workspace-browser')
  fs.mkdirSync(parent, {recursive: true})
  // Explicit directories group one release's evidence. Refuse to overwrite it.
  const output = process.env.DSH_VERIFICATION_DIR ? path.join(parent, suite)
    : fs.mkdtempSync(path.join(parent, suite + '-'))
  if (process.env.DSH_VERIFICATION_DIR) fs.mkdirSync(output)
  const files = [...filesIn(path.join(root, 'lib')), ...filesIn(path.join(root, 'tests')),
    path.join(root, 'scripts/build.mjs'), path.join(root, 'package.json')].sort().map(file => ({
    file: path.relative(root, file), sha256: sha256(fs.readFileSync(file))
  }))
  const host = JSON.parse(readInstalled('package.json'))
  const manifest = {
    createdAt: new Date().toISOString(), suite,
    evidence: 'Isolated Chromium fixture with synthetic state; not native application acceptance.',
    sourceRoot: root, nodeVersion: process.version,
    host: {name: host.name, version: host.version},
    hostInputs: Object.fromEntries(Object.entries(hostInputs).map(([name, data]) => [name, sha256(data)])),
    files,
  }
  fs.writeFileSync(path.join(output, 'provenance.json'), JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'})
  return output
}
