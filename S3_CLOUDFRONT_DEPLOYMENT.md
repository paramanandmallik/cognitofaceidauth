# S3 + CloudFront Deployment Guide

Simple deployment of Face ID/Touch ID Cognito app using S3 static hosting and CloudFront for global access.

## Prerequisites

- AWS CLI configured with mainkeys profile
- Lambda functions already deployed (from previous steps)
- Domain name (optional but recommended for production)

## Step 1: Build Static Files

Create `build-static.js`:
```javascript
const fs = require('fs');

// Create dist directory
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Read and update HTML to use bundled JS
let html = fs.readFileSync('src/index.html', 'utf8');
html = html.replace(
  /<script src="config\.js"><\/script>\s*<script src="webauthn\.js"><\/script>\s*<script src="cognito-auth\.js"><\/script>\s*<script src="index\.js"><\/script>/,
  '<script src="app.js"></script>'
);
fs.writeFileSync('dist/index.html', html);

// Bundle all JS files
const configTemplate = fs.readFileSync('src/config.template.js', 'utf8');
const webauthn = fs.readFileSync('src/webauthn.js', 'utf8');
const cognitoAuth = fs.readFileSync('src/cognito-auth.js', 'utf8');
const indexJs = fs.readFileSync('src/index.js', 'utf8');

const bundledJs = `${configTemplate}\n\n${webauthn}\n\n${cognitoAuth}\n\n${indexJs}`;
fs.writeFileSync('dist/app.js', bundledJs);

console.log('✅ Static files built in dist/ directory');
```

### 1.2 Build Files
```bash
node build-static.js
```

### 1.3 Update Configuration
Edit `dist/app.js` and replace placeholders:
```javascript
const cognitoConfig = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_U8n3Je4rK',
  userPoolWebClientId: '4ebk2m0223bp6sb7sjk8ioi9ed',
  userPoolWebClientSecret: '7bqa6e5l5ne50cg5cedojj4em3ll4c65p0tr6g40o9ecuoqh5vv',
  domain: 'us-east-1u8n3je4rk.auth.us-east-1.amazoncognito.com',
  
  webAuthn: {
    rpId: 'YOUR_CLOUDFRONT_DOMAIN', // Update this after CloudFront setup
    rpName: 'Face ID Auth Production',
    timeout: 60000,
    userVerification: 'required',
    authenticatorAttachment: 'platform'
  }
};
```

## Step 2: Create S3 Bucket

### 2.1 Create Bucket
```bash
# Create unique bucket name
BUCKET_NAME="faceid-auth-$(date +%s)"

aws s3 mb s3://$BUCKET_NAME --profile mainkeys
```

### 2.2 Configure Static Website Hosting
```bash
aws s3 website s3://$BUCKET_NAME \
  --index-document index.html \
  --error-document index.html \
  --profile mainkeys
```

### 2.3 Upload Files
```bash
aws s3 sync dist/ s3://$BUCKET_NAME \
  --delete \
  --profile mainkeys
```

### 2.4 Set Bucket Policy for Public Read
```bash
cat > bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket $BUCKET_NAME \
  --policy file://bucket-policy.json \
  --profile mainkeys
```

## Step 3: Create CloudFront Distribution (Use AWS Console)

### 3.1 Create Distribution via Console
1. Go to **CloudFront Console**
2. **Create Distribution**
3. **Origin Domain**: Select your S3 bucket
4. **Viewer Protocol Policy**: Redirect HTTP to HTTPS
5. **Default Root Object**: index.html
6. **Create Distribution**

### 3.2 Get CloudFront Domain
After creation, note the **Distribution Domain Name** (e.g., `d1234567890.cloudfront.net`)

## Step 4: Update Configuration for CloudFront

### 4.1 Update rpId in Lambda Functions
Update `lambda/createAuthChallenge.js`:
```javascript
event.response.publicChallengeParameters = {
  challenge: challenge,
  rpName: 'Face ID Auth Production',
  rpId: 'YOUR_CLOUDFRONT_DOMAIN', // e.g., d1234567890.cloudfront.net
  userVerification: 'required',
  authenticatorAttachment: 'platform'
};
```

### 4.2 Update and Redeploy Lambda
```bash
cd lambda
zip createAuthChallenge.zip createAuthChallenge.js

aws lambda update-function-code \
  --function-name cognito-create-auth-challenge \
  --zip-file fileb://createAuthChallenge.zip \
  --profile mainkeys
```

### 4.3 Update Client Configuration
Update `dist/app.js` rpId:
```javascript
webAuthn: {
  rpId: 'YOUR_CLOUDFRONT_DOMAIN', // e.g., d1234567890.cloudfront.net
  rpName: 'Face ID Auth Production',
  // ... rest of config
}
```

### 4.4 Re-upload to S3
```bash
aws s3 sync dist/ s3://$BUCKET_NAME \
  --delete \
  --profile mainkeys
```

## Step 5: Test Deployment

### 5.1 Access Application
- Open `https://YOUR_CLOUDFRONT_DOMAIN`
- Test registration with biometrics
- Test sign-in with Face ID/Touch ID

### 5.2 Mobile Testing
- Test on iOS Safari (required for Face ID)
- Test on Android Chrome (for fingerprint)
- Verify HTTPS is working (required for WebAuthn)

## Quick Deployment Commands

```bash
# 1. Build static files
node build-static.js

# 2. Create S3 bucket and upload
BUCKET_NAME="faceid-auth-$(date +%s)"
aws s3 mb s3://$BUCKET_NAME --profile mainkeys
aws s3 website s3://$BUCKET_NAME --index-document index.html --profile mainkeys
aws s3 sync dist/ s3://$BUCKET_NAME --profile mainkeys

# 3. Set public read policy
echo '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::'$BUCKET_NAME'/*"}]}' > policy.json
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://policy.json --profile mainkeys

# 4. Create CloudFront via AWS Console
# 5. Update rpId in Lambda and client config
# 6. Test at CloudFront URL
```

## Cost Estimation

- S3 Storage: ~$0.50/month
- CloudFront: ~$1-5/month
- Lambda: ~$0.20/month
- Cognito: Free tier

**Total: ~$2-6/month**

## Troubleshooting

1. **WebAuthn not working**: Ensure HTTPS via CloudFront
2. **rpId mismatch**: Update both Lambda and client config
3. **Cache issues**: Invalidate CloudFront cache after updates