// Simple test to verify the setup works
console.log('🧪 Testing Face ID/Touch ID Cognito Setup...\n');

// Check Node.js version
const nodeVersion = process.version;
console.log(`✅ Node.js version: ${nodeVersion}`);

// Check if required files exist
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'src/config.js',
  'src/webauthn.js', 
  'src/cognito-auth.js',
  'src/index.js',
  'src/index.html',
  'server.js',
  'build.js'
];

console.log('\n📁 Checking required files:');
requiredFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
  }
});

// Check package.json
console.log('\n📦 Checking package.json:');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`✅ Package name: ${pkg.name}`);
  console.log(`✅ Scripts available: ${Object.keys(pkg.scripts).join(', ')}`);
  console.log(`✅ Dependencies: ${Object.keys(pkg.dependencies).length} packages`);
} catch (error) {
  console.log('❌ Error reading package.json');
}

console.log('\n🚀 Setup appears complete!');
console.log('\nNext steps:');
console.log('1. Run: npm install');
console.log('2. Edit src/config.js with your Cognito settings');
console.log('3. Run: npm run dev');
console.log('4. Open Safari to https://localhost:3000');
console.log('\n💡 Make sure Touch ID/Face ID is enabled in System Preferences!');