try {
    const puppeteer = await import('puppeteer');
    console.log('Puppeteer is available');
} catch (e) {
    console.log('Puppeteer is not available:', e.message);
}

try {
    const playwright = await import('playwright');
    console.log('Playwright is available');
} catch (e) {
    console.log('Playwright is not available:', e.message);
}
