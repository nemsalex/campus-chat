// One-off PNG icon generator (no external deps) — draws a purple rounded
// square with a white chat-bubble glyph, used for the PWA manifest icons.
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = (() => {
    const t = []
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function buildPng(size, maskable) {
  const bg = [0x7e, 0x14, 0xff] // brand purple
  const white = [255, 255, 255]
  const pad = maskable ? Math.round(size * 0.2) : 0 // safe-zone margin for maskable icons
  const raw = Buffer.alloc(size * (1 + size * 4))

  const cx = size / 2
  const cy = size / 2 - size * 0.03
  const bubbleR = size * 0.28
  const tailLen = size * 0.14

  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const offset = y * (1 + size * 4) + 1 + x * 4
      const inSafe = x >= pad && x < size - pad && y >= pad && y < size - pad
      let r = bg[0], g = bg[1], b = bg[2], a = 255
      if (!inSafe) {
        a = 255
      } else {
        const dx = x - cx
        const dy = y - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        // triangular tail pointing down-left from the bubble, drawn via barycentric point-in-triangle test
        const p0x = cx - bubbleR * 0.55, p0y = cy + bubbleR * 0.68
        const p1x = cx - bubbleR * 0.05, p1y = cy + bubbleR * 0.92
        const p2x = cx - bubbleR * 0.35, p2y = cy + bubbleR * 1.35
        const d1 = (x - p1x) * (p0y - p1y) - (p0x - p1x) * (y - p1y)
        const d2 = (x - p2x) * (p1y - p2y) - (p1x - p2x) * (y - p2y)
        const d3 = (x - p0x) * (p2y - p0y) - (p2x - p0x) * (y - p0y)
        const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
        const hasPos = d1 > 0 || d2 > 0 || d3 > 0
        const inTail = !(hasNeg && hasPos)
        if (dist <= bubbleR || inTail) {
          r = white[0]; g = white[1]; b = white[2]
        }
      }
      raw[offset] = r
      raw[offset + 1] = g
      raw[offset + 2] = b
      raw[offset + 3] = a
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = zlib.deflateSync(raw)

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const outDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

fs.writeFileSync(path.join(outDir, 'icon-192.png'), buildPng(192, false))
fs.writeFileSync(path.join(outDir, 'icon-512.png'), buildPng(512, false))
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), buildPng(512, true))
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), buildPng(180, false))

console.log('icons written to', outDir)
