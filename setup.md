# Quick Setup Guide for Mac Testing

## Prerequisites
- macOS with Touch ID or Face ID
- Node.js installed
- Safari browser (recommended for WebAuthn)

## Setup Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Cognito Settings**
   Edit `src/config.js` and update:
   ```javascript
   userPoolId: 'us-east-1_XXXXXXXXX', // Your User Pool ID
   userPoolWebClientId: 'xxxxxxxxxx', // Your App Client ID
   domain: 'your-domain.auth.us-east-1.amazoncognito.com'
   ```

3. **Build and Start Server**
   ```bash
   npm run dev
   ```

4. **Open in Safari**
   - Navigate to `https://localhost:3000`
   - Accept the self-signed certificate warning
   - Test Face ID/Touch ID authentication

## Testing Flow

### Registration
1. Enter email and username
2. Click "Register with Biometrics"
3. Complete Touch ID/Face ID prompt when Safari asks
4. Registration complete

### Authentication
1. Enter username
2. Click "Sign In with Face ID/Touch ID"
3. Complete biometric verification
4. Successfully authenticated

## Troubleshooting

- **Certificate Warning**: Click "Advanced" → "Proceed to localhost"
- **WebAuthn Not Supported**: Ensure using Safari with HTTPS
- **Touch ID Not Working**: Check System Preferences → Touch ID & Password
- **Face ID Not Working**: Ensure Face ID is enabled in System Preferences

## Browser Support on Mac
- ✅ Safari (Best)
- ✅ Chrome (Good)
- ⚠️ Firefox (Limited)

## Security Notes
- Uses self-signed certificates for local testing
- Credentials stored in localStorage (demo only)
- Production should use secure backend storage