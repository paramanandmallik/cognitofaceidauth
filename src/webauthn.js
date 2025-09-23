class WebAuthnService {
  constructor() {
    this.rpId = cognitoConfig.webAuthn.rpId;
    this.rpName = cognitoConfig.webAuthn.rpName;
  }

  async isWebAuthnSupported() {
    return !!(navigator.credentials && navigator.credentials.create);
  }

  async getAvailableAuthenticators() {
    const authenticators = [];
    
    if (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) {
      if (navigator.platform.includes('Mac')) {
        authenticators.push('Touch ID/Face ID');
      } else {
        authenticators.push('Platform Authenticator');
      }
    }
    
    return authenticators;
  }

  async registerCredential(username, challenge, userHandle) {
    const publicKeyOptions = {
      challenge: challenge,
      rp: {
        id: this.rpId,
        name: this.rpName
      },
      user: {
        id: new TextEncoder().encode(userHandle),
        name: username,
        displayName: username
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        requireResidentKey: false
      },
      timeout: cognitoConfig.webAuthn.timeout,
      attestation: cognitoConfig.webAuthn.attestation
    };

    const credential = await navigator.credentials.create({ publicKey: publicKeyOptions });
    return credential;
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
}