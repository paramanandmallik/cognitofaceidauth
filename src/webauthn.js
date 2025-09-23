class WebAuthnService {
  constructor() {
    this.rpId = cognitoConfig.webAuthn.rpId;
    this.rpName = cognitoConfig.webAuthn.rpName;
  }

  async isWebAuthnSupported() {
    return window.PublicKeyCredential && 
           await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  }

  async getAvailableAuthenticators() {
    const authenticators = [];
    
    if (window.PublicKeyCredential) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          // Detect Apple devices
          const isApple = /iPad|iPhone|iPod|Mac/.test(navigator.userAgent);
          if (isApple) {
            // Check for Face ID capability (newer devices)
            const hasFaceID = /iPhone1[2-9]|iPad/.test(navigator.userAgent);
            if (hasFaceID) {
              authenticators.push('Face ID');
            } else {
              authenticators.push('Touch ID');
            }
          } else {
            authenticators.push('Platform Authenticator');
          }
        }
      } catch (error) {
        console.warn('Error detecting authenticators:', error);
      }
    }
    
    return authenticators;
  }

  async registerCredential(username, challenge, userHandle) {
    try {
      const registrationOptions = {
        rp: {
          name: this.rpName,
          id: this.rpId,
        },
        user: {
          id: new TextEncoder().encode(userHandle || username),
          name: username,
          displayName: username,
        },
        challenge: new Uint8Array(challenge),
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        timeout: cognitoConfig.webAuthn.timeout,
        attestation: cognitoConfig.webAuthn.attestation,
        authenticatorSelection: {
          authenticatorAttachment: cognitoConfig.webAuthn.authenticatorAttachment,
          userVerification: cognitoConfig.webAuthn.userVerification,
          requireResidentKey: true,
        },
        extensions: cognitoConfig.webAuthn.extensions,
      };

      const credential = await navigator.credentials.create({ publicKey: registrationOptions });
      
      // Format response for compatibility
      return {
        id: credential.id,
        rawId: credential.rawId,
        response: {
          clientDataJSON: this.bufferToBase64URL(credential.response.clientDataJSON),
          attestationObject: this.bufferToBase64URL(credential.response.attestationObject),
          publicKey: credential.response.getPublicKey ? this.bufferToBase64URL(credential.response.getPublicKey()) : null,
          transports: credential.response.getTransports ? credential.response.getTransports() : ['internal']
        },
        type: credential.type
      };
    } catch (error) {
      console.error('WebAuthn registration failed:', error);
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  async authenticateCredential(challenge, allowCredentials = []) {
    try {
      const authenticationOptions = {
        challenge: new Uint8Array(challenge),
        timeout: cognitoConfig.webAuthn.timeout,
        userVerification: cognitoConfig.webAuthn.userVerification,
        rpId: this.rpId,
      };

      if (allowCredentials.length > 0) {
        authenticationOptions.allowCredentials = allowCredentials.map(cred => ({
          id: new Uint8Array(cred.id),
          type: 'public-key',
          transports: cred.transports || ['internal'],
        }));
      }

      const credential = await navigator.credentials.get({ publicKey: authenticationOptions });
      
      // Format response for compatibility
      return {
        id: credential.id,
        rawId: credential.rawId,
        response: {
          clientDataJSON: this.bufferToBase64URL(credential.response.clientDataJSON),
          authenticatorData: this.bufferToBase64URL(credential.response.authenticatorData),
          signature: this.bufferToBase64URL(credential.response.signature),
          userHandle: credential.response.userHandle ? this.bufferToBase64URL(credential.response.userHandle) : null
        },
        type: credential.type
      };
    } catch (error) {
      console.error('WebAuthn authentication failed:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  // Utility methods for encoding/decoding
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

  bufferToBase64URL(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}