#!/bin/bash

# Set your AWS region
REGION="us-east-1"

echo "🧹 Cleaning up existing Lambda functions..."

# Delete existing Lambda functions
echo "🗑️ Deleting DefineAuthChallenge function..."
aws lambda delete-function \
    --function-name DefineAuthChallenge \
    --region $REGION 2>/dev/null || echo "Function DefineAuthChallenge not found"

echo "🗑️ Deleting CreateAuthChallenge function..."
aws lambda delete-function \
    --function-name CreateAuthChallenge \
    --region $REGION 2>/dev/null || echo "Function CreateAuthChallenge not found"

echo "🗑️ Deleting VerifyAuthChallengeResponse function..."
aws lambda delete-function \
    --function-name VerifyAuthChallengeResponse \
    --region $REGION 2>/dev/null || echo "Function VerifyAuthChallengeResponse not found"

# Delete IAM role
echo "🗑️ Deleting IAM role..."
aws iam detach-role-policy \
    --role-name CognitoLambdaRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
    --region $REGION 2>/dev/null || echo "Policy not attached"

aws iam delete-role \
    --role-name CognitoLambdaRole \
    --region $REGION 2>/dev/null || echo "Role CognitoLambdaRole not found"

echo "✅ Cleanup completed!"