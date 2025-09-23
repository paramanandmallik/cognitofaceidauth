const crypto = require('crypto');

function bufferToBase64URL(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

exports.handler = async (event) => {
    if (!event.response) {
        event.response = {};
    }
    
    if (event.request.challengeName === 'CUSTOM_CHALLENGE') {
        const challengeBuffer = crypto.randomBytes(32);
        const challenge = bufferToBase64URL(challengeBuffer);
        
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
    
    return event;
};