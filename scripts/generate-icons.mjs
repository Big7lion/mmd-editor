import sharp from 'sharp';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

async function generateIcons() {
  const iconDir = join(process.cwd(), 'src-tauri', 'icons');
  
  // Create a sleek modern mermaid icon
  const size = 512;
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e1b4b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#4c1d95;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#22d3ee;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#a78bfa;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="${size}" height="${size}" rx="100" fill="url(#bg)"/>
      
      <!-- Abstract M shape as flowchart -->
      <path d="M100 380 L100 180 L180 280 L260 120 L260 380" 
            stroke="url(#accent)" stroke-width="32" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      
      <!-- Flowchart nodes -->
      <rect x="300" y="140" width="90" height="50" rx="10" fill="#22d3ee" opacity="0.9"/>
      <rect x="300" y="260" width="90" height="50" rx="25" fill="#a78bfa" opacity="0.9"/>
      <polygon points="345,380 300,320 390,320" fill="#f472b6" opacity="0.9"/>
      
      <!-- Connection lines -->
      <line x1="345" y1="190" x2="345" y2="260" stroke="#22d3ee" stroke-width="6" stroke-linecap="round"/>
      <line x1="345" y1="310" x2="345" y2="340" stroke="#a78bfa" stroke-width="6" stroke-linecap="round"/>
      
      <!-- Floating accent circles -->
      <circle cx="420" cy="150" r="8" fill="#22d3ee" opacity="0.7"/>
      <circle cx="420" cy="180" r="5" fill="#a78bfa" opacity="0.5"/>
      <circle cx="90" cy="120" r="12" fill="#f472b6" opacity="0.6"/>
      <circle cx="430" cy="400" r="15" fill="#22d3ee" opacity="0.4"/>
    </svg>
  `;

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();

  await mkdir(iconDir, { recursive: true });
  
  // Main icon.png
  await writeFile(join(iconDir, 'icon.png'), buffer);

  // Generate all required sizes
  const sizes = [16, 32, 128, 256, 512];
  
  for (const s of sizes) {
    const resized = await sharp(buffer).resize(s, s).png().toBuffer();
    if (s === 16) await writeFile(join(iconDir, '16x16.png'), resized);
    if (s === 32) {
      await writeFile(join(iconDir, '32x32.png'), resized);
      await writeFile(join(iconDir, 'Square40x40Logo.png'), resized);
    }
    if (s === 128) {
      await writeFile(join(iconDir, '128x128.png'), resized);
      await writeFile(join(iconDir, 'Square128x128Logo.png'), resized);
    }
    if (s === 256) {
      await writeFile(join(iconDir, '128x128@2x.png'), resized);
      await writeFile(join(iconDir, 'Square142x142Logo.png'), resized);
      await writeFile(join(iconDir, 'Square150x150Logo.png'), resized);
      await writeFile(join(iconDir, 'Square284x284Logo.png'), resized);
      await writeFile(join(iconDir, 'Square44x44Logo.png'), resized);
      await writeFile(join(iconDir, 'Square71x71Logo.png'), resized);
      await writeFile(join(iconDir, 'Square89x89Logo.png'), resized);
      await writeFile(join(iconDir, 'StoreLogo.png'), resized);
    }
  }

  // ICO for Windows
  const ico256 = await sharp(buffer).resize(256, 256).png().toBuffer();
  await writeFile(join(iconDir, 'icon.ico'), ico256);
  await writeFile(join(iconDir, 'icon.icns'), ico256);

  console.log('Icons generated successfully!');
}

generateIcons().catch(console.error);
