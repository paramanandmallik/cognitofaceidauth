#!/bin/bash

# Set your AWS region and User Pool ID
REGION="us-east-1"
USER_POOL_ID="us-east-1_U8n3Je4rK"

echo "🚀 Deploying Cognito Lambda Triggers..."

# Create IAM role for Lambda functions
echo "📝 Creating IAM role..."
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
    }' \
    --region $REGION

# Attach basic execution policy
aws iam attach-role-policy \
    --role-name CognitoLambdaRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
    --region $REGION

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/CognitoLambdaRole"

echo "⏳ Waiting for role to propagate..."
sleep 10

# Create Lambda functions
echo "📦 Creating DefineAuthChallenge function..."
cd lambda
zip defineAuthChallenge.zip defineAuthChallenge.js
aws lambda create-function \
    --function-name DefineAuthChallenge \
    --runtime nodejs18.x \
    --role $ROLE_ARN \
    --handler defineAuthChallenge.handler \
    --zip-file fileb://defineAuthChallenge.zip \
    --region $REGION

echo "📦 Creating CreateAuthChallenge function..."
zip createAuthChallenge.zip createAuthChallenge.js
aws lambda create-function \
    --function-name CreateAuthChallenge \
    --runtime nodejs18.x \
    --role $ROLE_ARN \
    --handler createAuthChallenge.handler \
    --zip-file fileb://createAuthChallenge.zip \
    --region $REGION

echo "📦 Creating VerifyAuthChallengeResponse function..."
zip verifyAuthChallengeResponse.zip verifyAuthChallengeResponse.js
aws lambda create-function \
    --function-name VerifyAuthChallengeResponse \
    --runtime nodejs18.x \
    --role $ROLE_ARN \
    --handler verifyAuthChallengeResponse.handler \
    --zip-file fileb://verifyAuthChallengeResponse.zip \
    --region $REGION

cd ..

# Get Lambda ARNs
DEFINE_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:DefineAuthChallenge"
CREATE_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:CreateAuthChallenge"
VERIFY_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:VerifyAuthChallengeResponse"

echo "🔗 Configuring Cognito User Pool triggers..."
aws cognito-idp update-user-pool \
    --user-pool-id $USER_POOL_ID \
    --lambda-config "DefineAuthChallenge=${DEFINE_ARN},CreateAuthChallenge=${CREATE_ARN},VerifyAuthChallengeResponse=${VERIFY_ARN}" \
    --region $REGION

# Add permissions for Cognito to invoke Lambda functions
echo "🔐 Adding Lambda permissions..."
aws lambda add-permission \
    --function-name DefineAuthChallenge \
    --statement-id cognito-trigger \
    --action lambda:InvokeFunction \
    --principal cognito-idp.amazonaws.com \
    --source-arn "arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/${USER_POOL_ID}" \
    --region $REGION

aws lambda add-permission \
    --function-name CreateAuthChallenge \
    --statement-id cognito-trigger \
    --action lambda:InvokeFunction \
    --principal cognito-idp.amazonaws.com \
    --source-arn "arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/${USER_POOL_ID}" \
    --region $REGION

aws lambda add-permission \
    --function-name VerifyAuthChallengeResponse \
    --statement-id cognito-trigger \
    --action lambda:InvokeFunction \
    --principal cognito-idp.amazonaws.com \
    --source-arn "arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/${USER_POOL_ID}" \
    --region $REGION

echo "✅ Lambda functions deployed and configured!"
echo "📋 Function ARNs:"
echo "   DefineAuthChallenge: $DEFINE_ARN"
echo "   CreateAuthChallenge: $CREATE_ARN"
echo "   VerifyAuthChallengeResponse: $VERIFY_ARN"