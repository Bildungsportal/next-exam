/**
 * Dieser Worker wird auf nicht‑Linux Systemen verwendet.
 * Er nutzt die sharp Bibliothek, um Bilder zu verarbeiten.
 */

process.env.VIPS_CONCURRENCY = '1';
import sharp from 'sharp';
import { parentPort } from 'worker_threads';

sharp.cache({ memory: 50, files: 0, items: 0 });

parentPort.on('message', async (message) => {
  try {
    const imgBuffer = Buffer.from(message.imgBuffer);
    const image = sharp(imgBuffer);
    const metadata = await image.metadata();
    const cropWidth = metadata.width < 1024 ? metadata.width : 1024;
    
    const [resizedBuffer, headerBuffer] = await Promise.all([
      image.clone().resize({ width: 1024 }).toBuffer(),
      image.clone().extract({ left: 0, top: 0, width: cropWidth, height: 100 }).toBuffer()
    ]);

    const headerRaw = await sharp(headerBuffer).raw().toBuffer();
    let isAllBlack = true;
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const offset = (y * cropWidth + x) * 4;
        if (headerRaw[offset] !== 0 || headerRaw[offset + 1] !== 0 || headerRaw[offset + 2] !== 0) {
          isAllBlack = false;
          break;
        }
      }
      if (!isAllBlack) break;
    }
    
    if (image) { image.destroy(); }

    parentPort.postMessage({
      success: true,
      screenshotBase64: resizedBuffer.toString('base64'),
      headerBase64: headerBuffer.toString('base64'),
      isblack: isAllBlack,
      imgBuffer
    });
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
});
