import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple build script to bundle files for local testing
function createDistDirectory() {
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }
  return distDir;
}

function bundleJavaScript() {
  const srcDir = path.join(__dirname, 'src');
  const files = ['config.js', 'webauthn.js', 'cognito-auth.js', 'index.js'];
  
  let bundledContent = '';
  
  files.forEach(file => {
    const filePath = path.join(srcDir, file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Simple ES6 module transformation for browser compatibility
      content = content.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '');
      content = content.replace(/export\s+/g, '');
      
      bundledContent += `\n// === ${file} ===\n${content}\n`;
    }
  });
  
  return bundledContent;
}

function copyHTML() {
  const srcHTML = path.join(__dirname, 'src', 'index.html');
  const distHTML = path.join(__dirname, 'dist', 'index.html');
  
  if (fs.existsSync(srcHTML)) {
    fs.copyFileSync(srcHTML, distHTML);
    console.log('✅ HTML copied to dist/');
  }
}

function main() {
  console.log('🔨 Building application...');
  
  const distDir = createDistDirectory();
  
  // Bundle JavaScript
  const bundledJS = bundleJavaScript();
  const jsPath = path.join(distDir, 'bundle.js');
  fs.writeFileSync(jsPath, bundledJS);
  console.log('✅ JavaScript bundled to dist/bundle.js');
  
  // Copy HTML
  copyHTML();
  
  console.log('🎉 Build complete!');
}

main();