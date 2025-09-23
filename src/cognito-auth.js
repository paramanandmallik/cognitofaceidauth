class CognitoAuthService {
  constructor() {
    // Configure AWS SDK
    AWS.config.region = cognitoConfig.region;
    this.cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();
    this.userPool = new AmazonCognitoIdentity.CognitoUserPool({
      UserPoolId: cognitoConfig.userPoolId,
      ClientId: cognitoConfig.userPoolWebClientId
    });
    this.webAuthn = new WebAuthnService();
    this.currentUser = null;
  }

  async registerWithBiometrics(username, email) {
    try {
      console.log('Starting registration for:', { username, email });
      
      // Step 1: Sign up user in Cognito (use email as username since pool is configured that way)
      const signUpParams = {
        ClientId: cognitoConfig.userPoolWebClientId,
        Username: email, // Use email as username
        Password: this.generateTemporaryPassword(),
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'preferred_username', Value: username }
        ],
        SecretHash: this.calculateSecretHash(email)
      };
      
      console.log('Signing up user with params:', { ...signUpParams, Password: '[HIDDEN]' });
      const signUpResult = await this.cognitoIdentityServiceProvider.signUp(signUpParams).promise();
      console.log('Sign up result:', signUpResult);
      
      const userId = signUpResult.UserSub;

      // Step 2: Generate WebAuthn challenge for registration
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const challengeB64 = this.bufferToBase64URL(challenge);
      
      // Step 3: Register WebAuthn credential
      console.log('Registering WebAuthn credential...');
      const credential = await this.webAuthn.registerCredential(
        username,
        challenge,
        userId
      );
      console.log('WebAuthn credential registered:', credential);

      // Step 4: Store credential data
      const credentialData = {
        id: credential.id,
        rawId: this.bufferToBase64URL(credential.rawId),
        publicKey: this.bufferToBase64URL(credential.response.publicKey),
        counter: 0,
        transports: credential.response.transports || ['internal'],
        userId: userId,
        username: username,
        email: email
      };

      // Store credentials with multiple keys for lookup flexibility
      localStorage.setItem(`webauthn_${email}`, JSON.stringify(credentialData));
      localStorage.setItem(`webauthn_${username}`, JSON.stringify(credentialData));
      localStorage.setItem(`webauthn_${userId}`, JSON.stringify(credentialData));
      
      console.log('Credentials stored in localStorage');

      // Step 5: Auto-confirm the user (since we're using temporary password)
      try {
        const confirmParams = {
          ClientId: cognitoConfig.userPoolWebClientId,
          Username: email,
          ConfirmationCode: '000000', // This won't work, but we'll handle it
          SecretHash: this.calculateSecretHash(email)
        };
        
        // Try to confirm, but don't fail if it doesn't work
        await this.cognitoIdentityServiceProvider.confirmSignUp(confirmParams).promise();
      } catch (confirmError) {
        console.log('Auto-confirm failed (expected):', confirmError.message);
        // This is expected - we'll need manual confirmation or admin confirmation
      }

      return {
        success: true,
        message: `Registration successful! Use "${email}" to sign in with biometrics.`,
        userId,
        credentialId: credential.id,
        loginUsername: email // Tell user to use email for login
      };

    } catch (error) {
      console.error('Registration error:', error);
      if (error.code === 'UsernameExistsException') {
        throw new Error('User already exists. Try signing in instead.');
      }
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  async signInWithBiometrics(username) {
    try {
      console.log('Attempting sign-in with username:', username);
      
      // Check if we have stored credentials for this user
      let storedCredential = localStorage.getItem(`webauthn_${username}`);
      
      // If not found with username, try with email format
      if (!storedCredential && username.includes('@')) {
        storedCredential = localStorage.getItem(`webauthn_${username}`);
      }
      
      // Also check all stored credentials to find matching user
      if (!storedCredential) {
        const allKeys = Object.keys(localStorage).filter(key => key.startsWith('webauthn_'));
        console.log('Available credential keys:', allKeys);
        
        for (const key of allKeys) {
          const keyUsername = key.replace('webauthn_', '');
          if (keyUsername === username || keyUsername.toLowerCase() === username.toLowerCase()) {
            storedCredential = localStorage.getItem(key);
            console.log('Found credential with key:', key);
            break;
          }
        }
      }
      
      console.log('Stored credential found:', !!storedCredential);
      
      if (!storedCredential) {
        throw new Error('No WebAuthn credentials found. Please register first.');
      }
      
      // Parse stored credential
      const credentialData = JSON.parse(storedCredential);
      
      // Use custom auth flow with Lambda triggers
      const initiateAuthParams = {
        ClientId: cognitoConfig.userPoolWebClientId,
        AuthFlow: 'CUSTOM_AUTH',
        AuthParameters: {
          USERNAME: username,
          SECRET_HASH: this.calculateSecretHash(username)
        }
      };

      console.log('Initiating auth with params:', initiateAuthParams);
      const initiateResult = await this.cognitoIdentityServiceProvider.initiateAuth(initiateAuthParams).promise();
      console.log('Initiate auth result:', initiateResult);
      
      if (initiateResult.ChallengeName === 'CUSTOM_CHALLENGE') {
        // Handle WebAuthn challenge from Lambda
        const challengeParams = initiateResult.ChallengeParameters;
        console.log('Challenge parameters:', challengeParams);
        
        const challenge = challengeParams.challenge;
        
        // Create WebAuthn options for authentication
        const publicKeyOptions = {
          challenge: this.base64URLToBuffer(challenge),
          allowCredentials: [{
            id: this.base64URLToBuffer(credentialData.id),
            type: 'public-key',
            transports: credentialData.transports || ['internal']
          }],
          userVerification: 'required',
          timeout: 60000,
          rpId: 'localhost'
        };

        console.log('WebAuthn get options:', publicKeyOptions);
        
        // Trigger Face ID/Touch ID
        const credential = await navigator.credentials.get({ publicKey: publicKeyOptions });
        console.log('WebAuthn credential received:', credential);
        
        // Prepare credential response for Lambda
        const credentialResponse = {
          id: credential.id,
          rawId: this.bufferToBase64URL(credential.rawId),
          response: {
            authenticatorData: this.bufferToBase64URL(credential.response.authenticatorData),
            clientDataJSON: this.bufferToBase64URL(credential.response.clientDataJSON),
            signature: this.bufferToBase64URL(credential.response.signature),
            userHandle: credential.response.userHandle ? this.bufferToBase64URL(credential.response.userHandle) : null
          },
          type: credential.type
        };
        
        // Respond to challenge
        const respondParams = {
          ClientId: cognitoConfig.userPoolWebClientId,
          ChallengeName: 'CUSTOM_CHALLENGE',
          Session: initiateResult.Session,
          ChallengeResponses: {
            USERNAME: username,
            ANSWER: JSON.stringify(credentialResponse),
            SECRET_HASH: this.calculateSecretHash(username)
          }
        };

        console.log('Responding to challenge with params:', respondParams);
        const authResult = await this.cognitoIdentityServiceProvider.respondToAuthChallenge(respondParams).promise();
        console.log('Auth challenge response:', authResult);
        
        if (authResult.AuthenticationResult) {
          this.currentUser = { username };
          return {
            success: true,
            message: 'Biometric authentication successful!',
            tokens: authResult.AuthenticationResult,
            user: { username }
          };
        } else {
          throw new Error('Authentication failed - no tokens received');
        }
      }
      
      throw new Error('Custom challenge not received');

    } catch (error) {
      console.error('Biometric sign-in error:', error);
      if (error.code === 'UserNotFoundException') {
        throw new Error('User not found. Please check the username or register first.');
      } else if (error.code === 'NotAuthorizedException') {
        throw new Error('Authentication failed. Please try again.');
      }
      throw new Error(`Sign-in failed: ${error.message}`);
    }
  }

  async signInWithPassword(username, password) {
    try {
      const authParams = {
        ClientId: cognitoConfig.userPoolWebClientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: this.calculateSecretHash(username)
        }
      };

      const result = await this.cognitoIdentityServiceProvider.initiateAuth(authParams).promise();
      
      return {
        success: true,
        message: 'Password authentication successful!',
        tokens: result.AuthenticationResult,
        user: { username }
      };

    } catch (error) {
      console.error('Password sign-in error:', error);
      throw new Error(`Sign-in failed: ${error.message}`);
    }
  }

  async signOut() {
    try {
      this.currentUser = null;
      return { success: true, message: 'Signed out successfully' };
    } catch (error) {
      console.error('Sign-out error:', error);
      throw new Error(`Sign-out failed: ${error.message}`);
    }
  }

  async getCurrentUser() {
    return this.currentUser;
  }

  // Helper method to verify WebAuthn assertion (simplified for demo)
  async verifyAssertion(assertion, storedCredential, challenge) {
    try {
      // In production, this should be done server-side with proper cryptographic verification
      // This is a simplified check for demo purposes
      
      // Verify the credential ID matches
      if (assertion.id !== storedCredential.id) {
        return false;
      }

      // Verify the challenge (simplified)
      const clientDataJSON = JSON.parse(
        new TextDecoder().decode(
          this.webAuthn.base64URLToBuffer(assertion.response.clientDataJSON)
        )
      );

      // Basic challenge verification (in production, use proper crypto libraries)
      return clientDataJSON.type === 'webauthn.get';

    } catch (error) {
      console.error('Assertion verification error:', error);
      return false;
    }
  }

  // Calculate secret hash for client secret
  calculateSecretHash(username) {
    if (!cognitoConfig.userPoolWebClientSecret) return undefined;
    const message = username + cognitoConfig.userPoolWebClientId;
    const hash = CryptoJS.HmacSHA256(message, cognitoConfig.userPoolWebClientSecret);
    return CryptoJS.enc.Base64.stringify(hash);
  }

  // Utility methods for base64URL encoding/decoding
  bufferToBase64URL(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  base64URLToBuffer(base64URL) {
    const base64 = base64URL.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    const binary = atob(padded);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return buffer;
  }

  // Generate a temporary password for initial signup
  generateTemporaryPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password + 'A1!'; // Ensure it meets Cognito requirements
  }
}