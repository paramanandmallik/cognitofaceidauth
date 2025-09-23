import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  
  const bundledJS = bundleJavaScript();
  const jsPath = path.join(distDir, 'bundle.js');
  fs.writeFileSync(jsPath, bundledJS);
  console.log('✅ JavaScript bundled to dist/bundle.js');
  
  copyHTML();
  
  console.log('🎉 Build complete!');
}

main();