import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function LoginPage() {
  const [email, setEmail] = useState('admin@8con.com')
  const [password, setPassword] = useState('8con123')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
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

  const handleSubmit = (e) => {
    e.preventDefault()

    const defaultEmail = 'admin@8con.com'
    const defaultPassword = '8con123'

    if (!email || !password) {
      setError('Please enter both email and password.')
      return
    }

    if (email === defaultEmail && password === defaultPassword) {
      setError(null)
      navigate('/dashboard')
    } else {
      setError('Invalid email or password.')
    }
  }

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

    input: {
      width: '100%',
      padding: '12px',
      marginBottom: '16px',
      border: `1px solid ${colors.lightGreen}`,
      borderRadius: '8px',
      fontSize: '14px'
    },

    passwordWrapper: {
      position: 'relative',
      marginBottom: '16px'
    },

    eyeIcon: {
      position: 'absolute',
      top: '38%',
      right: '1px',
      transform: 'translateY(-50%)',
      cursor: 'pointer',
      fontSize: '14px',
      color: colors.lightGreen
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
      transition: 'background-color 0.2s ease'
    },

    error: {
      color: colors.red,
      marginBottom: '12px',
      fontSize: '13px'
    },

    footerText: {
      marginTop: '24px',
      fontSize: '13px',
      color: colors.lightGreen
    }
  }

  return (
    <div style={styles.container}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <img src="Copy of 8CON.png" alt="8Con Logo" style={styles.logo} />
        <h2 style={styles.title}>Welcome Back</h2>
        <p style={styles.subtitle}>Please sign in to your account</p>

        {error && <div style={styles.error}>{error}</div>}

        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />

        <div style={styles.passwordWrapper}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          <span
            style={styles.eyeIcon}
            onClick={() => setShowPassword(!showPassword)}
            title={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? 'Hide' : 'Show'}
          </span>
        </div>

        <button
          type="submit"
          style={styles.button}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.olive}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = colors.darkGreen}
        >
          Sign In
        </button>

        {/* <p style={styles.footerText}>
          Don’t have an account? <a href="#" style={{ color: colors.coral, textDecoration: 'none' }}>Register</a>
        </p> */}
      </form>
    </div>
  )
}

export default LoginPage
