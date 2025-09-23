# Deployment Instructions

## Git Repository Setup

The project has been prepared and committed locally. To push to GitHub:

1. **Ensure you have GitHub access configured**:
   ```bash
   # Option 1: Using HTTPS with personal access token
   git remote set-url origin https://github.com/paramanandmallik/cognitofaceidauth.git
   
   # Option 2: Using SSH (if SSH key is configured)
   git remote set-url origin git@github.com:paramanandmallik/cognitofaceidauth.git
   ```

2. **Push to repository**:
   ```bash
   git push -u origin main
   ```

## Project Structure

```
cognitofaceidauth/
├── src/
│   ├── config.js              # Cognito configuration
│   ├── webauthn.js           # WebAuthn service
│   ├── cognito-auth.js       # Cognito authentication service
│   ├── index.js              # Main application logic
│   └── index.html            # HTML interface
├── lambda/
│   ├── defineAuthChallenge.js
│   ├── createAuthChallenge.js
│   └── verifyAuthChallengeResponse.js
├── package.json
├── build.js                  # Build script
├── server.js                 # Development server
├── README.md
└── .gitignore
```

## Next Steps

1. Push the code to GitHub
2. Update `src/config.js` with your Cognito configuration
3. Deploy Lambda functions to AWS
4. Test the application

## Lambda Deployment

```bash
# Deploy each Lambda function
cd lambda
for func in defineAuthChallenge createAuthChallenge verifyAuthChallengeResponse; do
    zip -r ${func}.zip ${func}.js
    aws lambda create-function \
        --function-name ${func}FaceID \
        --runtime nodejs22.x \
        --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
        --handler ${func}.handler \
        --zip-file fileb://${func}.zip
done
```

## Configuration

Update the Cognito User Pool to use the Lambda triggers:

```bash
aws cognito-idp update-user-pool \
    --user-pool-id YOUR_POOL_ID \
    --lambda-config '{
        "DefineAuthChallenge": "arn:aws:lambda:us-east-1:YOUR_ACCOUNT:function:defineAuthChallengeFaceID",
        "CreateAuthChallenge": "arn:aws:lambda:us-east-1:YOUR_ACCOUNT:function:createAuthChallengeFaceID",
        "VerifyAuthChallengeResponse": "arn:aws:lambda:us-east-1:YOUR_ACCOUNT:function:verifyAuthChallengeResponseFaceID"
    }'
```