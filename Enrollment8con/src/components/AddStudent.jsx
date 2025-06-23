import { useState, useEffect, useCallback, useRef } from 'react';

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
    
    // Additional fields for learning preferences
    trading_level_id: '',
    course_id: '',
    device_type: [],
    learning_style: [],
  });

  const [tradingLevels, setTradingLevels] = useState([]);
  const [courses, setCourses] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  // Referrer search states
  const [referrerSearchTerm, setReferrerSearchTerm] = useState('');
  const [referrerSearchResults, setReferrerSearchResults] = useState([]);
  const [selectedReferrer, setSelectedReferrer] = useState(null);
  const [referrerSearchLoading, setReferrerSearchLoading] = useState(false);
  const referrerSearchTimeoutRef = useRef(null);

  const colors = {
    primary: '#4F46E5',
    primaryDark: '#4338CA',
    primaryLight: '#6366F1',
    secondary: '#10B981',
    danger: '#EF4444',
    success: '#22C55E',
    warning: '#F59E0B',
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
    // Legacy colors for backward compatibility
    darkGreen: '#2d4a3d',
    lightGreen: '#7a9b8a',
    dustyRose: '#c19a9a',
    coral: '#d85c5c',
    red: '#d63447',
    cream: '#f5f2e8',
    olive: '#6b7c5c',
    black: '#2c2c2c',
  };

  // Icon components
  const SearchIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );

  const XIcon = ({ size = 12 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  const LoadingSpinner = ({ size = 20 }) => (
    <svg width={size} height={size} className="animate-spin" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  // Check authentication helper
  const checkAuthentication = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in to access this feature.');
      return false;
    }
    return true;
  };

  // Generate random password function
  const generateRandomPassword = (length = 12) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    
    // Ensure at least one of each type
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*";
    
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  // Send email with password function
  const sendPasswordEmail = async (email, password, firstName, lastName) => {
    try {
      const token = localStorage.getItem('token');
      const emailData = {
        to: email,
        subject: 'Your Trading Academy Account Credentials',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2d4a3d;">Welcome to Trading Academy!</h2>
            <p>Dear ${firstName} ${lastName},</p>
            <p>Your student account has been successfully created. Here are your login credentials:</p>
            <div style="background-color: #f5f2e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Password:</strong> <code style="background-color: #fff; padding: 2px 4px; border-radius: 3px;">${password}</code></p>
            </div>
            <p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
            <p>You can log in to your account using your email address and the password provided above.</p>
            <p>If you have any questions, please don't hesitate to contact our support team.</p>
            <p>Best regards,<br>Trading Academy Team</p>
          </div>
        `
      };

      console.log('Attempting to send email to:', email);

      const response = await fetch('http://localhost:3000/api/send-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        throw new Error(`Email service error: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Email sent successfully:', result);
      return true;

    } catch (err) {
      console.error('Email sending error:', err);
      throw err;
    }
  };

  // Improved search for existing students to be referrers
  const searchReferrers = useCallback(async (searchValue) => {
    if (!searchValue.trim()) {
      setReferrerSearchResults([]);
      return;
    }

    setReferrerSearchLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to search for students');
        setReferrerSearchLoading(false);
        return;
      }

      const apiUrl = `http://localhost:3000/api/students?search=${encodeURIComponent(searchValue)}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          const studentsData = await response.json();
          setReferrerSearchResults(studentsData);
          console.log('Referrer search results:', studentsData);
          
          if (studentsData.length === 0) {
            console.log('No students found matching search criteria');
          }
        } else {
          console.error('Invalid response from server');
          setReferrerSearchResults([]);
        }
      } else {
        let errorMessage = 'Failed to search students';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        
        console.error('Search error:', errorMessage);
        setReferrerSearchResults([]);
      }
    } catch (error) {
      console.error('Failed to search referrers:', error);
      setReferrerSearchResults([]);
    } finally {
      setReferrerSearchLoading(false);
    }
  }, []);

  // Fetch trading levels and courses on component mount
  useEffect(() => {
    const loadInitialData = async () => {
      if (checkAuthentication()) {
        setDataLoading(true);
        await Promise.all([
          fetchTradingLevels(),
          fetchCourses()
        ]);
        setDataLoading(false);
      } else {
        setDataLoading(false);
      }
    };

    loadInitialData();
    
    // Cleanup timeout on unmount
    return () => {
      if (referrerSearchTimeoutRef.current) {
        clearTimeout(referrerSearchTimeoutRef.current);
      }
    };
  }, []);

  const fetchTradingLevels = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/trading-levels', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const levels = await response.json();
      setTradingLevels(levels);
      console.log('Trading levels fetched successfully:', levels);
    } catch (err) {
      console.error('Failed to fetch trading levels:', err);
      setTradingLevels([]);
    }
  };

  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/courses/available', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      const coursesData = result.courses || result;
      setCourses(coursesData);
      setAvailableCourses(coursesData);
      console.log('Available courses fetched successfully:', coursesData);
    } catch (err) {
      console.error('Failed to fetch courses:', err);
      setCourses([]);
      setAvailableCourses([]);
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

  // Handle referrer search input changes
  const handleReferrerSearchChange = (e) => {
    const value = e.target.value;
    setReferrerSearchTerm(value);
    
    // Clear error messages when user starts typing
    if (error) setError(null);
    if (success) setSuccess(null);
    
    if (!value.trim()) {
      setReferrerSearchResults([]);
      return;
    }
    
    if (referrerSearchTimeoutRef.current) {
      clearTimeout(referrerSearchTimeoutRef.current);
    }
    
    referrerSearchTimeoutRef.current = setTimeout(() => {
      searchReferrers(value);
    }, 300);
  };

  // Handle referrer selection
  const handleReferrerSelect = (referrer) => {
    setSelectedReferrer(referrer);
    setReferrerSearchTerm(`${referrer.first_name} ${referrer.last_name} (${referrer.student_id})`);
    setReferrerSearchResults([]);
  };

  const validateForm = () => {
    const requiredFields = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'gender',
      'education',
      'birth_place',
      'birth_date',
      'address',
      'trading_level_id',
      'course_id',
    ];

    for (const field of requiredFields) {
      if (!formData[field] || formData[field].toString().trim() === '') {
        setError(`Please fill out the ${field.replace(/_/g, ' ')} field.`);
        return false;
      }
    }

    if (formData.device_type.length === 0) {
      setError('Please select at least one available device.');
      return false;
    }

    if (formData.learning_style.length === 0) {
      setError('Please select at least one learning style.');
      return false;
    }

    setError('');
    return true;
  };

const handleSubmit = async () => {
  if (!validateForm()) {
    return;
  }
  if (!checkAuthentication()) {
    return;
  }
  
  setLoading(true);
  setError(null);
  setSuccess(null);
  
  try {
    // Validate required fields before submission
    if (!formData.course_id) {
      setError('Please select a course');
      return;
    }
    
    // Prepare data for the new API endpoint - only include fields with values
    const submitData = {
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      email: formData.email.trim(),
      course_id: parseInt(formData.course_id)
    };
    
    // Helper function to add field only if it has a valid value
    const addFieldIfValid = (fieldName, value, parser = null) => {
      if (value !== null && value !== undefined && value !== '') {
        if (typeof value === 'string' && value.trim() === '') return;
        if (Array.isArray(value) && value.length === 0) return;
        
        submitData[fieldName] = parser ? parser(value) : value;
      }
    };
    
    // Add optional fields only if they have valid values
    addFieldIfValid('middle_name', formData.middle_name?.trim());
    addFieldIfValid('birth_date', formData.birth_date);
    addFieldIfValid('birth_place', formData.birth_place?.trim());
    addFieldIfValid('gender', formData.gender);
    addFieldIfValid('education', formData.education?.trim());
    addFieldIfValid('phone', formData.phone?.trim());
    addFieldIfValid('address', formData.address?.trim());
    addFieldIfValid('trading_level_id', formData.trading_level_id, parseInt);
    addFieldIfValid('scheme_id', formData.scheme_id, parseInt);
    addFieldIfValid('total_due', formData.total_due, parseFloat);
    addFieldIfValid('amount_paid', formData.amount_paid, parseFloat);
    
    // Handle referrer - only add if there's a valid selection
    if (selectedReferrer && selectedReferrer.student_id) {
      submitData.referred_by = parseInt(selectedReferrer.student_id);
    }
    
    // Handle arrays - only add if they have values
    if (formData.device_type && formData.device_type.length > 0) {
      submitData.device_type = formData.device_type.join(',');
    }
    
    if (formData.learning_style && formData.learning_style.length > 0) {
      submitData.learning_style = formData.learning_style.join(',');
    }
    
    console.log('Submitting student registration data:', submitData);
    
    const token = localStorage.getItem('token');
    
    // Step 1: Register the student
    const response = await fetch('http://localhost:3000/api/students/register', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submitData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.log('Server error response:', errorData);
      
      // Handle validation errors with detailed feedback
      if (errorData.details && Array.isArray(errorData.details)) {
        const validationErrors = errorData.details.map(err => `${err.field}: ${err.message}`).join('\n');
        throw new Error(`Validation errors:\n${validationErrors}`);
      }
      
      throw new Error(errorData.error || `Failed to register student: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Student registered successfully:', result);
    
    // Step 2: Create enrollment record if student registration was successful
    if (result.student_id && result.course_offering && result.course_offering.offering_id) {
      try {
        const enrollmentData = {
          student_id: result.student_id,
          offering_id: result.course_offering.offering_id,
          enrollment_status: 'enrolled'
        };
        
        console.log('Creating enrollment record:', enrollmentData);
        
        const enrollmentResponse = await fetch('http://localhost:3000/api/student-enrollments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(enrollmentData)
        });
        
        if (!enrollmentResponse.ok) {
          const enrollmentError = await enrollmentResponse.json();
          console.warn('Failed to create enrollment record:', enrollmentError);
          
          // Don't fail the entire process if enrollment creation fails
          // The student is already registered, just log the warning
          console.log('Student registered but enrollment record creation failed');
        } else {
          const enrollmentResult = await enrollmentResponse.json();
          console.log('Enrollment record created successfully:', enrollmentResult);
        }
      } catch (enrollmentErr) {
        console.warn('Error creating enrollment record:', enrollmentErr);
        // Continue with success message even if enrollment creation fails
      }
    }
    
    // Provide user feedback based on API response
    if (result.email_sent) {
      setSuccess(`Student registered successfully for ${result.course_offering.course_name}! 
Login credentials have been sent to their email address.
Student ID: ${result.student_id}
Account ID: ${result.account_id}
Batch: ${result.course_offering.batch_identifier}
Offering ID: ${result.course_offering.offering_id}
Enrollment Status: Active`);
    } else {
      setSuccess(`Student registered successfully for ${result.course_offering.course_name}!
Login Credentials:
Email: ${result.credentials.email}
Password: ${result.credentials.password}
Student ID: ${result.student_id}
Account ID: ${result.account_id}
Batch: ${result.course_offering.batch_identifier}
Offering ID: ${result.course_offering.offering_id}
Enrollment Status: Active
${result.email_error ? `Email Error: ${result.email_error}` : 'Email service may be unavailable.'} 
Please provide these credentials to the student manually.`);
      
      // Also log to console for admin reference
      console.log('=== STUDENT LOGIN CREDENTIALS ===');
      console.log('Email:', result.credentials.email);
      console.log('Password:', result.credentials.password);
      console.log('Student ID:', result.student_id);
      console.log('Account ID:', result.account_id);
      console.log('Course:', result.course_offering.course_name);
      console.log('Batch:', result.course_offering.batch_identifier);
      console.log('Offering ID:', result.course_offering.offering_id);
      console.log('Enrollment Status: Active');
      console.log('================================');
    }
    
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
      trading_level_id: '',
      course_id: '',
      device_type: [],
      learning_style: [],
      scheme_id: '',
      total_due: '',
      amount_paid: ''
    });
    
    // Reset referrer fields
    setSelectedReferrer(null);
    setReferrerSearchTerm('');
    setReferrerSearchResults([]);
    
    await fetchCourses();

  } catch (err) {
    console.error('Registration error:', err);
    
    // Handle specific error types
    let errorMessage = 'Failed to register student: ';
    
    if (err.message.includes('401') || err.message.includes('unauthorized')) {
      errorMessage = 'Authentication failed. Please log in again.';
    } else if (err.message.includes('403') || err.message.includes('forbidden')) {
      errorMessage = 'You do not have permission to register students.';
    } else if (err.message.includes('409')) {
      if (err.message.includes('already exists')) {
        errorMessage = 'A student with this email already exists.';
      } else if (err.message.includes('already enrolled')) {
        errorMessage = 'Student is already enrolled in this course offering.';
      }
    } else if (err.message.includes('404')) {
      errorMessage = 'Course offering not found or not available.';
    } else if (err.message.includes('full')) {
      errorMessage = 'Course offering is full. Please select a different offering.';
    } else if (err.message.includes('Validation errors:')) {
      errorMessage = err.message; // Show detailed validation errors
    } else if (err.message.includes('400')) {
      errorMessage = 'Invalid data provided. Please check all required fields.';
    } else if (err.message.includes('500')) {
      errorMessage = 'Server error. Please try again later.';
    } else {
      errorMessage += err.message;
    }
    
    setError(errorMessage);
  } finally {
    setLoading(false);
  }
};

