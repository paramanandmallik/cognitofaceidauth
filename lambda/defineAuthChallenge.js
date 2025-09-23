exports.handler = async (event) => {
    console.log('DefineAuthChallenge event:', JSON.stringify(event, null, 2));
    
    // Initialize response object if not present
    if (!event.response) {
        event.response = {};
    }
    
    if (event.request.session.length === 0) {
        event.response.issueTokens = false;
        event.response.failAuthentication = false;
        event.response.challengeName = 'CUSTOM_CHALLENGE';
    } else if (event.request.session[event.request.session.length - 1].challengeResult === true) {
        event.response.issueTokens = true;
        event.response.failAuthentication = false;
    } else {
        event.response.issueTokens = false;
        event.response.failAuthentication = true;
    }
    
    console.log('DefineAuthChallenge response:', JSON.stringify(event.response, null, 2));
    return event;
};