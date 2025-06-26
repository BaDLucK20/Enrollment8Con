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
    address: '',
    city: '',
    province: ''
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

    if (name === 'device') {
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
    const requiredFields = ['firstName', 'lastName', 'email', 'placeOfBirth', 'education'];
    for (let field of requiredFields) {
      if (!formData[field].trim()) {
        const fieldName = field.replace(/([A-Z])/g, ' $1').toLowerCase();
        setError(`${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`);
        return false;
      }
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // First name length validation
    if (formData.firstName.length > 50) {
      setError('First name must be 50 characters or less');
      return false;
    }

    // Last name length validation
    if (formData.lastName.length > 50) {
      setError('Last name must be 50 characters or less');
      return false;
    }

    // Place of birth length validation
    if (formData.placeOfBirth.length > 100) {
      setError('Place of birth must be 100 characters or less');
      return false;
    }

    // Education length validation
    if (formData.education.length > 100) {
      setError('Education must be 100 characters or less');
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
      // Get token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found. Please login again.');
        setLoading(false);
        return;
      }

      const randomPassword = generatedPassword();

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
        password: randomPassword,
        role: 'staff' // Default role
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
        // Store result for detailed error handling
        const error = new Error(result.error || `Server error: ${response.status}`);
        error.result = result; // Attach result for validation error details
        throw error;
      }

      // Provide user feedback based on API response (matching student form pattern)
      if (result.email_sent) {
        setSuccess(`Staff member created successfully! 
Login credentials have been sent to their email address.
Staff ID: ${result.staff_id || 'Generated'}
Account ID: ${result.account_id}
Employee ID: ${result.employee_id || 'Auto-generated'}
Role: Staff`);
      } else {
        setSuccess(`Staff member created successfully!
Login Credentials:
Email: ${result.credentials?.email || formData.email}
Password: ${result.credentials?.password || 'Generated'}
Staff ID: ${result.staff_id || 'Generated'}
Account ID: ${result.account_id}
Employee ID: ${result.employee_id || 'Auto-generated'}
Role: Staff
${result.email_error ? `Email Error: ${result.email_error}` : 'Email service may be unavailable.'} 
Please provide these credentials to the staff member manually.`);
        
        // Also log to console for admin reference
        console.log('=== STAFF LOGIN CREDENTIALS ===');
        console.log('Email:', result.credentials?.email || formData.email);
        console.log('Password:', result.credentials?.password || 'Generated');
        console.log('Staff ID:', result.staff_id || 'Generated');
        console.log('Account ID:', result.account_id);
        console.log('Employee ID:', result.employee_id || 'Auto-generated');
        console.log('Role: Staff');
        console.log('==============================');
      }
      
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
        address: '',
        city: '',
        province: ''
      });

    } catch (error) {
      console.error('Staff creation error:', error);
      
      // Handle specific error types
      let errorMessage = 'Failed to create staff member: ';
      
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.message.includes('403') || error.message.includes('forbidden')) {
        errorMessage = 'You do not have permission to create staff members.';
      } else if (error.message.includes('409') || error.message.includes('already exists')) {
        errorMessage = 'Email already exists. Please use a different email address.';
      } else if (error.message.includes('400')) {
        // Handle validation errors specifically
        if (error.result && error.result.details && Array.isArray(error.result.details)) {
          const validationErrors = error.result.details.map(err => err.msg).join(', ');
          errorMessage = `Validation Error: ${validationErrors}`;
        } else {
          errorMessage = 'Invalid data provided. Please check all required fields.';
        }
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later.';
      } else {
        errorMessage += error.message;
      }
      
      setError(errorMessage);
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
      textAlign: 'left',
      padding: '15px',
      backgroundColor: '#e8f5e8',
      borderRadius: '4px',
      border: `1px solid ${colors.darkGreen}`,
      whiteSpace: 'pre-line',
      fontSize: '14px',
      lineHeight: '1.5',
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
    },
    infoBox: {
      backgroundColor: '#e3f2fd',
      border: '1px solid #1976d2',
      borderRadius: '4px',
      padding: '12px',
      marginBottom: '20px',
      color: '#1565c0',
      fontSize: '14px',
      lineHeight: '1.4',
    }
  };

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <h1 style={styles.heading}>Staff Registration Form</h1>

      <form onSubmit={handleSubmit}>
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
                maxLength={50}
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
                maxLength={50}
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
                maxLength={50}
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
              <label style={styles.label}>Gender</label>
              <select name="gender" style={styles.select} value={formData.gender} onChange={handleChange} disabled={loading}>
                <option value="">--Select Gender--</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Educational Background<span style={styles.required}>*</span>
              </label>
              <input 
                style={styles.input} 
                name="education" 
                value={formData.education} 
                onChange={handleChange} 
                required
                disabled={loading}
                maxLength={100}
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
                maxLength={100}
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
          <legend style={styles.legend}>Preferences (Optional)</legend>

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
        </fieldset>

        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Address Information (Optional)</legend>
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

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <div style={{ 
                width: '18px', 
                height: '18px', 
                border: '2px solid #ffffff40',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <span>Creating Staff Member...</span>
            </div>
          ) : (
            'Create Staff Member'
          )}
        </button>
      </form>
    </div>
  );
};

export default StaffForm;