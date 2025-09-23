# Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client    │    │   AWS Cognito    │    │ Lambda Triggers │
│                 │    │   User Pool      │    │                 │
│ ┌─────────────┐ │    │                  │    │ ┌─────────────┐ │
│ │  WebAuthn   │◄┼────┼►  Custom Auth   ◄┼────┼►│DefineAuth   │ │
│ │  Service    │ │    │     Flow         │    │ │Challenge    │ │
│ └─────────────┘ │    │                  │    │ └─────────────┘ │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │                  │    │ ┌─────────────┐ │
│ │ Face ID/    │ │    │                  │    │ │CreateAuth   │ │
│ │ Touch ID    │ │    │                  │    │ │Challenge    │ │
│ └─────────────┘ │    │                  │    │ └─────────────┘ │
│                 │    │                  │    │                 │
│                 │    │                  │    │ ┌─────────────┐ │
│                 │    │                  │    │ │VerifyAuth   │ │
│                 │    │                  │    │ │Challenge    │ │
│                 │    │                  │    │ └─────────────┘ │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Flow

1. User initiates biometric authentication in web client
2. WebAuthn API triggers Face ID/Touch ID prompt
3. Cognito User Pool processes custom authentication flow
4. Lambda triggers handle challenge creation and verification
5. Successful biometric verification returns JWT tokens