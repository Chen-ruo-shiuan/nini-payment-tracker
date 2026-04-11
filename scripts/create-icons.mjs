import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { deflateSync } from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(iconsDir, { recursive: true })

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function crc32(buf) {
  let crc = 0xFFFFFFFF
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    table[i] = c
  }
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type)
  const lenBuf = Buffer.allocUnsafe(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.allocUnsafe(4)
  const crcData = Buffer.concat([typeBytes, data])
  crcBuf.writeUInt32BE(crc32(crcData), 0)
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf])
}

for (const size of [192, 512]) {
  const ihdrData = Buffer.allocUnsafe(13)
  ihdrData.writeUInt32BE(size, 0)
  ihdrData.writeUInt32BE(size, 4)
  ihdrData[8] = 8; ihdrData[9] = 2; ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0

  const rowSize = 1 + size * 3
  const rawData = Buffer.allocUnsafe(size * rowSize)
  for (let y = 0; y < size; y++) {
    rawData[y * rowSize] = 0
    for (let x = 0; x < size; x++) {
      // Pink: #f9a8d4 = R249 G168 B212
      rawData[y * rowSize + 1 + x * 3 + 0] = 249
      rawData[y * rowSize + 1 + x * 3 + 1] = 168
      rawData[y * rowSize + 1 + x * 3 + 2] = 212
    }
  }

  const compressed = deflateSync(rawData)
  const png = Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdrData),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])

  writeFileSync(join(iconsDir, `icon-${size}x${size}.png`), png)
  console.log(`✅ icon-${size}x${size}.png created`)
}
