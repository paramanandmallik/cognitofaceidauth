exports.handler = async (event) => {
    console.log('VerifyAuthChallengeResponse event:', JSON.stringify(event, null, 2));
    
    // Initialize response object if not present
    if (!event.response) {
        event.response = {};
    }
    
    const expectedChallenge = event.request.privateChallengeParameters?.challenge;
    const providedAnswer = event.request.challengeAnswer;
    const username = event.request.userAttributes?.email || event.userName;

    try {
        console.log('Verifying challenge for user:', username);
        console.log('Expected challenge:', expectedChallenge);
        console.log('Provided answer length:', providedAnswer?.length);
        
        if (!expectedChallenge || !providedAnswer) {
            console.log('Missing challenge or answer');
            event.response.answerCorrect = false;
            return event;
        }
        
        // Parse the WebAuthn credential response
        const credential = JSON.parse(providedAnswer);
        console.log('Parsed credential:', {
            id: credential.id,
            type: credential.type,
            hasResponse: !!credential.response
        });
        
        // Enhanced validation for WebAuthn response
        if (credential && 
            credential.id && 
            credential.type === 'public-key' &&
            credential.response &&
            credential.response.authenticatorData &&
            credential.response.clientDataJSON &&
            credential.response.signature) {
            
            // Decode and verify clientDataJSON
            const clientDataBuffer = Buffer.from(credential.response.clientDataJSON, 'base64url');
            const clientData = JSON.parse(clientDataBuffer.toString());
            
            console.log('Client data:', clientData);
            
            // Verify challenge matches
            if (clientData.challenge === expectedChallenge && 
                clientData.type === 'webauthn.get' &&
                clientData.origin && 
                (clientData.origin.includes('localhost') || clientData.origin.includes('127.0.0.1'))) {
                
                console.log('WebAuthn verification successful');
                event.response.answerCorrect = true;
            } else {
                console.log('Challenge or origin verification failed');
                console.log('Expected challenge:', expectedChallenge);
                console.log('Received challenge:', clientData.challenge);
                console.log('Origin:', clientData.origin);
                event.response.answerCorrect = false;
            }
        } else {
            console.log('Invalid WebAuthn credential structure');
            event.response.answerCorrect = false;
        }
    } catch (error) {
        console.error('Error verifying challenge:', error);
        event.response.answerCorrect = false;
    }
    
    console.log('VerifyAuthChallengeResponse final result:', event.response.answerCorrect);
    return event;
};