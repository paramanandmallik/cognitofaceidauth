# Production Deployment Guide

This guide covers deploying the Face ID/Touch ID Cognito authentication app to AWS with a public IP address accessible from any device.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Domain name (optional but recommended)
- SSL certificate (for HTTPS - required for WebAuthn)

## Step 1: Deploy Lambda Functions

### 1.1 Create Lambda Functions
```bash
# Create deployment package
zip -r lambda-functions.zip lambda/

# Create Lambda functions
aws lambda create-function \
  --function-name cognito-define-auth-challenge \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler defineAuthChallenge.handler \
  --zip-file fileb://lambda-functions.zip

aws lambda create-function \
  --function-name cognito-create-auth-challenge \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler createAuthChallenge.handler \
  --zip-file fileb://lambda-functions.zip

aws lambda create-function \
  --function-name cognito-verify-auth-challenge \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler verifyAuthChallengeResponse.handler \
  --zip-file fileb://lambda-functions.zip

aws lambda create-function \
  --function-name cognito-pre-signup \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler preSignUp.handler \
  --zip-file fileb://lambda-functions.zip
```

### 1.2 Update Lambda Function Code
```bash
# Update each function with individual files
aws lambda update-function-code \
  --function-name cognito-define-auth-challenge \
  --zip-file fileb://lambda/defineAuthChallenge.zip

aws lambda update-function-code \
  --function-name cognito-create-auth-challenge \
  --zip-file fileb://lambda/createAuthChallenge.zip

aws lambda update-function-code \
  --function-name cognito-verify-auth-challenge \
  --zip-file fileb://lambda/verifyAuthChallengeResponse.zip

aws lambda update-function-code \
  --function-name cognito-pre-signup \
  --zip-file fileb://lambda/preSignUp.zip
```

## Step 2: Configure Cognito User Pool

### 2.1 Create User Pool
```bash
aws cognito-idp create-user-pool \
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
    "PreSignUp": "arn:aws:lambda:REGION:ACCOUNT:function:cognito-pre-signup",
    "DefineAuthChallenge": "arn:aws:lambda:REGION:ACCOUNT:function:cognito-define-auth-challenge",
    "CreateAuthChallenge": "arn:aws:lambda:REGION:ACCOUNT:function:cognito-create-auth-challenge",
    "VerifyAuthChallengeResponse": "arn:aws:lambda:REGION:ACCOUNT:function:cognito-verify-auth-challenge"
  }' \
  --explicit-auth-flows ALLOW_CUSTOM_AUTH ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH
```

### 2.2 Create App Client
```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-name "FaceIDAuthClient" \
  --explicit-auth-flows ALLOW_CUSTOM_AUTH ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --generate-secret
```

## Step 3: Deploy Frontend to EC2

### 3.1 Launch EC2 Instance
```bash
# Launch Ubuntu instance
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.micro \
  --key-name YOUR_KEY_PAIR \
  --security-group-ids sg-YOUR_SECURITY_GROUP \
  --subnet-id subnet-YOUR_SUBNET \
  --associate-public-ip-address
```

### 3.2 Configure Security Group
```bash
# Allow HTTP, HTTPS, and SSH
aws ec2 authorize-security-group-ingress \
  --group-id sg-YOUR_SECURITY_GROUP \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-YOUR_SECURITY_GROUP \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-YOUR_SECURITY_GROUP \
  --protocol tcp \
  --port 22 \
  --cidr YOUR_IP/32
```

### 3.3 Setup Server on EC2
```bash
# SSH into instance
ssh -i your-key.pem ubuntu@YOUR_PUBLIC_IP

# Install Node.js and dependencies
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx

# Clone and setup application
git clone YOUR_REPO_URL /var/www/faceid-auth
cd /var/www/faceid-auth
npm install
```

## Step 4: Configure Domain and SSL

### 4.1 Setup Domain (Optional)
```bash
# Point your domain to EC2 public IP
# Update DNS A record: your-domain.com -> YOUR_EC2_PUBLIC_IP
```

### 4.2 Configure SSL Certificate
```bash
# Using Let's Encrypt (if you have a domain)
sudo certbot --nginx -d your-domain.com

# Or use self-signed certificate for IP access
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/selfsigned.key \
  -out /etc/ssl/certs/selfsigned.crt
```

