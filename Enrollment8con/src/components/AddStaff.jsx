import { useState } from 'react';

const StaffForm = () => {
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    phoneNumber: '',
    gender: '',
    education: '',
    email: '',
    placeOfBirth: '',
    dob: '',
    tradingLevel: 'Beginner',
    device: [],
    learningStyle: [],
    address: '',
    city: '',
    province: '',
    username: '',
    password: '',
    confirmPassword: '',
    employeeId: '',
    role: 'staff' // Default role
  });

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'device' || name === 'learningStyle') {
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

    // Clear errors when user starts typing
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const validateForm = () => {
    // Required fields validation
    const requiredFields = ['firstName', 'lastName', 'email', 'placeOfBirth', 'username', 'password'];
    for (let field of requiredFields) {
      if (!formData[field].trim()) {
        setError(`${field.replace(/([A-Z])/g, ' $1').toLowerCase()} is required`);
        return false;
      }
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Password validation
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    // Password confirmation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    // Username validation (3-50 characters)
    if (formData.username.length < 3 || formData.username.length > 50) {
      setError('Username must be between 3 and 50 characters');
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
      // Get token from localStorage (assuming it's stored there after login)
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found. Please login again.');
        setLoading(false);
        return;
      }

      // Prepare data according to server expectations
      const staffData = {
        first_name: formData.firstName,
        middle_name: formData.middleName || null,
        last_name: formData.lastName,
        birth_date: formData.dob || null,
        birth_place: formData.placeOfBirth,
        gender: formData.gender || null,
        email: formData.email,
        education: formData.education,
        phone: formData.phoneNumber || null,
        username: formData.username,
        password: formData.password,
        role: formData.role,
        employee_id: formData.employeeId || null
      };

      const response = await fetch('http://localhost:3000/api/admin/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(staffData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Server error: ${response.status}`);
      }

      setSuccess('Staff member created successfully!');
      
      // Reset form after successful submission
      setFormData({
        lastName: '',
        firstName: '',
        middleName: '',
        phoneNumber: '',
        gender: '',
        education: '',
        email: '',
        placeOfBirth: '',
        dob: '',
        tradingLevel: 'Beginner',
        device: [],
        learningStyle: [],
        address: '',
        city: '',
        province: '',
        username: '',
        password: '',
        confirmPassword: '',
        employeeId: '',
        role: 'staff'
      });

    } catch (error) {
      console.error('Staff creation error:', error);
      
      if (error.message.includes('409') || error.message.includes('already exists')) {
        setError('Username or email already exists. Please choose different ones.');
      } else if (error.message.includes('401') || error.message.includes('403')) {
        setError('Unauthorized access. Please login as an admin.');
      } else if (error.message.includes('400')) {
        setError('Invalid data provided. Please check all fields.');
      } else {
        setError(error.message || 'Failed to create staff member. Please try again.');
      }
    } finally {
      setLoading(false);
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
      <h1 style={styles.heading}>Staff Registration Form</h1>
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
                name="firstName" 
                value={formData.firstName} 
                onChange={handleChange} 
                required 
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Middle Name</label>
              <input 
                style={styles.input} 
                name="middleName" 
                value={formData.middleName} 
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
                name="lastName" 
                value={formData.lastName} 
                onChange={handleChange} 
                required 
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Phone Number</label>
              <input 
                style={styles.input} 
                name="phoneNumber" 
                value={formData.phoneNumber} 
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
              <label style={styles.label}>
                Place of Birth<span style={styles.required}>*</span>
              </label>
              <input 
                style={styles.input} 
                name="placeOfBirth" 
                value={formData.placeOfBirth} 
                onChange={handleChange} 
                required 
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Date of Birth</label>
              <input 
                type="date" 
                style={styles.input} 
                name="dob" 
                value={formData.dob} 
                onChange={handleChange} 
                disabled={loading}
              />
            </div>
          </div>
        </fieldset>

        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Employment Information</legend>
          
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Employee ID</label>
              <input 
                style={styles.input} 
                name="employeeId" 
                value={formData.employeeId} 
                onChange={handleChange} 
                placeholder="Leave empty for auto-generation"
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Role</label>
              <select name="role" style={styles.select} value={formData.role} onChange={handleChange} disabled={loading}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Preferences</legend>

          <label style={styles.label}>Trading Level</label>
          <select name="tradingLevel" style={styles.select} value={formData.tradingLevel} onChange={handleChange} disabled={loading}>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>

          <div style={styles.checkboxGroup}>
            <label style={styles.label}>Available Devices</label>
            {['Mobile Phone', 'Tablet', 'Laptop'].map(device => (
              <label key={device} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="device"
                  value={device}
                  checked={formData.device.includes(device)}
                  onChange={handleChange}
                  disabled={loading}
                />
                {device}
              </label>
            ))}
          </div>

          <div style={styles.checkboxGroup}>
            <label style={styles.label}>Learning Style</label>
            {['In person', 'Online'].map(style => (
              <label key={style} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="learningStyle"
                  value={style}
                  checked={formData.learningStyle.includes(style)}
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
            <div style={styles.formGroup}>
              <label style={styles.label}>Address</label>
              <input 
                style={styles.input} 
                name="address" 
                value={formData.address} 
                onChange={handleChange} 
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>City</label>
              <input 
                style={styles.input} 
                name="city" 
                value={formData.city} 
                onChange={handleChange} 
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Province</label>
              <input 
                style={styles.input} 
                name="province" 
                value={formData.province} 
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
          {loading ? 'Creating Staff Member...' : 'Submit'}
        </button>
      </div>
    </div>
  );
};

export default StaffForm;