import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'

// Build public/icon.svg from the red "O" of the existing wordmark (public/logo.png)
// on the theme background, then rasterize the PNG sizes from it.
const crop = await sharp('./public/logo.png').extract({ left: 440, top: 0, width: 192, height: 614 }).png().toBuffer()
const O = await sharp(crop).trim().png().toBuffer()
const { width: ow, height: oh } = await sharp(O).metadata()
const target = 400 // glyph height inside a 512 canvas
const gw = Math.round(ow * target / oh)
const glyph = (await sharp(O).resize({ height: target }).png().toBuffer()).toString('base64')
writeFileSync('./public/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#131615"/>
  <image x="${(512 - gw) / 2}" y="${(512 - target) / 2}" width="${gw}" height="${target}" href="data:image/png;base64,${glyph}" xlink:href="data:image/png;base64,${glyph}"/>
</svg>
`)

const svg = readFileSync('./public/icon.svg')

await sharp(svg).resize(180, 180).png().toFile('./public/icon-180.png')
await sharp(svg).resize(192, 192).png().toFile('./public/icon-192.png')
await sharp(svg).resize(512, 512).png().toFile('./public/icon-512.png')

console.log('✅ Icons generated: icon.svg, icon-180.png, icon-192.png and icon-512.png')
