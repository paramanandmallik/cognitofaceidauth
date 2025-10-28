# Production Deployment Guide - API Gateway + Lambda + S3

This guide covers deploying the Face ID/Touch ID Cognito authentication app using AWS API Gateway, Lambda, and S3 for a fully serverless architecture.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Node.js 16+ installed
- Modern browser with WebAuthn support (Safari recommended for Mac)

## Step 1: Create IAM Role

```bash
aws iam create-role --role-name lambda-execution-role --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }
  ]
}'

aws iam attach-role-policy --role-name lambda-execution-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam attach-role-policy --role-name lambda-execution-role --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
```

## Step 2: Create S3 Bucket

```bash
BUCKET_NAME="faceid-auth-$(date +%s)"
aws s3 mb s3://$BUCKET_NAME
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role"},
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::'$BUCKET_NAME'/*"
    }
  ]
}'
```

## Step 3: Create Lambda Functions

```bash
cd lambda

# Install dependencies for API handler
npm install

# Package Lambda functions
zip defineAuthChallenge.zip defineAuthChallenge.js
zip createAuthChallenge.zip createAuthChallenge.js
zip verifyAuthChallengeResponse.zip verifyAuthChallengeResponse.js
zip preSignUp.zip preSignUp.js
zip -r api-auth-handler.zip apiAuthHandler.js package.json node_modules/

# Create Lambda functions
aws lambda create-function \
  --function-name cognito-define-auth-challenge \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler defineAuthChallenge.handler \
  --zip-file fileb://defineAuthChallenge.zip

aws lambda create-function \
  --function-name cognito-create-auth-challenge \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler createAuthChallenge.handler \
  --zip-file fileb://createAuthChallenge.zip

aws lambda create-function \
  --function-name cognito-verify-auth-challenge \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler verifyAuthChallengeResponse.handler \
  --zip-file fileb://verifyAuthChallengeResponse.zip

aws lambda create-function \
  --function-name cognito-pre-signup \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler preSignUp.handler \
  --zip-file fileb://preSignUp.zip

aws lambda create-function \
  --function-name api-auth-handler \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler apiAuthHandler.handler \
  --zip-file fileb://api-auth-handler.zip

cd ..
```

## Step 4: Create Cognito User Pool

```bash
USER_POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name "FaceIDAuthPool" \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true
    }
  }' \
  --lambda-config '{
    "PreSignUp": "arn:aws:lambda:us-east-1:YOUR_ACCOUNT:function:cognito-pre-signup",
    "DefineAuthChallenge": "arn:aws:lambda:us-east-1:YOUR_ACCOUNT:function:cognito-define-auth-challenge",
    "CreateAuthChallenge": "arn:aws:lambda:us-east-1:YOUR_ACCOUNT:function:cognito-create-auth-challenge",
    "VerifyAuthChallengeResponse": "arn:aws:lambda:us-east-1:YOUR_ACCOUNT:function:cognito-verify-auth-challenge"
  }' \
  --explicit-auth-flows ALLOW_CUSTOM_AUTH ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --query 'UserPool.Id' --output text)

CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-name "FaceIDAuthClient" \
  --explicit-auth-flows ALLOW_CUSTOM_AUTH ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --generate-secret \
  --query 'UserPoolClient.ClientId' --output text)

echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"
```

## Step 5: Create API Gateway

```bash
API_ID=$(aws apigateway create-rest-api --name faceid-auth-api --query 'id' --output text)
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[0].id' --output text)

# Create proxy resource
PROXY_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part '{proxy+}' \
  --query 'id' --output text)

# Add Lambda integration to root
aws apigateway put-method --rest-api-id $API_ID --resource-id $ROOT_ID --http-method ANY --authorization-type NONE
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $ROOT_ID \
  --http-method ANY \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:YOUR_ACCOUNT:function:api-auth-handler/invocations

# Add Lambda integration to proxy
aws apigateway put-method --rest-api-id $API_ID --resource-id $PROXY_ID --http-method ANY --authorization-type NONE
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $PROXY_ID \
  --http-method ANY \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:YOUR_ACCOUNT:function:api-auth-handler/invocations

# Deploy API
aws apigateway create-deployment --rest-api-id $API_ID --stage-name prod

# Add Lambda permissions
aws lambda add-permission \
  --function-name api-auth-handler \
  --statement-id api-gateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:YOUR_ACCOUNT:$API_ID/*/*"

echo "API Gateway URL: https://$API_ID.execute-api.us-east-1.amazonaws.com/prod"
```