## Step 5: Configure Nginx

### 5.1 Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/faceid-auth
```

Add configuration:
```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name YOUR_DOMAIN_OR_IP;

    ssl_certificate /etc/ssl/certs/selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/selfsigned.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/faceid-auth /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 6: Update Application Configuration

### 6.1 Update config.js for Production
```javascript
const cognitoConfig = {
  region: 'us-east-1',
  userPoolId: 'YOUR_PRODUCTION_USER_POOL_ID',
  userPoolWebClientId: 'YOUR_PRODUCTION_CLIENT_ID',
  userPoolWebClientSecret: 'YOUR_PRODUCTION_CLIENT_SECRET',
  domain: 'YOUR_COGNITO_DOMAIN',
  
  webAuthn: {
    rpId: 'your-domain.com', // or IP address
    rpName: 'Face ID Auth Production',
    timeout: 60000,
    userVerification: 'required',
    authenticatorAttachment: 'platform'
  }
};
```

### 6.2 Update Lambda Functions for Production
Update `createAuthChallenge.js`:
```javascript
event.response.publicChallengeParameters = {
  challenge: challenge,
  rpName: 'Face ID Auth Production',
  rpId: 'your-domain.com', // Update this
  userVerification: 'required',
  authenticatorAttachment: 'platform'
};
```

## Step 7: Start Application

### 7.1 Create Systemd Service
```bash
sudo nano /etc/systemd/system/faceid-auth.service
```

Add service configuration:
```ini
[Unit]
Description=Face ID Auth Application
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/faceid-auth
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### 7.2 Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable faceid-auth
sudo systemctl start faceid-auth
sudo systemctl status faceid-auth
```

## Step 8: Test Deployment

### 8.1 Access Application
- Open browser and navigate to `https://your-domain.com` or `https://YOUR_EC2_IP`
- Test registration with biometrics
- Test sign-in with Face ID/Touch ID

### 8.2 Mobile Device Testing
- Ensure HTTPS is working (required for WebAuthn)
- Test on iOS Safari and Android Chrome
- Verify biometric prompts work correctly

## Step 9: Production Optimizations

### 9.1 Database Storage (Replace localStorage)
```bash
# Create DynamoDB table for credentials
aws dynamodb create-table \
  --table-name WebAuthnCredentials \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=credentialId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=credentialId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST
```

### 9.2 CloudWatch Monitoring
```bash
# Enable detailed monitoring
aws logs create-log-group --log-group-name /aws/lambda/cognito-auth-functions
aws logs create-log-group --log-group-name /var/log/faceid-auth
```

### 9.3 Auto Scaling (Optional)
```bash
# Create Application Load Balancer
aws elbv2 create-load-balancer \
  --name faceid-auth-alb \
  --subnets subnet-12345 subnet-67890 \
  --security-groups sg-YOUR_SECURITY_GROUP

# Create Auto Scaling Group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name faceid-auth-asg \
  --launch-template LaunchTemplateName=faceid-auth-template \
  --min-size 1 \
  --max-size 3 \
  --desired-capacity 2 \
  --target-group-arns arn:aws:elasticloadbalancing:region:account:targetgroup/faceid-auth-tg
```

## Step 10: Security Hardening

### 10.1 Update Security Groups
- Restrict SSH access to specific IPs
- Use WAF for additional protection
- Enable VPC Flow Logs

### 10.2 Enable CloudTrail
```bash
aws cloudtrail create-trail \
  --name faceid-auth-trail \
  --s3-bucket-name your-cloudtrail-bucket
```

## Troubleshooting

### Common Issues:
1. **WebAuthn not working**: Ensure HTTPS is properly configured
2. **CORS errors**: Update Cognito CORS settings
3. **Lambda timeouts**: Increase timeout values
4. **Certificate issues**: Verify SSL certificate is valid

### Logs to Check:
- CloudWatch Logs for Lambda functions
- Nginx access/error logs: `/var/log/nginx/`
- Application logs: `journalctl -u faceid-auth`

## Cost Estimation

- EC2 t3.micro: ~$8.50/month
- Lambda executions: ~$0.20/month (1000 requests)
- Cognito: Free tier covers 50,000 MAUs
- Data transfer: ~$1-5/month depending on usage

Total estimated cost: ~$10-15/month for small-scale deployment.