// Function to fetch available courses for the form dropdown
const fetchAvailableCourses = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('http://localhost:3000/api/courses/available', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch available courses');
    }
    
    const result = await response.json();
    return result.courses;
  } catch (error) {
    console.error('Error fetching available courses:', error);
    return [];
  }
};

// Use this in your component to populate the courses dropdown
useEffect(() => {
  const loadAvailableCourses = async () => {
    const courses = await fetchAvailableCourses();
    setAvailableCourses(courses);
  };
  loadAvailableCourses();
}, []);
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
      width: '90%',
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
    // Improved referrer search styles (matching AddDocument.jsx)
    referrerInputGroup: {
      position: 'relative',
      marginBottom: '16px',
    },
    referrerInputIcon: {
      position: 'absolute',
      left: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: colors.gray[400],
      pointerEvents: 'none',
      zIndex: 1,
    },
    referrerInput: {
      width: '90%',
      padding: '10px 12px 10px 40px',
      border: `1px solid ${colors.gray[300]}`,
      borderRadius: '6px',
      fontSize: '16px',
      outline: 'none',
      transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
      marginBottom: '0',
    },
    referrerSearchResults: {
      marginTop: '8px',
      maxHeight: '240px',
      overflowY: 'auto',
      border: `1px solid ${colors.gray[200]}`,
      borderRadius: '6px',
      backgroundColor: '#fff',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    referrerSearchResultItem: {
      padding: '12px 16px',
      borderBottom: `1px solid ${colors.gray[100]}`,
      cursor: 'pointer',
      transition: 'background-color 0.15s ease-in-out',
    },
    selectedReferrer: {
      marginTop: '8px',
      backgroundColor: '#EEF2FF',
      border: `1px solid ${colors.primaryLight}`,
      borderRadius: '6px',
      padding: '16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    closeButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: colors.primary,
      padding: '4px',
      borderRadius: '4px',
      transition: 'background-color 0.15s ease-in-out',
    },
    loadingContainer: {
      padding: '12px 16px',
      textAlign: 'center',
      color: colors.gray[500],
      fontSize: '14px',
    },
    noResultsContainer: {
      padding: '12px 16px',
      textAlign: 'center',
      color: colors.gray[500],
      fontSize: '14px',
    },
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Student Registration Form</h1>
      
      {dataLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <LoadingSpinner size={40} />
          <p style={{ marginTop: '16px', color: colors.gray[500] }}>Loading form data...</p>
        </div>
      ) : (
        <div>

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
                {tradingLevels.length === 0 ? (
                  <option value="" disabled>No trading levels available</option>
                ) : (
                  tradingLevels.map((level) => (
                    <option key={level.level_id} value={level.level_id}>
                      {level.level_name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Course</label>
              <select 
                name="course_id" 
                style={styles.select} 
                value={formData.course_id} 
                onChange={handleChange} 
                disabled={loading}
              >
                <option value="">--Select Course--</option>
                {courses.length === 0 ? (
                  <option value="" disabled>No courses available</option>
                ) : (
                   availableCourses.map((course) => (
                      <option key={course.course_id} value={course.course_id}>
                        {course.course_name} ({course.duration_weeks} weeks)
                        {course.available_offerings > 0 && (
                          ` - ${course.available_offerings} offering(s) available`
                        )}
                    </option>
                  ))
                )}
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
          <legend style={styles.legend}>Referral Information</legend>
          <div style={styles.formRow}>
            <div style={styles.fullWidthGroup}>
              <label style={styles.label}>Referred by:</label>
              <div style={styles.referrerInputGroup}>
                <div style={styles.referrerInputIcon}>
                  <SearchIcon />
                </div>
                <input 
                  style={styles.referrerInput}
                  placeholder="Search for existing student who referred them..."
                  value={referrerSearchTerm}
                  onChange={handleReferrerSearchChange}
                  disabled={loading}
                  onFocus={(e) => {
                    e.target.style.borderColor = colors.primary;
                    e.target.style.boxShadow = `0 0 0 3px ${colors.primary}20`;
                    if (selectedReferrer && referrerSearchTerm.includes('(')) {
                      setSelectedReferrer(null);
                      setReferrerSearchTerm('');
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = colors.gray[300];
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {referrerSearchLoading && (
                <div style={styles.loadingContainer}>
                  <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <LoadingSpinner size={16} />
                    <span style={{ marginLeft: '8px' }}>Searching students...</span>
                  </div>
                </div>
              )}

              {referrerSearchResults.length > 0 && !selectedReferrer && (
                <div style={styles.referrerSearchResults}>
                  {referrerSearchResults.map((referrer) => (
                    <div
                      key={referrer.student_id}
                      style={styles.referrerSearchResultItem}
                      onClick={() => handleReferrerSelect(referrer)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = colors.gray[50];
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: '500', color: colors.gray[900] }}>
                            {referrer.first_name} {referrer.last_name}
                          </div>
                          <div style={{ fontSize: '14px', color: colors.gray[500], marginTop: '2px' }}>
                            ID: {referrer.student_id} • {referrer.email}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '12px', color: colors.gray[500] }}>
                            Status: {referrer.graduation_status || 'Active'}
                          </div>
                          <div style={{ fontSize: '12px', color: colors.gray[500] }}>
                            Level: {referrer.current_trading_level || 'Not assigned'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {referrerSearchTerm && !referrerSearchLoading && referrerSearchResults.length === 0 && !selectedReferrer && (
                <div style={styles.noResultsContainer}>
                  <span style={{ color: colors.gray[500] }}>No students found matching your search</span>
                </div>
              )}

              {selectedReferrer && (
                <div style={styles.selectedReferrer}>
                  <div>
                    <div style={{ fontWeight: '500', color: colors.primary }}>
                      {selectedReferrer.first_name} {selectedReferrer.last_name}
                    </div>
                    <div style={{ fontSize: '14px', color: colors.primaryLight, marginTop: '2px' }}>
                      ID: {selectedReferrer.student_id} • {selectedReferrer.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    style={styles.closeButton}
                    onClick={() => {
                      setSelectedReferrer(null);
                      setReferrerSearchTerm('');
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.gray[200];
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <XIcon />
                  </button>
                </div>
              )}
            </div>
          </div>
        </fieldset>

        <button 
          type="button" 
          style={styles.button}
          disabled={loading}
          onClick={handleSubmit}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = colors.red;
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = colors.coral;
            }
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <LoadingSpinner size={18} />
              <span>Creating Student...</span>
            </div>
          ) : (
            'Register Student'
          )}
        </button>
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}
      </div>
      )}
    </div>
  );
};

export default StudentForm;