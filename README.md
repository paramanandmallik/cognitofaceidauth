# Face ID/Touch ID Authentication with Amazon Cognito

A complete serverless application demonstrating biometric authentication using Face ID and Touch ID with Amazon Cognito User Pools, deployed on AWS API Gateway.

## Features

- **Biometric Authentication**: Face ID and Touch ID support on Mac/iOS
- **WebAuthn Integration**: Standards-compliant passwordless authentication
- **Cognito Integration**: Seamless integration with AWS Cognito User Pools
- **Serverless Deployment**: API Gateway + Lambda + S3 architecture
- **Auto-confirmation**: Users are automatically confirmed via Lambda triggers
- **Secure Storage**: Client-side credential management with localStorage
- **Fallback Support**: Password-based authentication as backup

## Architecture

The application uses a serverless architecture deployed on AWS:

- **API Gateway**: Serves static files and provides HTTPS endpoint
- **Lambda Functions**: Handle Cognito triggers and static file serving
- **S3**: Stores static assets (HTML, CSS, JavaScript)
- **Cognito User Pool**: Manages users and authentication flow
- **WebAuthn**: Provides biometric authentication capabilities

## Prerequisites

- AWS CLI configured with appropriate permissions
- Node.js 16+ installed
- Modern browser with WebAuthn support (Safari recommended for Mac)

## Quick Setup

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/cognitofaceidauth.git
cd cognitofaceidauth
```

### 2. Install Dependencies
```bash
npm install
cd lambda && npm install && cd ..
```

### 3. Configure AWS Resources

#### Create IAM Role
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

#### Create S3 Bucket
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

#### Create Lambda Functions
```bash
# Package Lambda functions
cd lambda
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

#### Create Cognito User Pool
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
```

#### Create API Gateway
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
```

### 4. Configure Application

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

### 5. Build and Deploy

```bash
# Build static files
node build-static.js
cp dist/app.js dist/bundle.js

# Upload to S3
aws s3 cp dist/ s3://$BUCKET_NAME/ --recursive

# Update Lambda functions
cd lambda
aws lambda update-function-code --function-name cognito-create-auth-challenge --zip-file fileb://createAuthChallenge.zip
aws lambda update-function-code --function-name cognito-verify-auth-challenge --zip-file fileb://verifyAuthChallengeResponse.zip
cd ..
```

### 6. Test Application

Open your API Gateway URL: `https://YOUR_API_GATEWAY_ID.execute-api.us-east-1.amazonaws.com/prod`

## Usage

### Registration
1. Enter email and username
2. Click "Register with Biometrics"
3. Complete Face ID/Touch ID prompt
4. Account created and auto-confirmed

### Authentication
1. Enter email address
2. Click "Sign In with Face ID/Touch ID"
3. Complete biometric verification
4. Successfully authenticated

## Browser Compatibility

| Browser | Mac Support | Notes |
|---------|-------------|-------|
| Safari  | ✅ Full     | Recommended for best experience |
| Chrome  | ✅ Full     | Requires HTTPS |
| Firefox | ✅ Limited  | Basic WebAuthn support |
| Edge    | ✅ Full     | Chromium-based |

## Security Features

- **No Password Storage**: Eliminates password-based vulnerabilities
- **Device-Bound Credentials**: Biometrics never leave the device
- **Public Key Cryptography**: FIDO2/WebAuthn standards
- **Phishing Resistant**: Domain-bound authentication
- **Replay Protection**: Challenge-response mechanism
- **Auto-confirmation**: Secure user onboarding

## Troubleshooting

### Common Issues

1. **"WebAuthn Not Supported"**
   - Ensure using HTTPS (required for WebAuthn)
   - Use Safari on Mac for best compatibility
   - Check if Face ID/Touch ID is enabled

2. **"No biometric credentials found"**
   - Complete registration process first
   - Check browser storage permissions
   - Clear localStorage and re-register if needed

3. **Authentication Fails**
   - Verify Cognito configuration
   - Check Lambda function logs in CloudWatch
   - Ensure biometric sensor is working

4. **API Gateway 403 Errors**
   - Check Lambda permissions
   - Verify S3 bucket policy
   - Ensure correct file paths

## Production Considerations

- Replace localStorage with DynamoDB for credential storage
- Implement proper server-side WebAuthn verification
- Add comprehensive logging and monitoring
- Set up CloudWatch alarms
- Enable AWS WAF for API Gateway
- Use custom domain with SSL certificate

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review AWS Cognito documentation
3. Check WebAuthn browser compatibility
4. Open an issue in this repository
