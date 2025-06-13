import { useState, useEffect } from 'react';

const StudentForm = () => {
  const [formData, setFormData] = useState({
    // Personal Information (matching server schema)
    first_name: '',
    middle_name: '',
    last_name: '',
    birth_date: '',
    birth_place: '',
    gender: '',
    email: '',
    education: '',
    phone: '',
    address: '',
    
    // Account Information
    username: '',
    password: '',
    confirmPassword: '',
    
    // Additional fields for learning preferences
    trading_level_id: '',
    device_type: [],
    learning_style: [],
  });

  const [tradingLevels, setTradingLevels] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const colors = {
    darkGreen: '#2d4a3d',
    lightGreen: '#7a9b8a',
    dustyRose: '#c19a9a',
    coral: '#d85c5c',
    red: '#d63447',
    cream: '#f5f2e8',
    olive: '#6b7c5c',
    black: '#2c2c2c',
  };

  // Fetch trading levels on component mount
  useEffect(() => {
    fetchTradingLevels();
  }, []);

  const fetchTradingLevels = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/trading-levels', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}` // If authentication is required
        }
      });
      if (response.ok) {
        const levels = await response.json();
        setTradingLevels(levels);
      }
    } catch (err) {
      console.error('Failed to fetch trading levels:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'device_type' || name === 'learning_style') {
      setFormData(prev => {
        const list = prev[name];
        return {
          ...prev,
          [name]: checked ? [...list, value] : list.filter(item => item !== value)
        };
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    // Clear messages when user starts typing
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const validateForm = () => {
    const requiredFields = ['first_name', 'last_name', 'email', 'username', 'password'];
    const missingFields = requiredFields.filter(field => !formData[field].trim());
    
    if (missingFields.length > 0) {
      setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Prepare data for the server
      const submitData = {
        first_name: formData.first_name,
        middle_name: formData.middle_name || null,
        last_name: formData.last_name,
        birth_date: formData.birth_date || null,
        birth_place: formData.birth_place || null,
        gender: formData.gender || null,
        email: formData.email,
        education: formData.education || null,
        phone: formData.phone || null,
        address: formData.address || null,
        username: formData.username,
        password: formData.password,
        trading_level_id: formData.trading_level_id ? parseInt(formData.trading_level_id) : null
      };

      const response = await fetch('http://localhost:3000/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Add auth token if available
        },
        body: JSON.stringify(submitData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Something went wrong');
      }

      setSuccess('Student created successfully!');
      
      // Reset the form
      setFormData({
        first_name: '',
        middle_name: '',
        last_name: '',
        birth_date: '',
        birth_place: '',
        gender: '',
        email: '',
        education: '',
        phone: '',
        address: '',
        username: '',
        password: '',
        confirmPassword: '',
        trading_level_id: '',
        device_type: [],
        learning_style: [],
      });

      // If preferences were provided, save them separately
      if (formData.device_type.length > 0 || formData.learning_style.length > 0) {
        await saveStudentPreferences(result.student_id);
      }

    } catch (err) {
      console.error('Submission error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveStudentPreferences = async (studentId) => {
    try {
      const preferencesData = {
        device_type: formData.device_type.join(','),
        learning_style: formData.learning_style.join(',')
      };

      await fetch(`http://localhost:3000/api/students/${studentId}/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(preferencesData)
      });
    } catch (err) {
      console.error('Failed to save preferences:', err);
    }
  };

  const styles = {
    container: {
      maxWidth: '900px',
      margin: '40px auto',
      backgroundColor: '#fff',
      padding: '32px',
      borderRadius: '10px',
      boxShadow: '0 6px 12px rgba(0, 0, 0, 0.1)',
      fontFamily: 'Arial, sans-serif',
    },
    heading: {
      textAlign: 'center',
      color: colors.darkGreen,
      marginBottom: '30px',
      fontSize: '28px',
    },
    fieldset: {
      border: '1px solid #ddd',
      padding: '20px',
      marginBottom: '30px',
      borderRadius: '8px',
    },
    legend: {
      fontWeight: 'bold',
      color: colors.olive,
      fontSize: '18px',
      marginBottom: '20px',
    },
    formRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '20px'
    },
    formGroup: {
      flex: '1 1 45%',
      minWidth: '200px',
    },
    fullWidthGroup: {
      flex: '1 1 100%',
    },
    label: {
      display: 'block',
      fontWeight: 'bold',
      marginBottom: '6px',
      color: colors.black,
    },
    input: {
      width: '80%',
      padding: '10px',
      marginBottom: '16px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '16px',
      transition: 'border-color 0.2s',
    },
    select: {
      width: '85%',
      padding: '10px',
      marginBottom: '16px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      backgroundColor: '#fff',
      fontSize: '16px',
    },
    checkboxGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      marginBottom: '16px',
    },
    checkboxLabel: {
      fontWeight: 'normal',
      color: colors.black,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '15px',
    },
    error: {
      color: colors.red,
      marginBottom: '16px',
      textAlign: 'center',
      padding: '10px',
      backgroundColor: '#ffebee',
      borderRadius: '4px',
      border: `1px solid ${colors.red}`,
    },
    success: {
      color: colors.darkGreen,
      marginBottom: '16px',
      textAlign: 'center',
      padding: '10px',
      backgroundColor: '#e8f5e8',
      borderRadius: '4px',
      border: `1px solid ${colors.darkGreen}`,
    },
    button: {
      backgroundColor: loading ? colors.lightGreen : colors.coral,
      color: 'white',
      padding: '14px 20px',
      border: 'none',
      borderRadius: '5px',
      fontSize: '18px',
      cursor: loading ? 'not-allowed' : 'pointer',
      display: 'block',
      width: '100%',
      marginTop: '20px',
      transition: 'background-color 0.2s ease',
      opacity: loading ? 0.7 : 1,
    },
    required: {
      color: colors.red,
      fontSize: '14px',
      marginLeft: '4px',
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Student Registration Form</h1>
      <div>
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Personal Information</legend>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                First Name<span style={styles.required}>*</span>
              </label>
              <input 
                style={styles.input} 
                name="first_name" 
                value={formData.first_name} 
                onChange={handleChange} 
                required 
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Middle Name</label>
              <input 
                style={styles.input} 
                name="middle_name" 
                value={formData.middle_name} 
                onChange={handleChange} 
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Last Name<span style={styles.required}>*</span>
              </label>
              <input 
                style={styles.input} 
                name="last_name" 
                value={formData.last_name} 
                onChange={handleChange} 
                required 
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Phone Number</label>
              <input 
                style={styles.input} 
                name="phone" 
                value={formData.phone} 
                onChange={handleChange} 
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Sex</label>
              <select name="gender" style={styles.select} value={formData.gender} onChange={handleChange} disabled={loading}>
                <option value="">--Select--</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Educational Background</label>
              <input 
                style={styles.input} 
                name="education" 
                value={formData.education} 
                onChange={handleChange} 
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Email Address<span style={styles.required}>*</span>
              </label>
              <input 
                type="email" 
                style={styles.input} 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                required 
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Place of Birth</label>
              <input 
                style={styles.input} 
                name="birth_place" 
                value={formData.birth_place} 
                onChange={handleChange} 
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Date of Birth</label>
              <input 
                type="date" 
                style={styles.input} 
                name="birth_date" 
                value={formData.birth_date} 
                onChange={handleChange} 
                disabled={loading}
              />
            </div>
          </div>
        </fieldset>

        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Trading Preferences</legend>
          
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Trading Level</label>
              <select 
                name="trading_level_id" 
                style={styles.select} 
                value={formData.trading_level_id} 
                onChange={handleChange} 
                disabled={loading}
              >
                <option value="">--Select Trading Level--</option>
                {tradingLevels.map((level) => (
                  <option key={level.level_id} value={level.level_id}>
                    {level.level_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.checkboxGroup}>
            <label style={styles.label}>Available Devices</label>
            {['Mobile Phone', 'Tablet', 'Laptop', 'Desktop'].map(device => (
              <label key={device} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="device_type"
                  value={device}
                  checked={formData.device_type.includes(device)}
                  onChange={handleChange}
                  disabled={loading}
                />
                {device}
              </label>
            ))}
          </div>

          <div style={styles.checkboxGroup}>
            <label style={styles.label}>Learning Style</label>
            {['In Person', 'Online'].map(style => (
              <label key={style} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="learning_style"
                  value={style}
                  checked={formData.learning_style.includes(style)}
                  onChange={handleChange}
                  disabled={loading}
                />
                {style}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Address Information</legend>
          <div style={styles.formRow}>
            <div style={styles.fullWidthGroup}>
              <label style={styles.label}>Address</label>
              <input 
                style={styles.input} 
                name="address" 
                value={formData.address} 
                onChange={handleChange} 
                disabled={loading}
              />
            </div>
          </div>
        </fieldset>

        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Account Information</legend>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Username<span style={styles.required}>*</span>
              </label>
              <input 
                style={styles.input} 
                name="username" 
                value={formData.username} 
                onChange={handleChange} 
                required 
                minLength="3"
                maxLength="50"
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Password<span style={styles.required}>*</span>
              </label>
              <input 
                type="password" 
                style={styles.input} 
                name="password" 
                value={formData.password} 
                onChange={handleChange} 
                required 
                minLength="6"
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Confirm Password<span style={styles.required}>*</span>
              </label>
              <input 
                type="password" 
                style={styles.input} 
                name="confirmPassword" 
                value={formData.confirmPassword} 
                onChange={handleChange} 
                required 
                disabled={loading}
              />
            </div>
          </div>
        </fieldset>

        <button type="button" style={styles.button} disabled={loading} onClick={handleSubmit}>
          {loading ? 'Creating Student...' : 'Submit'}
        </button>
      </div>
    </div>
  );
};

export default StudentForm;