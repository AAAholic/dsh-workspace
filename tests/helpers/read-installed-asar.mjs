import fs from 'node:fs'

export const archivePath = process.env.DSH_HOST_ASAR
  || '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar'
let archive, header, offset

export function readInstalled(relative) {
  if (!archive) {
    archive = fs.readFileSync(archivePath)
    header = JSON.parse(archive.subarray(16, 16 + archive.readUInt32LE(12)).toString())
    offset = 8 + archive.readUInt32LE(4)
  }
  let entry = header
  for (const segment of relative.split('/')) entry = entry.files?.[segment]
  if (!entry || entry.files) throw new Error('Missing installed source: ' + relative)
  return (entry.unpacked ? fs.readFileSync(archivePath + '.unpacked/' + relative)
    : archive.subarray(offset + Number(entry.offset), offset + Number(entry.offset) + entry.size)).toString()
}

export const hostPackage = relative => readInstalled('dsh/node_modules/@deepseek-ai/' + relative)
