# Lambda Functions Deployment Guide

## Prerequisites
1. Install AWS CLI: `brew install awscli` (on macOS)
2. Configure AWS CLI: `aws configure`

## Manual Deployment Steps

### 1. Create IAM Role
```bash
aws iam create-role \
    --role-name CognitoLambdaRole \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "lambda.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }'

aws iam attach-role-policy \
    --role-name CognitoLambdaRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 2. Create Lambda Functions
```bash
cd lambda

# DefineAuthChallenge
zip defineAuthChallenge.zip defineAuthChallenge.js
aws lambda create-function \
    --function-name DefineAuthChallenge \
    --runtime nodejs18.x \
    --role arn:aws:iam::YOUR_ACCOUNT_ID:role/CognitoLambdaRole \
    --handler defineAuthChallenge.handler \
    --zip-file fileb://defineAuthChallenge.zip

# CreateAuthChallenge  
zip createAuthChallenge.zip createAuthChallenge.js
aws lambda create-function \
    --function-name CreateAuthChallenge \
    --runtime nodejs18.x \
    --role arn:aws:iam::YOUR_ACCOUNT_ID:role/CognitoLambdaRole \
    --handler createAuthChallenge.handler \
    --zip-file fileb://createAuthChallenge.zip

# VerifyAuthChallengeResponse
zip verifyAuthChallengeResponse.zip verifyAuthChallengeResponse.js
aws lambda create-function \
    --function-name VerifyAuthChallengeResponse \
    --runtime nodejs18.x \
    --role arn:aws:iam::YOUR_ACCOUNT_ID:role/CognitoLambdaRole \
    --handler verifyAuthChallengeResponse.handler \
    --zip-file fileb://verifyAuthChallengeResponse.zip
```

### 3. Configure Cognito User Pool
```bash
aws cognito-idp update-user-pool \
    --user-pool-id us-east-1_U8n3Je4rK \
    --lambda-config "DefineAuthChallenge=arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:DefineAuthChallenge,CreateAuthChallenge=arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:CreateAuthChallenge,VerifyAuthChallengeResponse=arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:VerifyAuthChallengeResponse"
```

### 4. Add Lambda Permissions
```bash
aws lambda add-permission \
    --function-name DefineAuthChallenge \
    --statement-id cognito-trigger \
    --action lambda:InvokeFunction \
    --principal cognito-idp.amazonaws.com \
    --source-arn "arn:aws:cognito-idp:us-east-1:YOUR_ACCOUNT_ID:userpool/us-east-1_U8n3Je4rK"

aws lambda add-permission \
    --function-name CreateAuthChallenge \
    --statement-id cognito-trigger \
    --action lambda:InvokeFunction \
    --principal cognito-idp.amazonaws.com \
    --source-arn "arn:aws:cognito-idp:us-east-1:YOUR_ACCOUNT_ID:userpool/us-east-1_U8n3Je4rK"

aws lambda add-permission \
    --function-name VerifyAuthChallengeResponse \
    --statement-id cognito-trigger \
    --action lambda:InvokeFunction \
    --principal cognito-idp.amazonaws.com \
    --source-arn "arn:aws:cognito-idp:us-east-1:YOUR_ACCOUNT_ID:userpool/us-east-1_U8n3Je4rK"
```

## Alternative: AWS Console Deployment

1. **Create Lambda Functions via Console:**
   - Go to AWS Lambda Console
   - Create 3 functions with Node.js 18.x runtime
   - Copy code from `lambda/` directory files
   - Set execution role to `CognitoLambdaRole`

2. **Configure Cognito Triggers:**
   - Go to Cognito User Pool Console
   - Select your pool: `us-east-1_U8n3Je4rK`
   - Go to "User pool properties" → "Lambda triggers"
   - Set:
     - Define auth challenge: `DefineAuthChallenge`
     - Create auth challenge: `CreateAuthChallenge`
     - Verify auth challenge: `VerifyAuthChallengeResponse`

## Files Created:
- `lambda/defineAuthChallenge.js` - Defines custom auth flow
- `lambda/createAuthChallenge.js` - Creates WebAuthn challenge
- `lambda/verifyAuthChallengeResponse.js` - Verifies biometric response

Replace `YOUR_ACCOUNT_ID` with your actual AWS account ID.