// Generates public/og-image.png (1200x630 social share card).
// Run: node generate-og-image.mjs
import sharp from 'sharp'

const W = 1200, H = 630, BG = '#131615', ACCENT = '#0F9D8A'
const logo = await sharp('./public/logo.png').resize({ width: 980 }).toBuffer()
const { height: lh } = await sharp(logo).metadata()

const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect x="0" y="${H - 14}" width="${W}" height="14" fill="${ACCENT}"/>
  <text x="${W / 2}" y="${H - 110}" text-anchor="middle" font-family="Barlow, Arial Black, Helvetica, sans-serif"
        font-weight="900" font-size="58" fill="#F5F5F4" letter-spacing="1">Every Shop. Every Drop. Near You.</text>
  <text x="${W / 2}" y="${H - 58}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
        font-weight="600" font-size="28" fill="${ACCENT}">Card, comic &amp; collectibles shops near you</text>
</svg>`)

await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
  .composite([
    { input: logo, top: Math.round(40), left: Math.round((W - 980) / 2) },
    { input: overlay, top: 0, left: 0 },
  ])
  .png()
  .toFile('./public/og-image.png')
console.log('✅ public/og-image.png generated', lh)
