import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'

const localRequire = createRequire(import.meta.url)

function loadPlaywright() {
  try {
    return localRequire('playwright')
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error
    const externalModules = process.env.DSH_PLAYWRIGHT_MODULES
      || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json')
    const packagePath = path.resolve(externalModules)
    const externalRequire = createRequire(packagePath.endsWith('.json') ? packagePath : path.join(packagePath, 'package.json'))
    return externalRequire('playwright')
  }
}

export const { chromium } = loadPlaywright()
