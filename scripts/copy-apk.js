import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('releases');
const destDir = path.resolve('dist');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    files.forEach(file => {
        if (file.endsWith('.apk')) {
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);
            fs.copyFileSync(srcPath, destPath);
            console.log(`[CopyAPK] Copied ${file} to dist/ successfully.`);
        }
    });
} else {
    console.log('[CopyAPK] No releases directory found.');
}
