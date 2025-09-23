const cognitoConfig = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_U8n3Je4rK', // Replace with your User Pool ID
  userPoolWebClientId: '4ebk2m0223bp6sb7sjk8ioi9ed', // Replace with your App Client ID
  userPoolWebClientSecret: '7bqa6e5l5ne50cg5cedojj4em3ll4c65p0tr6g40o9ecuoqh5vv', // Replace with your App Client Secret
  domain: 'us-east-1u8n3je4rk.auth.us-east-1.amazoncognito.com', // Replace with your domain
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