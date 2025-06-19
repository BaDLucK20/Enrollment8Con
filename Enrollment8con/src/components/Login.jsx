import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const LoginPage = () => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const colors = {
    darkGreen: '#2d4a3d',
    lightGreen: '#7a9b8a',
    dustyRose: '#c19a9a',
    coral: '#d85c5c',
    red: '#d63447',
    cream: '#f5f2e8',
    olive: '#6b7c5c',
    black: '#2c2c2c'
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
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
    console.log(token);
    return token;
  } catch (err) {
    throw new Error(err.message || 'Token fetch failed');
  }
};

const handleSubmit = async (e) => {
  e.preventDefault();
  setIsLoading(true);
  setError(null);

  const { email, password } = credentials;

  if (!email || !password) {
    setError('Please enter both email and password.');
    setIsLoading(false);
    return;
  }

  try {
    // STEP 1: Fetch token using credentials
    const token = await getToken(email, password);
    console.log(token);
    // STEP 2: Pass token to /api/auth/login for validation
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
    console.log(loginData);
    // Save and redirect
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(loginData.user));
    console.log("Authenticated");
    navigate('/dashboard'); // or switch by role if needed
  } catch (err) {
    console.error('Login error:', err);
    setError(err.message);
  } finally {
    setIsLoading(false);
  }
};





  const styles = {
    container: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
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
      marginTop: '8px',
      disabled: isLoading
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

    demoCredentials: {
      backgroundColor: colors.cream,
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '16px',
      fontSize: '12px',
      color: colors.olive,
      textAlign: 'left'
    }
  }

  return (
    <div style={styles.container}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <img src="Copy of 8CON.png" alt="8Con Logo" style={styles.logo} />
        <h2 style={styles.title}>Welcome Back</h2>
        <p style={styles.subtitle}>Please sign in to your account</p>
        {error && <div style={styles.error}>{error}</div>}

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
            type="submit"
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
        </div>

        <p style={styles.footerText}>
          Secure login powered by 8CON Academy
        </p>
      </form>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default LoginPage