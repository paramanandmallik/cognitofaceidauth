const authService = new CognitoAuthService();
const webAuthnService = new WebAuthnService();

let currentTab = 'register';

document.addEventListener('DOMContentLoaded', async () => {
  await new Promise(resolve => {
    const checkLibraries = () => {
      if (typeof AWS !== 'undefined' && typeof AmazonCognitoIdentity !== 'undefined') {
        resolve();
      } else {
        setTimeout(checkLibraries, 100);
      }
    };
    checkLibraries();
  });
  
  await checkDeviceSupport();
  await checkCurrentUser();
  setupEventListeners();
});

async function checkDeviceSupport() {
  const supportElement = document.getElementById('deviceSupport');
  const authElement = document.getElementById('availableAuth');

  try {
    const isSupported = await webAuthnService.isWebAuthnSupported();
    const authenticators = await webAuthnService.getAvailableAuthenticators();

    if (isSupported) {
      supportElement.textContent = '✅ WebAuthn Supported';
      supportElement.style.color = '#28a745';
    } else {
      supportElement.textContent = '❌ WebAuthn Not Supported';
      supportElement.style.color = '#dc3545';
    }

    if (authenticators.length > 0) {
      authElement.textContent = authenticators.join(', ');
      authElement.style.color = '#28a745';
    } else {
      authElement.textContent = 'None detected';
      authElement.style.color = '#dc3545';
    }

  } catch (error) {
    console.error('Error checking device support:', error);
    supportElement.textContent = 'Error checking support';
    authElement.textContent = 'Error detecting authenticators';
  }
}

async function checkCurrentUser() {
  try {
    const user = await authService.getCurrentUser();
    if (user) {
      showUserInfo(user);
    }
  } catch (error) {
    console.log('No current user session');
  }
}

function setupEventListeners() {
  window.switchTab = (tabName) => {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');

    currentTab = tabName;
  };

  document.getElementById('registerEmail').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') registerUser();
  });
  
  document.getElementById('registerUsername').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') registerUser();
  });
  
  document.getElementById('loginUsername').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') signInWithBiometrics();
  });
}

window.registerUser = async () => {
  const email = document.getElementById('registerEmail').value.trim();
  const username = document.getElementById('registerUsername').value.trim();

  if (!email || !username) {
    showStatus('Please fill in all fields', 'error');
    return;
  }

  if (!email.includes('@')) {
    showStatus('Please enter a valid email address', 'error');
    return;
  }

  if (!await webAuthnService.isWebAuthnSupported()) {
    showStatus('WebAuthn not supported on this device', 'error');
    return;
  }

  try {
    showStatus('Registering user and setting up biometrics...', 'info');
    
    const result = await authService.registerWithBiometrics(username, email);
    
    if (result.success) {
      showStatus(result.message, 'success');
      document.getElementById('registerEmail').value = '';
      document.getElementById('registerUsername').value = '';
      switchTab('login');
      document.getElementById('loginUsername').value = result.loginUsername || email;
      showStatus(`Registration complete! Use "${result.loginUsername || email}" to sign in with biometrics.`, 'success');
    } else {
      showStatus(result.message || 'Registration failed', 'error');
    }

  } catch (error) {
    console.error('Registration error:', error);
    showStatus(error.message, 'error');
  }
};

window.signInWithBiometrics = async () => {
  const username = document.getElementById('loginUsername').value.trim();

  if (!username) {
    showStatus('Please enter your email address', 'error');
    return;
  }

  if (!await webAuthnService.isWebAuthnSupported()) {
    showStatus('WebAuthn not supported on this device', 'error');
    return;
  }

  try {
    showStatus('Authenticating with Face ID/Touch ID...', 'info');
    
    const result = await authService.signInWithBiometrics(username);
    
    if (result.success) {
      showStatus(result.message, 'success');
      showUserInfo(result.user);
    } else {
      showStatus(result.message || 'Authentication failed', 'error');
    }

  } catch (error) {
    console.error('Biometric sign-in error:', error);
    let errorMessage = error.message;
    
    if (errorMessage.includes('No WebAuthn credentials found')) {
      errorMessage = 'No biometric credentials found. Please register first or check your email address.';
    } else if (errorMessage.includes('User not found')) {
      errorMessage = 'User not found. Please check your email address or register first.';
    } else if (errorMessage.includes('NotAllowedError')) {
      errorMessage = 'Biometric authentication was cancelled or failed. Please try again.';
    }
    
    showStatus(errorMessage, 'error');
  }
};

window.signInWithPassword = async () => {
  const username = document.getElementById('loginUsername').value.trim();
  
  if (!username) {
    showStatus('Please enter your username', 'error');
    return;
  }

  const password = prompt('Enter your password:');
  if (!password) return;

  try {
    showStatus('Authenticating with password...', 'info');
    
    const result = await authService.signInWithPassword(username, password);
    
    if (result.success) {
      showStatus(result.message, 'success');
      showUserInfo(result.user);
    } else {
      showStatus(result.message || 'Authentication failed', 'error');
    }

  } catch (error) {
    console.error('Password sign-in error:', error);
    showStatus(error.message, 'error');
  }
};

window.signOut = async () => {
  try {
    const result = await authService.signOut();
    showStatus(result.message, 'success');
    hideUserInfo();
  } catch (error) {
    console.error('Sign-out error:', error);
    showStatus(error.message, 'error');
  }
};

function showStatus(message, type = 'info') {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
  statusElement.style.display = 'block';

  if (type === 'success' || type === 'info') {
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 5000);
  }
}

function showUserInfo(user) {
  document.getElementById('currentUser').textContent = user.username || user.signInDetails?.loginId || 'Unknown';
  document.getElementById('userInfo').classList.remove('hidden');
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = 'none';
  });
  document.querySelector('.tabs').style.display = 'none';
}

function hideUserInfo() {
  document.getElementById('userInfo').classList.add('hidden');
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = 'block';
  });
  document.querySelector('.tabs').style.display = 'flex';
  
  switchTab(currentTab);
}