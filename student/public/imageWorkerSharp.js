import sharp from 'sharp';

sharp.cache(false);

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
            
            const [resizedBuffer, headerBuffer] = await Promise.all([
                image.clone()
                    .resize({ width: 1024 })
                    .toBuffer(),
                
                image.clone()
                    .resize({
                        width: metadata.width < 1024 ? metadata.width : 1024,
                        height: 100,
                        fit: 'cover'
                    })
                    .toBuffer()
            ]);

            const headerRaw = await sharp(headerBuffer).raw().toBuffer();
            const isAllBlack = !headerRaw.some((value, index) => index % 4 !== 3 && value !== 0);
            
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
        console.error('Processing error:', error);
        process.send({ success: false, error: error.message });
    }
});
