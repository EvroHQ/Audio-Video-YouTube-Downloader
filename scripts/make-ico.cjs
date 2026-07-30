// Wraps a 256x256 PNG into a valid Windows .ico (PNG-compressed, Vista+).
const fs = require('fs')
const path = require('path')

const pngPath = path.join(__dirname, '..', 'resources', 'icon-256.png')
const icoPath = path.join(__dirname, '..', 'resources', 'icon.ico')

const png = fs.readFileSync(pngPath)

const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(1, 4) // image count

const entry = Buffer.alloc(16)
entry.writeUInt8(0, 0) // width  (0 => 256)
entry.writeUInt8(0, 1) // height (0 => 256)
entry.writeUInt8(0, 2) // palette count
entry.writeUInt8(0, 3) // reserved
entry.writeUInt16LE(1, 4) // color planes
entry.writeUInt16LE(32, 6) // bits per pixel
entry.writeUInt32LE(png.length, 8) // size of image data
entry.writeUInt32LE(6 + 16, 12) // offset of image data

fs.writeFileSync(icoPath, Buffer.concat([header, entry, png]))
console.log('Wrote', icoPath, '(' + (6 + 16 + png.length) + ' bytes)')
