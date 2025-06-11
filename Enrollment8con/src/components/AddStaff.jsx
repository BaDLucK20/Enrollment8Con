import { useState } from 'react';

const StaffForm = () => {
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
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
  });

  const [error, setError] = useState(null);

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

    if (error) setError(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    console.log('Form submitted:', formData);
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
    },
    button: {
        backgroundColor: colors.coral,
        color: 'white',
        padding: '14px 20px',
        border: 'none',
        borderRadius: '5px',
        fontSize: '18px',
        cursor: 'pointer',
        display: 'block',
        width: '100%',
        marginTop: '20px',
        transition: 'background-color 0.2s ease',
    },
    responsive: `
        @media (max-width: 768px) {
        .formRow {
            flex-direction: column;
        }
        .formGroup {
            flex: 1 1 100%;
        }
        }
    `
    };


  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Enrollment Form</h1>
      <form onSubmit={handleSubmit}>
        {error && <div style={styles.error}>{error}</div>}

        <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Student Information</legend>
        <div style={styles.formRow}>
            <div style={styles.formGroup}>
            <label style={styles.label}>Last Name</label>
            <input style={styles.input} name="lastName" value={formData.lastName} onChange={handleChange} required />
            </div>

            <div style={styles.formGroup}>
            <label style={styles.label}>First Name</label>
            <input style={styles.input} name="firstName" value={formData.firstName} onChange={handleChange} required />
            </div>

            <div style={styles.formGroup}>
            <label style={styles.label}>Phone Number</label>
            <input style={styles.input} name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} />
            </div>

            <div style={styles.formGroup}>
            <label style={styles.label}>Sex</label>
            <select name="gender" style={styles.select} value={formData.gender} onChange={handleChange}>
                <option value="">--Select--</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
            </select>
            </div>

            <div style={styles.formGroup}>
            <label style={styles.label}>Educational Background</label>
            <input style={styles.input} name="education" value={formData.education} onChange={handleChange} />
            </div>

            <div style={styles.formGroup}>
            <label style={styles.label}>Email Address</label>
            <input type="email" style={styles.input} name="email" value={formData.email} onChange={handleChange} />
            </div>

            <div style={styles.formGroup}>
            <label style={styles.label}>Place of Birth</label>
            <input style={styles.input} name="placeOfBirth" value={formData.placeOfBirth} onChange={handleChange} />
            </div>

            <div style={styles.formGroup}>
            <label style={styles.label}>Date of Birth</label>
            <input type="date" style={styles.input} name="dob" value={formData.dob} onChange={handleChange} />
            </div>
        </div>
        </fieldset>

        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Preferences</legend>

          <label style={styles.label}>Trading Level</label>
          <select name="tradingLevel" style={styles.select} value={formData.tradingLevel} onChange={handleChange}>
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
                />{' '}
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
                />{' '}
                {style}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Address Information</legend>

          <label style={styles.label}>Address</label>
          <input style={styles.input} name="address" value={formData.address} onChange={handleChange} />

          <label style={styles.label}>City</label>
          <input style={styles.input} name="city" value={formData.city} onChange={handleChange} />

          <label style={styles.label}>Province</label>
          <input style={styles.input} name="province" value={formData.province} onChange={handleChange} />
        </fieldset>

        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Account Information</legend>

          <label style={styles.label}>Username</label>
          <input style={styles.input} name="username" value={formData.username} onChange={handleChange} required />

          <label style={styles.label}>Password</label>
          <input type="password" style={styles.input} name="password" value={formData.password} onChange={handleChange} required />

          <label style={styles.label}>Confirm Password</label>
          <input type="password" style={styles.input} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required />
        </fieldset>

        <button type="submit" style={styles.button}>Submit</button>
      </form>
    </div>
  );
};

export default StaffForm;
