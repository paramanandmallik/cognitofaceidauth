const cognitoConfig = {
  region: 'us-east-1', // Your AWS region
  userPoolId: 'YOUR_USER_POOL_ID', // Replace with your User Pool ID
  userPoolWebClientId: 'YOUR_CLIENT_ID', // Replace with your App Client ID
  userPoolWebClientSecret: 'YOUR_CLIENT_SECRET', // Replace with your App Client Secret
  domain: 'YOUR_COGNITO_DOMAIN', // Replace with your Cognito domain
  redirectSignIn: 'https://localhost:3000/',
  redirectSignOut: 'https://localhost:3000/',
  responseType: 'code',
  scope: ['email', 'openid', 'profile'],
  
  // WebAuthn specific configuration
  webAuthn: {
    rpId: 'localhost', // Replace with your domain for production
    rpName: 'Face ID Cognito Demo',
    timeout: 60000,
    userVerification: 'required', // Enforces Face ID/Touch ID
    authenticatorAttachment: 'platform', // Prefers platform authenticators
    attestation: 'direct',
    extensions: {
      credProps: true
    }
  }
};

const amplifyConfig = {
  Auth: {
    Cognito: {
      region: cognitoConfig.region,
      userPoolId: cognitoConfig.userPoolId,
      userPoolClientId: cognitoConfig.userPoolWebClientId,
      userPoolClientSecret: cognitoConfig.userPoolWebClientSecret,
      loginWith: {
        oauth: {
          domain: cognitoConfig.domain,
          scopes: cognitoConfig.scope,
          redirectSignIn: [cognitoConfig.redirectSignIn],
          redirectSignOut: [cognitoConfig.redirectSignOut],
          responseType: cognitoConfig.responseType
        }
      }
    }
  }
};