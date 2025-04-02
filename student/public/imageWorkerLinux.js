/**
 * Dieser Worker wird nur auf Linux verwendet
 * er nutzt die native ImageMagick Bibliothek um die Bilder zu verarbeiten
 */

import { parentPort } from 'worker_threads';
import { execFile } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

parentPort.on('message', async (message) => {
    try {
        const imgBuffer = Buffer.from(message.imgBuffer);

        const tmpInput = join(tmpdir(), `input-${Date.now()}.png`);
        const tmpResized = join(tmpdir(), `resized-${Date.now()}.png`);
        const tmpCropped = join(tmpdir(), `cropped-${Date.now()}.png`);

        await writeFile(tmpInput, imgBuffer);

        // resize auf Breite 1024
        await new Promise((resolve, reject) => {
            execFile('convert', [tmpInput, '-resize', '1024x', tmpResized], (err) => err ? reject(err) : resolve());
        });

        // crop oberste 100 Pixel (max. 1024 breit)
        await new Promise((resolve, reject) => {
            execFile('convert', [tmpInput, '-crop', '1024x100+0+0', tmpCropped], (err) => err ? reject(err) : resolve());
        });

        const resizedBuffer = await readFile(tmpResized);
        const headerBuffer = await readFile(tmpCropped);

        // Prüfe, ob headerBuffer schwarz ist (erste 10x10 Pixel):
        let isAllBlack = true;
        await new Promise((resolve, reject) => {
            execFile('convert', [tmpCropped, '-crop', '10x10+0+0', '-format', '%[mean]', 'info:'], (err, stdout) => {
                if (err) return reject(err);
                isAllBlack = parseFloat(stdout) === 0;
                resolve();
            });
        });

        // Dateien löschen
        await Promise.all([unlink(tmpInput), unlink(tmpResized), unlink(tmpCropped)]);

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
