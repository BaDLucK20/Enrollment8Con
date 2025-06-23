import { useState } from 'react'
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentView, setCurrentView] = useState('login')
  const [forgotPasswordData, setForgotPasswordData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
    resetToken: ''
  })
  const [success, setSuccess] = useState(null)

  // Use the actual navigate hook instead of the demo function
  const navigate = useNavigate();

  const colors = {
    darkGreen: '#2d4a3d',
    lightGreen: '#7a9b8a',
    dustyRose: '#c19a9a',
    coral: '#d85c5c',
    red: '#d63447',
    cream: '#f5f2e8',
    olive: '#6b7c5c',
    black: '#2c2c2c',
    green: '#28a745'
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }))
    if (error) setError(null)
  }

  const handleForgotPasswordChange = (e) => {
    const { name, value } = e.target
    setForgotPasswordData(prev => ({
      ...prev,
      [name]: value
    }))
    if (error) setError(null)
  }

  const getToken = async (email, password) => {
    try {
      const response = await fetch('http://localhost:3000/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to authenticate');
      }

      const { token } = await response.json();
      return token;
    } catch (err) {
      throw new Error(err.message || 'Token fetch failed');
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const { email, password } = credentials;

    if (!email || !password) {
      setError('Please enter both email and password.');
      setIsLoading(false);
      return;
    }

    try {
      const token = await getToken(email, password);
      
      const loginRes = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      if (!loginRes.ok) {
        const { error } = await loginRes.json();
        throw new Error(error || 'Login failed');
      }

      const loginData = await loginRes.json();
      
      // Store token and user data in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(loginData.user));
      
      console.log('✅ Login successful!');
      console.log('Token:', token);
      console.log('User data:', loginData.user);
      
      setSuccess('Login successful! Redirecting to dashboard...');
      
      // Navigate to dashboard after a brief delay to show success message
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
      
    } catch (err) {
      console.error('❌ Login error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password Functions
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: forgotPasswordData.email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setSuccess(data.message);
      setCurrentView('verify-otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3000/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email: forgotPasswordData.email, 
          otp: forgotPasswordData.otp 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      setForgotPasswordData(prev => ({ ...prev, resetToken: data.resetToken }));
      setSuccess('OTP verified successfully!');
      setCurrentView('reset-password');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3000/api/auth/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: forgotPasswordData.email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend OTP');
      }

      setSuccess('New OTP sent successfully!');
    } catch (err) {
      console.error('Resend OTP error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced key press handler
  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      action();
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (forgotPasswordData.newPassword !== forgotPasswordData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          resetToken: forgotPasswordData.resetToken,
          newPassword: forgotPasswordData.newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess('Password reset successfully! You can now login with your new password.');
      setTimeout(() => {
        setCurrentView('login');
        setSuccess(null);
        setForgotPasswordData({
          email: '',
          otp: '',
          newPassword: '',
          confirmPassword: '',
          resetToken: ''
        });
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Password validation
  const validatePassword = (password) => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[@$!%*?&]/.test(password)
    };
    return requirements;
  };

  const passwordRequirements = validatePassword(forgotPasswordData.newPassword);

  const styles = {
    container: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: colors.cream,
      fontFamily: 'Arial, sans-serif',
      padding: '16px'
    },

    card: {
      width: '100%',
      maxWidth: '420px',
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
      padding: '40px',
      textAlign: 'center',
      border: `1px solid ${colors.lightGreen}`
    },

    logo: {
      height: '120px',
      marginBottom: '0px'
    },

    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: colors.black,
      marginBottom: '8px'
    },

    subtitle: {
      fontSize: '14px',
      color: colors.olive,
      marginBottom: '24px'
    },

    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    },

    inputGroup: {
      position: 'relative',
      textAlign: 'left'
    },

    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      color: colors.black,
      marginBottom: '4px'
    },

    input: {
      width: '100%',
      padding: '12px',
      border: `1px solid ${colors.lightGreen}`,
      borderRadius: '8px',
      fontSize: '14px',
      boxSizing: 'border-box',
      transition: 'border-color 0.2s ease'
    },

    inputFocus: {
      borderColor: colors.darkGreen,
      outline: 'none'
    },

    passwordWrapper: {
      position: 'relative'
    },

    eyeIcon: {
      position: 'absolute',
      top: '50%',
      right: '12px',
      transform: 'translateY(-50%)',
      cursor: 'pointer',
      fontSize: '12px',
      color: colors.lightGreen,
      userSelect: 'none'
    },

    button: {
      width: '100%',
      padding: '12px',
      backgroundColor: colors.darkGreen,
      color: '#ffffff',
      border: 'none',
      borderRadius: '8px',
      fontSize: '16px',
      fontWeight: 'bold',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      marginTop: '8px'
    },

    buttonSecondary: {
      backgroundColor: colors.lightGreen,
      fontSize: '14px',
      padding: '8px 16px',
      marginTop: '8px'
    },

    buttonHover: {
      backgroundColor: colors.olive
    },

    buttonDisabled: {
      opacity: 0.6,
      cursor: 'not-allowed'
    },

    error: {
      color: colors.red,
      fontSize: '13px',
      textAlign: 'left',
      backgroundColor: '#fee',
      padding: '8px 12px',
      borderRadius: '4px',
      border: `1px solid ${colors.red}20`
    },

    success: {
      color: colors.green,
      fontSize: '13px',
      textAlign: 'left',
      backgroundColor: '#f0fff4',
      padding: '8px 12px',
      borderRadius: '4px',
      border: `1px solid ${colors.green}20`
    },

    footerText: {
      marginTop: '24px',
      fontSize: '13px',
      color: colors.lightGreen
    },

    loadingSpinner: {
      display: 'inline-block',
      width: '16px',
      height: '16px',
      border: '2px solid #ffffff',
      borderTop: '2px solid transparent',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      marginRight: '8px'
    },

    forgotPasswordLink: {
      color: colors.darkGreen,
      fontSize: '13px',
      textDecoration: 'none',
      cursor: 'pointer',
      marginTop: '8px',
      display: 'inline-block'
    },

    backLink: {
      color: colors.lightGreen,
      fontSize: '13px',
      textDecoration: 'none',
      cursor: 'pointer',
      marginBottom: '16px',
      display: 'inline-block'
    },

    passwordRequirements: {
      textAlign: 'left',
      fontSize: '12px',
      marginTop: '8px',
      padding: '12px',
      backgroundColor: colors.cream,
      borderRadius: '6px'
    },

    requirement: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '4px'
    },

    requirementIcon: {
      marginRight: '6px',
      fontSize: '12px'
    },

    otpInput: {
      textAlign: 'center',
      letterSpacing: '4px',
      fontSize: '18px',
      fontWeight: 'bold'
    }
  }

  const renderLoginForm = () => (
    <>
      <img src="Copy of 8CON.png" alt="8Con Logo" style={styles.logo} />
      <h2 style={styles.title}>Welcome Back</h2>
      <p style={styles.subtitle}>Please sign in to your account</p>
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="email">Email</label>
          <input
            id="email"
            type="text"
            name="email"
            placeholder="Enter your email"
            value={credentials.email}
            onChange={handleInputChange}
            style={styles.input}
            disabled={isLoading}
            autoComplete="email"
            onKeyPress={(e) => handleKeyPress(e, handleSubmit)}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="password">Password</label>
          <div style={styles.passwordWrapper}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Enter your password"
              value={credentials.password}
              onChange={handleInputChange}
              style={styles.input}
              disabled={isLoading}
              autoComplete="current-password"
              onKeyPress={(e) => handleKeyPress(e, handleSubmit)}
            />
            <span
              style={styles.eyeIcon}
              onClick={() => setShowPassword(!showPassword)}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          style={{
            ...styles.button,
            ...(isLoading ? styles.buttonDisabled : {})
          }}
          disabled={isLoading}
          onMouseOver={(e) => !isLoading && (e.currentTarget.style.backgroundColor = colors.olive)}
          onMouseOut={(e) => !isLoading && (e.currentTarget.style.backgroundColor = colors.darkGreen)}
        >
          {isLoading && <span style={styles.loadingSpinner}></span>}
          {isLoading ? 'Signing In...' : 'Sign In'}
        </button>

        <a 
          style={styles.forgotPasswordLink}
          onClick={() => setCurrentView('forgot')}
        >
          Forgot your password?
        </a>
      </div>
    </>
  );

  const renderForgotPasswordForm = () => (
    <>
      <img src="Copy of 8CON.png" alt="8Con Logo" style={styles.logo} />
      <h2 style={styles.title}>Forgot Password</h2>
      <p style={styles.subtitle}>Enter your email to receive an OTP</p>
      
      <a style={styles.backLink} onClick={() => setCurrentView('login')}>
        ← Back to Login
      </a>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            type="email"
            name="email"
            placeholder="Enter your email"
            value={forgotPasswordData.email}
            onChange={handleForgotPasswordChange}
            style={styles.input}
            disabled={isLoading}
            required
            onKeyPress={(e) => handleKeyPress(e, handleForgotPassword)}
          />
        </div>

        <button
          type="button"
          onClick={handleForgotPassword}
          style={{
            ...styles.button,
            ...(isLoading ? styles.buttonDisabled : {})
          }}
          disabled={isLoading}
        >
          {isLoading && <span style={styles.loadingSpinner}></span>}
          {isLoading ? 'Sending OTP...' : 'Send OTP'}
        </button>
      </div>
    </>
  );

  const renderVerifyOTPForm = () => (
    <>
      <img src="Copy of 8CON.png" alt="8Con Logo" style={styles.logo} />
      <h2 style={styles.title}>Verify OTP</h2>
      <p style={styles.subtitle}>Enter the 6-digit code sent to {forgotPasswordData.email}</p>
      
      <a style={styles.backLink} onClick={() => setCurrentView('forgot')}>
        ← Back
      </a>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="otp">OTP Code</label>
          <input
            id="otp"
            type="text"
            name="otp"
            placeholder="000000"
            value={forgotPasswordData.otp}
            onChange={handleForgotPasswordChange}
            style={{...styles.input, ...styles.otpInput}}
            disabled={isLoading}
            maxLength="6"
            required
            onKeyPress={(e) => handleKeyPress(e, handleVerifyOTP)}
          />
        </div>

        <button
          type="button"
          onClick={handleVerifyOTP}
          style={{
            ...styles.button,
            ...(isLoading ? styles.buttonDisabled : {})
          }}
          disabled={isLoading}
        >
          {isLoading && <span style={styles.loadingSpinner}></span>}
          {isLoading ? 'Verifying...' : 'Verify OTP'}
        </button>

        <button
          type="button"
          style={{...styles.button, ...styles.buttonSecondary}}
          onClick={handleResendOTP}
          disabled={isLoading}
        >
          Resend OTP
        </button>
      </div>
    </>
  );

  const renderResetPasswordForm = () => (
    <>
      <img src="Copy of 8CON.png" alt="8Con Logo" style={styles.logo} />
      <h2 style={styles.title}>Reset Password</h2>
      <p style={styles.subtitle}>Create a new secure password</p>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="new-password">New Password</label>
          <input
            id="new-password"
            type="password"
            name="newPassword"
            placeholder="Enter new password"
            value={forgotPasswordData.newPassword}
            onChange={handleForgotPasswordChange}
            style={styles.input}
            disabled={isLoading}
            required
          />
          
          {forgotPasswordData.newPassword && (
            <div style={styles.passwordRequirements}>
              <div style={styles.requirement}>
                <span style={{...styles.requirementIcon, color: passwordRequirements.length ? colors.green : colors.red}}>
                  {passwordRequirements.length ? '✓' : '✗'}
                </span>
                At least 8 characters
              </div>
              <div style={styles.requirement}>
                <span style={{...styles.requirementIcon, color: passwordRequirements.uppercase ? colors.green : colors.red}}>
                  {passwordRequirements.uppercase ? '✓' : '✗'}
                </span>
                At least 1 uppercase letter
              </div>
              <div style={styles.requirement}>
                <span style={{...styles.requirementIcon, color: passwordRequirements.lowercase ? colors.green : colors.red}}>
                  {passwordRequirements.lowercase ? '✓' : '✗'}
                </span>
                At least 1 lowercase letter
              </div>
              <div style={styles.requirement}>
                <span style={{...styles.requirementIcon, color: passwordRequirements.number ? colors.green : colors.red}}>
                  {passwordRequirements.number ? '✓' : '✗'}
                </span>
                At least 1 number
              </div>
              <div style={styles.requirement}>
                <span style={{...styles.requirementIcon, color: passwordRequirements.special ? colors.green : colors.red}}>
                  {passwordRequirements.special ? '✓' : '✗'}
                </span>
                At least 1 special character (@$!%*?&)
              </div>
            </div>
          )}
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            type="password"
            name="confirmPassword"
            placeholder="Confirm new password"
            value={forgotPasswordData.confirmPassword}
            onChange={handleForgotPasswordChange}
            style={styles.input}
            disabled={isLoading}
            required
            onKeyPress={(e) => handleKeyPress(e, handleResetPassword)}
          />
        </div>

        <button
          type="button"
          onClick={handleResetPassword}
          style={{
            ...styles.button,
            ...(isLoading ? styles.buttonDisabled : {})
          }}
          disabled={isLoading || !Object.values(passwordRequirements).every(Boolean)}
        >
          {isLoading && <span style={styles.loadingSpinner}></span>}
          {isLoading ? 'Resetting...' : 'Reset Password'}
        </button>
      </div>
    </>
  );

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {currentView === 'login' && renderLoginForm()}
        {currentView === 'forgot' && renderForgotPasswordForm()}
        {currentView === 'verify-otp' && renderVerifyOTPForm()}
        {currentView === 'reset-password' && renderResetPasswordForm()}

        <p style={styles.footerText}>
          Secure login powered by 8CON Academy
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default LoginPage;