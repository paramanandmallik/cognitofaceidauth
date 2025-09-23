# Face ID/Touch ID Authentication with Amazon Cognito

A complete client-side application demonstrating biometric authentication using Face ID and Touch ID with Amazon Cognito User Pools.

## Features

- **Biometric Authentication**: Face ID and Touch ID support on Mac
- **WebAuthn Integration**: Standards-compliant passwordless authentication
- **Cognito Integration**: Seamless integration with AWS Cognito User Pools
- **Fallback Support**: Password-based authentication as backup
- **Device Detection**: Automatic detection of available biometric authenticators
- **Secure Storage**: Client-side credential management

## Prerequisites

- macOS with Touch ID or Face ID capability
- Node.js 16+ installed
- Modern browser (Safari, Chrome, Firefox)
- AWS Cognito User Pool configured with custom auth flow

## Quick Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Cognito**:
   Edit `src/config.js` and update:
   - `userPoolId`: Your Cognito User Pool ID
   - `userPoolWebClientId`: Your App Client ID
   - `userPoolWebClientSecret`: Your App Client Secret
   - `domain`: Your Cognito domain
   - `rpId`: Your domain (use 'localhost' for local testing)

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Access Application**:
   Open https://localhost:3000 in Safari (required for WebAuthn on Mac)

## Configuration

### Cognito User Pool Setup

1. Create a User Pool in AWS Cognito
2. Enable custom authentication flow
3. Configure Lambda triggers:
   - DefineAuthChallenge
   - CreateAuthChallenge  
   - VerifyAuthChallengeResponse
4. Enable advanced security features
5. Set up app client with custom auth flow

### WebAuthn Configuration

The application is pre-configured for Mac testing with:
- `rpId`: localhost (change for production)
- `userVerification`: required (enforces biometrics)
- `authenticatorAttachment`: platform (prefers Touch ID/Face ID)

## Usage

### Registration
1. Enter email and username
2. Click "Register with Biometrics"
3. Complete Touch ID/Face ID prompt
4. Account created with biometric credential

### Authentication
1. Enter username
2. Click "Sign In with Face ID/Touch ID"
3. Complete biometric verification
4. Authenticated and signed in

### Fallback
- Use "Sign In with Password" for traditional authentication
- Supports users without biometric setup

## Browser Compatibility

| Browser | Mac Support | Notes |
|---------|-------------|-------|
| Safari  | ✅ Full     | Recommended for best experience |
| Chrome  | ✅ Full     | Requires HTTPS |
| Firefox | ✅ Limited  | Basic WebAuthn support |
| Edge    | ✅ Full     | Chromium-based |

## Security Features

- **No Password Storage**: Eliminates password-based vulnerabilities
- **Device-Bound Credentials**: Biometrics never leave the device
- **Public Key Cryptography**: FIDO2/WebAuthn standards
- **Phishing Resistant**: Domain-bound authentication
- **Replay Protection**: Challenge-response mechanism

## Troubleshooting

### Common Issues

1. **"WebAuthn Not Supported"**
   - Ensure using HTTPS (required for WebAuthn)
   - Use Safari on Mac for best compatibility
   - Check if Touch ID/Face ID is enabled in System Preferences

2. **"No biometric credentials found"**
   - Complete registration process first
   - Check browser storage permissions
   - Clear localStorage and re-register if needed

3. **Authentication Fails**
   - Verify Cognito configuration
   - Check Lambda function logs
   - Ensure biometric sensor is working

### Debug Mode

Enable debug logging by adding to browser console:
```javascript
localStorage.setItem('debug', 'true');
```

## Production Deployment

### Security Checklist

- [ ] Update `rpId` to your production domain
- [ ] Implement server-side credential verification
- [ ] Use DynamoDB for credential storage (not localStorage)
- [ ] Enable Cognito advanced security
- [ ] Set up proper CORS policies
- [ ] Implement rate limiting
- [ ] Add comprehensive logging
- [ ] Enable CloudTrail for audit logs

### Performance Optimization

- [ ] Implement credential caching
- [ ] Add service worker for offline support
- [ ] Optimize bundle size
- [ ] Enable compression
- [ ] Use CDN for static assets

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Cognito Pool   │    │ Lambda Triggers │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │  WebAuthn   │◄┼────┼►│ Custom Auth  │◄┼────┼►│ Auth Flow   │ │
│ │  Service    │ │    │ │   Flow       │ │    │ │ Handlers    │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │ Face ID/    │ │    │ │   User       │ │    │ │ Credential  │ │
│ │ Touch ID    │ │    │ │ Management   │ │    │ │ Validation  │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## API Reference

### CognitoAuthService

- `registerWithBiometrics(username, email)`: Register new user with biometric credential
- `signInWithBiometrics(username)`: Authenticate using biometrics
- `signInWithPassword(username, password)`: Fallback password authentication
- `signOut()`: Sign out current user
- `getCurrentUser()`: Get current authenticated user

### WebAuthnService

- `isWebAuthnSupported()`: Check WebAuthn browser support
- `getAvailableAuthenticators()`: Detect available biometric authenticators
- `registerCredential(username, challenge, userHandle)`: Register new WebAuthn credential
- `authenticateCredential(challenge, allowCredentials)`: Authenticate with existing credential

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review AWS Cognito documentation
3. Check WebAuthn browser compatibility
4. Open an issue in this repository