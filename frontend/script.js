// Configuration - Update this with your Render backend URL
const API_BASE_URL = 'https://otp-verification-project.onrender.com/health';

// DOM Elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const emailForm = document.getElementById('emailForm');
const otpForm = document.getElementById('otpForm');
const emailInput = document.getElementById('email');
const otpInput = document.getElementById('otp');
const userEmailSpan = document.getElementById('userEmail');
const sendOtpBtn = document.getElementById('sendOtpBtn');
const sendOtpText = document.getElementById('sendOtpText');
const sendOtpSpinner = document.getElementById('sendOtpSpinner');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const verifyOtpText = document.getElementById('verifyOtpText');
const verifyOtpSpinner = document.getElementById('verifyOtpSpinner');
const backBtn = document.getElementById('backBtn');
const resendOtpBtn = document.getElementById('resendOtpBtn');
const resendTimer = document.getElementById('resendTimer');
const countdownSpan = document.getElementById('countdown');
const resetBtn = document.getElementById('resetBtn');
const alertDiv = document.getElementById('alert');
const alertMessage = document.getElementById('alertMessage');
const alertIcon = document.getElementById('alertIcon');
const alertContent = document.getElementById('alertContent');

// State
let currentEmail = '';
let resendCountdown = 60;
let countdownInterval;

// Functions
function showAlert(message, type = 'info') {
    alertMessage.textContent = message;
    
    // Set alert style based on type
    const styles = {
        success: 'bg-green-100 text-green-800 border border-green-200',
        error: 'bg-red-100 text-red-800 border border-red-200',
        info: 'bg-blue-100 text-blue-800 border border-blue-200',
        warning: 'bg-yellow-100 text-yellow-800 border border-yellow-200'
    };
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    
    alertContent.className = `p-4 rounded-lg ${styles[type]}`;
    alertIcon.className = `fas ${icons[type]} mr-3`;
    
    alertDiv.classList.remove('hidden');
    
    // Auto hide after 5 seconds for non-error messages
    if (type !== 'error') {
        setTimeout(() => {
            hideAlert();
        }, 5000);
    }
}

function hideAlert() {
    alertDiv.classList.add('hidden');
}

function showStep(stepNumber) {
    // Hide all steps
    step1.classList.add('hidden');
    step2.classList.add('hidden');
    step3.classList.add('hidden');
    
    // Show the selected step
    if (stepNumber === 1) {
        step1.classList.remove('hidden');
    } else if (stepNumber === 2) {
        step2.classList.remove('hidden');
    } else if (stepNumber === 3) {
        step3.classList.remove('hidden');
    }
    
    // Hide alert when changing steps
    hideAlert();
}

function setLoading(button, textElement, spinner, isLoading) {
    if (isLoading) {
        textElement.classList.add('hidden');
        spinner.classList.remove('hidden');
        button.disabled = true;
    } else {
        textElement.classList.remove('hidden');
        spinner.classList.add('hidden');
        button.disabled = false;
    }
}

function startResendTimer() {
    resendOtpBtn.disabled = true;
    resendTimer.classList.remove('hidden');
    
    resendCountdown = 60;
    countdownSpan.textContent = resendCountdown;
    
    countdownInterval = setInterval(() => {
        resendCountdown--;
        countdownSpan.textContent = resendCountdown;
        
        if (resendCountdown <= 0) {
            clearInterval(countdownInterval);
            resendOtpBtn.disabled = false;
            resendTimer.classList.add('hidden');
        }
    }, 1000);
}

// Event Listeners
emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    
    if (!email) {
        showAlert('Please enter your email address', 'error');
        return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAlert('Please enter a valid email address', 'error');
        return;
    }
    
    currentEmail = email;
    setLoading(sendOtpBtn, sendOtpText, sendOtpSpinner, true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/send-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            userEmailSpan.textContent = email;
            showStep(2);
            startResendTimer();
            showAlert('OTP sent successfully! Check your email.', 'success');
        } else {
            showAlert(data.message || 'Failed to send OTP. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error sending OTP:', error);
        showAlert('Network error. Please check your connection and try again.', 'error');
    } finally {
        setLoading(sendOtpBtn, sendOtpText, sendOtpSpinner, false);
    }
});

otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const otp = otpInput.value.trim();
    
    if (!otp || otp.length !== 6) {
        showAlert('Please enter a valid 6-digit OTP', 'error');
        return;
    }
    
    setLoading(verifyOtpBtn, verifyOtpText, verifyOtpSpinner, true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                email: currentEmail, 
                otp 
            }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            showStep(3);
            showAlert('Email verified successfully!', 'success');
            clearInterval(countdownInterval);
        } else {
            showAlert(data.message || 'Invalid OTP. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        showAlert('Network error. Please check your connection and try again.', 'error');
    } finally {
        setLoading(verifyOtpBtn, verifyOtpText, verifyOtpSpinner, false);
    }
});

backBtn.addEventListener('click', () => {
    showStep(1);
    clearInterval(countdownInterval);
    resendTimer.classList.add('hidden');
    resendOtpBtn.disabled = false;
});

resendOtpBtn.addEventListener('click', async () => {
    if (resendOtpBtn.disabled) return;
    
    setLoading(sendOtpBtn, sendOtpText, sendOtpSpinner, true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/send-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: currentEmail }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            startResendTimer();
            showAlert('New OTP sent successfully!', 'success');
        } else {
            showAlert(data.message || 'Failed to resend OTP. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error resending OTP:', error);
        showAlert('Network error. Please check your connection and try again.', 'error');
    } finally {
        setLoading(sendOtpBtn, sendOtpText, sendOtpSpinner, false);
    }
});

resetBtn.addEventListener('click', () => {
    // Reset forms
    emailForm.reset();
    otpForm.reset();
    
    // Reset state
    currentEmail = '';
    clearInterval(countdownInterval);
    
    // Show first step
    showStep(1);
});

// Auto-tab between OTP digits (if using multiple inputs)
otpInput.addEventListener('input', (e) => {
    // Allow only numbers
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
});

// Initialize
showStep(1);