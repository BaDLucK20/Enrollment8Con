import { useState } from 'react';

const StudentForm = () => {
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
  const [success, setSuccess] = useState(null);

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
    if (success) setSuccess(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Something went wrong');
      }

      setSuccess('Student registered successfully!');
      setFormData({
        lastName: '',
        firstName: '',
        phoneNumber: '',
        gender: '',
        education: '',
        email: '',
        address: '',
        dob: '',
        tradingLevel: 'Beginner',
        device: [],
        learningStyle: [],
        city: '',
        province: '',
        username: '',
        password: '',
        confirmPassword: '',
      });
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '32px', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 6px 12px rgba(0,0,0,0.1)' }}>
      <h1 style={{ textAlign: 'center', color: '#2d4a3d', marginBottom: '30px' }}>Enrollment Form</h1>
      <form onSubmit={handleSubmit}>
        {error && <div style={{ color: '#d63447', textAlign: 'center', marginBottom: '16px' }}>{error}</div>}
        {success && <div style={{ color: 'green', textAlign: 'center', marginBottom: '16px' }}>{success}</div>}

        {/* Personal Info */}
        <fieldset>
          <legend>Student Information</legend>
          <input name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} required />
          <input name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} required />
          <input name="phoneNumber" placeholder="Phone Number" value={formData.phoneNumber} onChange={handleChange} />
          <select name="gender" value={formData.gender} onChange={handleChange} required>
            <option value="">--Select Gender--</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
          </select>
          <input name="education" placeholder="Educational Background" value={formData.education} onChange={handleChange} />
          <input name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} />
          <input name="placeOfBirth" placeholder="Place of Birth" value={formData.placeOfBirth} onChange={handleChange} />
          <input name="dob" type="date" value={formData.dob} onChange={handleChange} />
        </fieldset>

        {/* Preferences */}
        <fieldset>
          <legend>Preferences</legend>
          <label>Trading Level</label>
          <select name="tradingLevel" value={formData.tradingLevel} onChange={handleChange}>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>

          <div>
            <label>Available Devices:</label><br />
            {['Mobile Phone', 'Tablet', 'Laptop'].map(d => (
              <label key={d}><input type="checkbox" name="device" value={d} checked={formData.device.includes(d)} onChange={handleChange} /> {d}</label>
            ))}
          </div>

          <div>
            <label>Learning Style:</label><br />
            {['In person', 'Online'].map(ls => (
              <label key={ls}><input type="checkbox" name="learningStyle" value={ls} checked={formData.learningStyle.includes(ls)} onChange={handleChange} /> {ls}</label>
            ))}
          </div>
        </fieldset>

        {/* Address Info */}
        <fieldset>
          <legend>Address Information</legend>
          <input name="address" placeholder="Street Address" value={formData.address} onChange={handleChange} />
          <input name="city" placeholder="City" value={formData.city} onChange={handleChange} />
          <input name="province" placeholder="Province" value={formData.province} onChange={handleChange} />
        </fieldset>

        {/* Account Info */}
        <fieldset>
          <legend>Account Information</legend>
          <input name="username" placeholder="Username" value={formData.username} onChange={handleChange} required />
          <input name="password" type="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
          <input name="confirmPassword" type="password" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleChange} required />
        </fieldset>

        <button type="submit" style={{ backgroundColor: '#d85c5c', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', fontSize: '16px', marginTop: '20px' }}>Submit</button>
      </form>
    </div>
  );
};

export default StudentForm;
