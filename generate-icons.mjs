import sharp from 'sharp';

const sizes = [192, 512];

for (const size of sizes) {
  await sharp('./public/san-benito-logo.jpg')
    .resize(size, size, { fit: 'cover', position: 'center' })
    .png({ quality: 95 })
    .toFile(`./public/icon-${size}.png`);
  console.log(`✅ icon-${size}.png generado (${size}x${size})`);
}

console.log('🎉 Iconos PWA listos');
