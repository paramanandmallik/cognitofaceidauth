const cognitoConfig = {
  region: 'us-east-1',
  userPoolId: 'YOUR_USER_POOL_ID',
  userPoolWebClientId: 'YOUR_CLIENT_ID',
  userPoolWebClientSecret: 'YOUR_CLIENT_SECRET',
  domain: 'your-domain.auth.us-east-1.amazoncognito.com',
  redirectSignIn: 'https://localhost:3000/',
  redirectSignOut: 'https://localhost:3000/',
  responseType: 'code',
  scope: ['email', 'openid', 'profile'],
  
  webAuthn: {
    rpId: 'localhost',
    rpName: 'Face ID Cognito Demo',
    timeout: 60000,
    userVerification: 'required',
    authenticatorAttachment: 'platform',
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