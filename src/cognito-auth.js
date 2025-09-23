class CognitoAuthService {
  constructor() {
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
      const signUpParams = {
        ClientId: cognitoConfig.userPoolWebClientId,
        Username: email,
        Password: this.generateTemporaryPassword(),
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'preferred_username', Value: username }
        ],
        SecretHash: this.calculateSecretHash(email)
      };
      
      const signUpResult = await this.cognitoIdentityServiceProvider.signUp(signUpParams).promise();
      const userId = signUpResult.UserSub;

      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const credential = await this.webAuthn.registerCredential(username, challenge, userId);

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

      localStorage.setItem(`webauthn_${email}`, JSON.stringify(credentialData));
      localStorage.setItem(`webauthn_${username}`, JSON.stringify(credentialData));
      localStorage.setItem(`webauthn_${userId}`, JSON.stringify(credentialData));

      return {
        success: true,
        message: `Registration successful! Use "${email}" to sign in with biometrics.`,
        userId,
        credentialId: credential.id,
        loginUsername: email
      };

    } catch (error) {
      if (error.code === 'UsernameExistsException') {
        throw new Error('User already exists. Try signing in instead.');
      }
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  async signInWithBiometrics(username) {
    try {
      let storedCredential = localStorage.getItem(`webauthn_${username}`);
      
      if (!storedCredential && username.includes('@')) {
        storedCredential = localStorage.getItem(`webauthn_${username}`);
      }
      
      if (!storedCredential) {
        const allKeys = Object.keys(localStorage).filter(key => key.startsWith('webauthn_'));
        
        for (const key of allKeys) {
          const keyUsername = key.replace('webauthn_', '');
          if (keyUsername === username || keyUsername.toLowerCase() === username.toLowerCase()) {
            storedCredential = localStorage.getItem(key);
            break;
          }
        }
      }
      
      if (!storedCredential) {
        throw new Error('No WebAuthn credentials found. Please register first.');
      }
      
      const credentialData = JSON.parse(storedCredential);
      
      const initiateAuthParams = {
        ClientId: cognitoConfig.userPoolWebClientId,
        AuthFlow: 'CUSTOM_AUTH',
        AuthParameters: {
          USERNAME: username,
          SECRET_HASH: this.calculateSecretHash(username)
        }
      };

      const initiateResult = await this.cognitoIdentityServiceProvider.initiateAuth(initiateAuthParams).promise();
      
      if (initiateResult.ChallengeName === 'CUSTOM_CHALLENGE') {
        const challengeParams = initiateResult.ChallengeParameters;
        const challenge = challengeParams.challenge;
        
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

        const credential = await navigator.credentials.get({ publicKey: publicKeyOptions });
        
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

        const authResult = await this.cognitoIdentityServiceProvider.respondToAuthChallenge(respondParams).promise();
        
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
      throw new Error(`Sign-in failed: ${error.message}`);
    }
  }

  async signOut() {
    try {
      this.currentUser = null;
      return { success: true, message: 'Signed out successfully' };
    } catch (error) {
      throw new Error(`Sign-out failed: ${error.message}`);
    }
  }

  async getCurrentUser() {
    return this.currentUser;
  }

  calculateSecretHash(username) {
    if (!cognitoConfig.userPoolWebClientSecret) return undefined;
    const message = username + cognitoConfig.userPoolWebClientId;
    const hash = CryptoJS.HmacSHA256(message, cognitoConfig.userPoolWebClientSecret);
    return CryptoJS.enc.Base64.stringify(hash);
  }

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

  generateTemporaryPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password + 'A1!';
  }
}