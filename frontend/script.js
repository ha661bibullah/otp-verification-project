const API_BASE_URL = 'http://localhost:3000/api';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const dashboard = document.getElementById('dashboard');
const emailForm = document.getElementById('emailForm');
const otpSection = document.getElementById('otpSection');
const otpForm = document.getElementById('otpForm');
const messageDiv = document.getElementById('message');
const userInfoDiv = document.getElementById('userInfo');
const sendOtpBtn = document.getElementById('sendOtpBtn');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const resendOtpBtn = document.getElementById('resendOtpBtn');
const logoutBtn = document.getElementById('logoutBtn');

let currentEmail = '';
let authToken = '';

// Show message
function showMessage(message, type = 'error') {
    messageDiv.textContent = message;
    messageDiv.className = `mt-4 p-3 rounded-md ${
        type === 'error' ? 'bg-red-100 text-red-700 border border-red-300' : 
        type === 'success' ? 'bg-green-100 text-green-700 border border-green-300' : 
        'bg-blue-100 text-blue-700 border border-blue-300'
    }`;
    messageDiv.classList.remove('hidden');
    
    // Auto hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            messageDiv.classList.add('hidden');
        }, 5000);
    }
}

// Send OTP
async function sendOTP(email) {
    try {
        sendOtpBtn.disabled = true;
        sendOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        
        const response = await fetch(`${API_BASE_URL}/send-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('OTP sent to your email successfully!', 'success');
            otpSection.classList.remove('hidden');
            currentEmail = email;
            
            // Start countdown for resend
            startResendCountdown();
        } else {
            showMessage(data.message || 'Failed to send OTP');
        }
    } catch (error) {
        console.error('Error sending OTP:', error);
        showMessage('Network error. Please try again.');
    } finally {
        sendOtpBtn.disabled = false;
        sendOtpBtn.textContent = 'Send OTP';
    }
}

// Verify OTP
async function verifyOTP(email, otp) {
    try {
        verifyOtpBtn.disabled = true;
        verifyOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        
        const response = await fetch(`${API_BASE_URL}/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, otp }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Login successful!', 'success');
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            showDashboard(data.user);
        } else {
            showMessage(data.message || 'Invalid OTP');
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        showMessage('Network error. Please try again.');
    } finally {
        verifyOtpBtn.disabled = false;
        verifyOtpBtn.textContent = 'Verify OTP';
    }
}

// Show dashboard
function showDashboard(user) {
    loginForm.classList.add('hidden');
    dashboard.classList.remove('hidden');
    
    userInfoDiv.innerHTML = `
        <h3 class="font-semibold text-lg mb-2">Welcome!</h3>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Login Time:</strong> ${new Date().toLocaleString()}</p>
    `;
}

// Logout
async function logout() {
    try {
        if (authToken) {
            await fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
            });
        }
        
        // Clear local storage and reset state
        localStorage.removeItem('authToken');
        authToken = '';
        currentEmail = '';
        
        // Show login form
        dashboard.classList.add('hidden');
        loginForm.classList.remove('hidden');
        otpSection.classList.add('hidden');
        emailForm.reset();
        otpForm.reset();
        messageDiv.classList.add('hidden');
    } catch (error) {
        console.error('Error during logout:', error);
    }
}

// Check authentication status on page load
async function checkAuth() {
    const token = localStorage.getItem('authToken');
    
    if (token) {
        try {
            const response = await fetch(`${API_BASE_URL}/check-auth`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            const data = await response.json();
            
            if (data.authenticated) {
                authToken = token;
                showDashboard(data.user);
            } else {
                localStorage.removeItem('authToken');
            }
        } catch (error) {
            console.error('Error checking auth:', error);
            localStorage.removeItem('authToken');
        }
    }
}

// Resend OTP countdown
function startResendCountdown() {
    let countdown = 60;
    resendOtpBtn.disabled = true;
    
    const interval = setInterval(() => {
        resendOtpBtn.textContent = `Resend OTP (${countdown}s)`;
        countdown--;
        
        if (countdown < 0) {
            clearInterval(interval);
            resendOtpBtn.disabled = false;
            resendOtpBtn.textContent = 'Resend OTP';
        }
    }, 1000);
}

// Event Listeners
emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    
    if (!email) {
        showMessage('Please enter your email address');
        return;
    }
    
    await sendOTP(email);
});

otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = document.getElementById('otp').value.trim();
    
    if (!otp || otp.length !== 6) {
        showMessage('Please enter a valid 6-digit OTP');
        return;
    }
    
    await verifyOTP(currentEmail, otp);
});

resendOtpBtn.addEventListener('click', async () => {
    if (currentEmail) {
        await sendOTP(currentEmail);
    }
});

logoutBtn.addEventListener('click', logout);

// Auto-focus next OTP input (if you implement multiple input fields)
document.getElementById('otp')?.addEventListener('input', function(e) {
    if (this.value.length === 6) {
        document.getElementById('verifyOtpBtn').focus();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});