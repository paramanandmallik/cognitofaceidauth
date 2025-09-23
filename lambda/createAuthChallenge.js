const crypto = require('crypto');

// Helper function to convert buffer to base64url
function bufferToBase64URL(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

exports.handler = async (event) => {
    console.log('CreateAuthChallenge event:', JSON.stringify(event, null, 2));
    
    // Initialize response object if not present
    if (!event.response) {
        event.response = {};
    }
    
    if (event.request.challengeName === 'CUSTOM_CHALLENGE') {
        // Generate a proper WebAuthn challenge (32 random bytes, base64url encoded)
        const challengeBuffer = crypto.randomBytes(32);
        const challenge = bufferToBase64URL(challengeBuffer);
        
        console.log('Generated challenge:', challenge);
        
        event.response.publicChallengeParameters = {
            challenge: challenge,
            rpName: 'Face ID Cognito Demo',
            rpId: 'localhost',
            userVerification: 'required',
            authenticatorAttachment: 'platform'
        };
        event.response.privateChallengeParameters = { challenge };
        event.response.challengeMetadata = 'WEBAUTHN_CHALLENGE';
    }
    
    console.log('CreateAuthChallenge response:', JSON.stringify(event.response, null, 2));
    return event;
};