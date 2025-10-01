// Configuration - Update this with your Render backend URL
const API_BASE_URL = 'https://otp-verification-project.onrender.com';

// DOM Elements - same as before

// State
let currentEmail = '';
let resendCountdown = 60;
let countdownInterval;

// Functions
function showAlert(message, type = 'info') {
    alertMessage.textContent = message;
    
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
    step1.classList.add('hidden');
    step2.classList.add('hidden');
    step3.classList.add('hidden');
    
    if (stepNumber === 1) {
        step1.classList.remove('hidden');
    } else if (stepNumber === 2) {
        step2.classList.remove('hidden');
    } else if (stepNumber === 3) {
        step3.classList.remove('hidden');
    }
    
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

// IMPROVED: Better error handling for API calls
async function makeApiCall(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            throw new Error('Request timeout. Please check your internet connection.');
        }
        
        throw error;
    }
}

// Event Listeners - IMPROVED VERSION
emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    
    if (!email) {
        showAlert('Please enter your email address', 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAlert('Please enter a valid email address', 'error');
        return;
    }
    
    currentEmail = email;
    setLoading(sendOtpBtn, sendOtpText, sendOtpSpinner, true);
    
    try {
        const data = await makeApiCall(`${API_BASE_URL}/api/send-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });
        
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
        
        if (error.message.includes('timeout')) {
            showAlert('Request timeout. Please check your connection and try again.', 'error');
        } else if (error.message.includes('Failed to fetch')) {
            showAlert('Network error. Please check your internet connection.', 'error');
        } else {
            showAlert('Failed to send OTP. Please try again.', 'error');
        }
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
        const data = await makeApiCall(`${API_BASE_URL}/api/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                email: currentEmail, 
                otp 
            }),
        });
        
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

// Rest of the event listeners remain the same...
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
        const data = await makeApiCall(`${API_BASE_URL}/api/send-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: currentEmail }),
        });
        
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
    emailForm.reset();
    otpForm.reset();
    currentEmail = '';
    clearInterval(countdownInterval);
    showStep(1);
});

otpInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
});

// Initialize
showStep(1);

// Test backend connection on load
window.addEventListener('load', async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
            console.log('Backend connection successful');
        }
    } catch (error) {
        console.log('Backend connection test failed:', error);
    }
});