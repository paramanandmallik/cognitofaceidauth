exports.handler = async (event) => {
    if (!event.response) {
        event.response = {};
    }
    
    const expectedChallenge = event.request.privateChallengeParameters?.challenge;
    const providedAnswer = event.request.challengeAnswer;

    try {
        if (!expectedChallenge || !providedAnswer) {
            event.response.answerCorrect = false;
            return event;
        }
        
        const credential = JSON.parse(providedAnswer);
        
        if (credential && 
            credential.id && 
            credential.type === 'public-key' &&
            credential.response &&
            credential.response.authenticatorData &&
            credential.response.clientDataJSON &&
            credential.response.signature) {
            
            try {
                const clientDataBuffer = Buffer.from(credential.response.clientDataJSON, 'base64url');
                const clientData = JSON.parse(clientDataBuffer.toString());
                
                if (clientData.challenge === expectedChallenge && 
                    clientData.type === 'webauthn.get' &&
                    clientData.origin && 
                    (clientData.origin.includes('localhost') || clientData.origin.includes('127.0.0.1'))) {
                    
                    event.response.answerCorrect = true;
                } else {
                    event.response.answerCorrect = false;
                }
            } catch (decodeError) {
                event.response.answerCorrect = false;
            }
        } else {
            event.response.answerCorrect = false;
        }
    } catch (error) {
        event.response.answerCorrect = false;
    }
    
    return event;
};