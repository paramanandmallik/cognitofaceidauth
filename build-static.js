import fs from 'fs';

// Create dist directory
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Read and update HTML to use bundled JS
let html = fs.readFileSync('src/index.html', 'utf8');
html = html.replace(
  /<script src="config\.js"><\/script>\s*<script src="webauthn\.js"><\/script>\s*<script src="cognito-auth\.js"><\/script>\s*<script src="index\.js"><\/script>/,
  '<script src="app.js"></script>'
);
fs.writeFileSync('dist/index.html', html);

// Bundle all JS files - use config.js instead of config.template.js
const config = fs.readFileSync('src/config.js', 'utf8');
const webauthn = fs.readFileSync('src/webauthn.js', 'utf8');
const cognitoAuth = fs.readFileSync('src/cognito-auth.js', 'utf8');
const indexJs = fs.readFileSync('src/index.js', 'utf8');

const bundledJs = `${config}\n\n${webauthn}\n\n${cognitoAuth}\n\n${indexJs}`;
fs.writeFileSync('dist/app.js', bundledJs);

console.log('✅ Static files built in dist/ directory');
console.log('📝 Remember to update config values in dist/app.js before deployment');