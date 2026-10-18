import assert from 'node:assert/strict'
import { hostPackage } from './helpers/read-installed-asar.mjs'

// Resolve the packaged host entry from its own HTML. Hashed asset names and
// minifier-local symbols are build identities, not cross-version contracts.
const html = hostPackage('dsh-web-frontend/dist/index.html')
const asset = html.match(/<script\b[^>]*\bsrc="\.\/(assets\/[A-Za-z0-9_-]+\.js)"/)
assert(asset, 'installed frontend entry must be explicit')
export const frontend = hostPackage('dsh-web-frontend/dist/' + asset[1])
const boot = /const [A-Za-z0-9_$]+=globalThis\.dshDesktopBoot\b/.exec(frontend)
const modules = frontend.match(/staticModules:([A-Za-z0-9_$]+)\(\)/)
assert(boot && modules && boot.index > 0, 'installed boot and static module boundaries must be explicit')
export function vendorPrelude(globalName) {
  assert(/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(globalName))
  return frontend.slice(0, boot.index) + `\nglobalThis.${globalName}=${modules[1]}();\n`
}
