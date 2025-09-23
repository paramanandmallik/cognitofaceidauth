import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateCoverImage() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Set viewport to match LinkedIn cover image dimensions
    await page.setViewport({ width: 1200, height: 627 });
    
    // Load the HTML file
    const htmlPath = path.join(__dirname, 'generate-cover-image.html');
    await page.goto(`file://${htmlPath}`);
    
    // Take screenshot
    await page.screenshot({
        path: 'linkedin-cover-faceid-cognito.png',
        fullPage: false
    });
    
    await browser.close();
    console.log('LinkedIn cover image generated: linkedin-cover-faceid-cognito.png');
}

generateCoverImage().catch(console.error);