## Step 6: Configure Application

Update `src/config.js` with your AWS resources:
```javascript
const cognitoConfig = {
  region: 'us-east-1',
  userPoolId: 'YOUR_USER_POOL_ID',
  userPoolWebClientId: 'YOUR_CLIENT_ID',
  userPoolWebClientSecret: 'YOUR_CLIENT_SECRET',
  domain: 'YOUR_COGNITO_DOMAIN',
  
  webAuthn: {
    rpId: 'YOUR_API_GATEWAY_ID.execute-api.us-east-1.amazonaws.com',
    rpName: 'Face ID Cognito Demo',
    timeout: 60000,
    userVerification: 'required',
    authenticatorAttachment: 'platform'
  }
};
```

Update Lambda functions with your API Gateway domain:
```javascript
// In lambda/createAuthChallenge.js
rpId: 'YOUR_API_GATEWAY_ID.execute-api.us-east-1.amazonaws.com'

// In lambda/verifyAuthChallengeResponse.js
const validOrigins = [
  'https://YOUR_API_GATEWAY_ID.execute-api.us-east-1.amazonaws.com'
];
```

## Step 7: Build and Deploy

```bash
# Build static files
node build-static.js
cp dist/app.js dist/bundle.js

# Upload to S3
aws s3 cp dist/ s3://$BUCKET_NAME/ --recursive

# Update Lambda functions with correct configuration
cd lambda
aws lambda update-function-code --function-name cognito-create-auth-challenge --zip-file fileb://createAuthChallenge.zip
aws lambda update-function-code --function-name cognito-verify-auth-challenge --zip-file fileb://verifyAuthChallengeResponse.zip
cd ..
```

## Step 8: Test Deployment

1. Open your API Gateway URL: `https://YOUR_API_GATEWAY_ID.execute-api.us-east-1.amazonaws.com/prod`
2. Test registration with biometrics
3. Test sign-in with Face ID/Touch ID

## Architecture Benefits

- **Fully Serverless**: No servers to manage
- **Auto-scaling**: Handles traffic spikes automatically
- **Cost-effective**: Pay only for what you use
- **High Availability**: Built-in redundancy
- **HTTPS by Default**: Secure communication
- **Global Distribution**: Fast worldwide access

## Monitoring and Logging

```bash
# View Lambda logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/"
aws logs tail /aws/lambda/api-auth-handler --follow

# View API Gateway logs (if enabled)
aws logs tail API-Gateway-Execution-Logs_YOUR_API_ID/prod --follow
```

## Production Optimizations

1. **Custom Domain**: Use Route 53 + ACM for custom domain
2. **WAF**: Enable AWS WAF for security
3. **CloudWatch Alarms**: Set up monitoring alerts
4. **DynamoDB**: Replace localStorage with DynamoDB
5. **Lambda Layers**: Optimize Lambda function sizes
6. **API Caching**: Enable API Gateway caching

## Security Considerations

- Lambda functions run with minimal IAM permissions
- S3 bucket is not publicly accessible
- WebAuthn provides phishing-resistant authentication
- All communication over HTTPS
- Credentials never leave the user's device

## Troubleshooting

1. **403 Errors**: Check Lambda permissions and S3 bucket policy
2. **500 Errors**: Check Lambda function logs in CloudWatch
3. **WebAuthn Failures**: Ensure HTTPS and correct rpId configuration
4. **Cognito Errors**: Verify Lambda trigger configuration