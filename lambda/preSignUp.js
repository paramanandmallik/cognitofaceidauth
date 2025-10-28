exports.handler = async (event) => {
    console.log('PreSignUp event:', JSON.stringify(event, null, 2));
    
    // Auto-confirm users for biometric registration
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;
    
    console.log('PreSignUp response:', JSON.stringify(event.response, null, 2));
    return event;
};