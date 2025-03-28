/**
 * dieser Worker wird nur auf Windows und MacOS verwendet
 * er nutzt die sharp Bibliothek um die Bilder zu verarbeiten
 */

process.env.VIPS_CONCURRENCY = '1';
import sharp from 'sharp';
sharp.cache({ memory: 50, files: 0, items: 0 });




// Globale Error Handler
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.send({ success: false, error: error.message });
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    process.send({ success: false, error: String(reason) });
});

process.on('message', async (message) => {
    try {
        console.log('Received message');
        const { imgBuffer } = message;
        const buffer = Buffer.from(imgBuffer);

        let image;
        try {
            image = sharp(buffer);
            const metadata = await image.metadata();
            
            const cropWidth = metadata.width < 1024 ? metadata.width : 1024;

            const [resizedBuffer, headerBuffer] = await Promise.all([
                image.clone()
                    .resize({ width: 1024 })
                    .toBuffer(),
                image.clone()
                    .extract({ left: 0, top: 0, width: cropWidth, height: 100 })
                    .toBuffer()
            ]);
     
            const headerRaw = await sharp(headerBuffer).raw().toBuffer();
            let isAllBlack = true;  //just check the first 10x10 pixels
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



            const screenshotBase64 = resizedBuffer.toString('base64');
            const headerBase64 = headerBuffer.toString('base64');
            
            process.send({
                success: true,
                screenshotBase64,
                headerBase64,
                isblack: isAllBlack,
                imgBuffer: imgBuffer
            });
        } finally {
            if (image) {
                image.destroy();
            }
        }
    } catch (error) {
       // console.error('Processing error:', error);
        process.send({ success: false, error: error.message });
    }
});
