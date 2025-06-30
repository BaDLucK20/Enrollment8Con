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
    sponsor: [],
    hasSponsor: '',       // 'yes' or 'no'
    sponsorType: '',
    sponsor_name: '',     // New field for sponsor name
    contact_person: '',
    contact_email: '',
    contact_number: '',
    total_due: 0, // Will be auto-calculated
    amount_paid: 0,
  });

  const [tradingLevels, setTradingLevels] = useState([]);
  const [courses, setCourses] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [courseOfferings, setCourseOfferings] = useState([]); // New state for course offerings with pricing
  const [sponsorTypes, setSponsorTypes] = useState([]); // New state for sponsor types
  const [existingStudents, setExistingStudents] = useState([]);
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

  // Helper function to make authenticated requests
  const makeAuthenticatedRequest = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found. Please log in.');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  };

  // Fetch sponsor types
  const fetchSponsorTypes = async () => {
    try {
      const sponsorTypesData = await makeAuthenticatedRequest('http://localhost:3000/api/sponsor-types');
      setSponsorTypes(sponsorTypesData);
      console.log('Sponsor types fetched successfully:', sponsorTypesData);
    } catch (err) {
      console.error('Failed to fetch sponsor types:', err);
      setSponsorTypes([]);
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
      const studentsData = await makeAuthenticatedRequest(
        `http://localhost:3000/api/students?search=${encodeURIComponent(searchValue)}`
      );
      
      setReferrerSearchResults(studentsData);
      console.log('Referrer search results:', studentsData);
      
      if (studentsData.length === 0) {
        console.log('No students found matching search criteria');
      }
    } catch (error) {
      console.error('Failed to search referrers:', error);
      setReferrerSearchResults([]);
    } finally {
      setReferrerSearchLoading(false);
    }
  }, []);

  // Fetch existing students for duplicate checking
  const fetchExistingStudents = async () => {
    try {
      const studentsData = await makeAuthenticatedRequest('http://localhost:3000/api/students');
      
      if (studentsData.length > 0) {
        console.log('Sample student data structure:', studentsData[0]);
        console.log('Available student fields:', Object.keys(studentsData[0]));
      }
      
      setExistingStudents(Array.isArray(studentsData) ? studentsData : []);
      console.log('Existing students fetched for duplicate checking:', studentsData.length);
    } catch (error) {
      console.error('Error fetching existing students:', error);
      setExistingStudents([]);
    }
  };

  // Fetch course offerings with pricing information
  const fetchCourseOfferings = async () => {
    try {
      const offeringsData = await makeAuthenticatedRequest('http://localhost:3000/api/course-offerings');
      console.log('Course offerings with pricing:', offeringsData);
      setCourseOfferings(offeringsData);
    } catch (error) {
      console.error('Failed to fetch course offerings:', error);
      setCourseOfferings([]);
    }
  };

  // Function to calculate total due based on selected course
  const calculateTotalDue = (courseId) => {
    if (!courseId || courseOfferings.length === 0) {
      return 0;
    }

    // Find the course offering for the selected course
    const courseOffering = courseOfferings.find(offering => 
      offering.course_id === parseInt(courseId)
    );

    if (!courseOffering) {
      console.log('No offering found for course ID:', courseId);
      return 0;
    }

    // Get the regular price from pricing options
    const regularPrice = courseOffering.pricing_options?.regular || 
                         courseOffering.average_price || 
                         0;

    console.log('Calculated price for course:', courseId, 'Price:', regularPrice);
    return parseFloat(regularPrice) || 0;
  };

  // Fetch trading levels and courses on component mount
  useEffect(() => {
    const loadInitialData = async () => {
      if (checkAuthentication()) {
        setDataLoading(true);
        await Promise.all([
          fetchTradingLevels(),
          fetchCourses(),
          fetchCourseOfferings(), // Add this to fetch pricing
          fetchSponsorTypes(), // Add this to fetch sponsor types
          fetchExistingStudents()
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

  // Update total_due when course changes
  useEffect(() => {
    if (formData.course_id) {
      const newTotalDue = calculateTotalDue(formData.course_id);
      setFormData(prev => ({
        ...prev,
        total_due: newTotalDue
      }));
    }
  }, [formData.course_id, courseOfferings]);

  const fetchTradingLevels = async () => {
    try {
      const levels = await makeAuthenticatedRequest('http://localhost:3000/api/trading-levels');
      setTradingLevels(levels);
      console.log('Trading levels fetched successfully:', levels);
    } catch (err) {
      console.error('Failed to fetch trading levels:', err);
      setTradingLevels([]);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await makeAuthenticatedRequest('http://localhost:3000/api/courses/available');
      const coursesData = response.courses || response;
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
    } else if (name === 'hasSponsor') {
      if (value === 'no') {
        setFormData(prev => ({ 
          ...prev, 
          hasSponsor: 'no', 
          sponsorType: '',
          sponsor_name: '',
          contact_person: '',
          contact_email: '',
          contact_number: ''
        }));
      } else {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
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

    // Validate sponsor information if sponsor is selected
    if (formData.hasSponsor === 'yes') {
      if (!formData.sponsorType) {
        setError('Please select a sponsor type.');
        return false;
      }
      if (!formData.sponsor_name.trim()) {
        setError('Please enter the sponsor name.');
        return false;
      }
      if (!formData.contact_person.trim()) {
        setError('Please enter the contact person name.');
        return false;
      }
      if (!formData.contact_email.trim()) {
        setError('Please enter the contact email.');
        return false;
      }
      if (!formData.contact_number.trim()) {
        setError('Please enter the contact number.');
        return false;
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.contact_email)) {
        setError('Please enter a valid contact email address.');
        return false;
      }
    }

    setError('');
    return true;
  };

  const isDuplicateStudent = () => {
    if (!Array.isArray(existingStudents) || existingStudents.length === 0) {
      return false;
    }

    return existingStudents.some(student => {
      const studentFirstName = (student.first_name || '').toString().toLowerCase();
      const studentLastName = (student.last_name || '').toString().toLowerCase();
      const studentEmail = (student.email || '').toString().toLowerCase();
      const studentCourseId = student.course_id;

      const formFirstName = (formData.first_name || '').trim().toLowerCase();
      const formLastName = (formData.last_name || '').trim().toLowerCase();
      const formEmail = (formData.email || '').trim().toLowerCase();
      const formCourseId = parseInt(formData.course_id);

      return studentFirstName && studentLastName && studentEmail &&
             formFirstName && formLastName && formEmail &&
             studentFirstName === formFirstName &&
             studentLastName === formLastName &&
             studentEmail === formEmail &&
             studentCourseId === formCourseId;
    });
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (isDuplicateStudent()) {
      setError('This student is already registered for the selected course.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
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

      // Handle sponsor information
      if (formData.hasSponsor === 'yes') {
        submitData.sponsor_info = {
          sponsor_type: formData.sponsorType,
          sponsor_name: formData.sponsor_name.trim(),
          contact_person: formData.contact_person.trim(),
          contact_email: formData.contact_email.trim(),
          contact_number: formData.contact_number.trim()
        };
      }
      
      console.log('Submitting student registration data:', submitData);
      
      const result = await makeAuthenticatedRequest('http://localhost:3000/api/students/register', {
        method: 'POST',
        body: JSON.stringify(submitData)
      });
      
      console.log('Student registered successfully:', result);
      
      // Provide user feedback based on API response
      let successMessage = `Student registered successfully for ${result.course_offering.course_name}!`;
      
      if (result.email_sent) {
        successMessage += `\nLogin credentials have been sent to their email address.`;
      } else {
        successMessage += `\nLogin Credentials:\nEmail: ${result.credentials.email}\nPassword: ${result.credentials.password}`;
      }
      
      successMessage += `\nStudent ID: ${result.student_id}
Account ID: ${result.account_id}
Batch: ${result.course_offering.batch_identifier}
Offering ID: ${result.course_offering.offering_id}
Total Due: ₱${parseFloat(result.financial_info?.total_due || formData.total_due).toLocaleString()}
Amount Paid: ₱${parseFloat(result.financial_info?.amount_paid || formData.amount_paid).toLocaleString()}
Balance: ₱${parseFloat(result.financial_info?.balance || (formData.total_due - formData.amount_paid)).toLocaleString()}
Enrollment Status: Active`;

      if (result.sponsor_info) {
        successMessage += `\nSponsor: ${result.sponsor_info.sponsor_name} (${result.sponsor_info.sponsor_code})`;
      }

      setSuccess(successMessage);
      
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
        hasSponsor: '',
        sponsorType: '',
        sponsor_name: '',
        contact_person: '',
        contact_email: '',
        contact_number: '',
        total_due: 0,
        amount_paid: 0
      });
      
      // Reset referrer fields
      setSelectedReferrer(null);
      setReferrerSearchTerm('');
      setReferrerSearchResults([]);
      
      // Refresh data to include the new student
      await Promise.all([
        fetchCourses(),
        fetchCourseOfferings(),
        fetchExistingStudents()
      ]);

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
        errorMessage = err.message;
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

  // Get selected course info for display
  const getSelectedCourseInfo = () => {
    if (!formData.course_id || courses.length === 0) {
      return null;
    }

    const selectedCourse = courses.find(course => course.course_id === parseInt(formData.course_id));
    if (!selectedCourse) {
      return null;
    }

    const courseOffering = courseOfferings.find(offering => 
      offering.course_id === parseInt(formData.course_id)
    );

    return {
      ...selectedCourse,
      pricing: courseOffering?.pricing_options || {},
      averagePrice: courseOffering?.average_price || 0
    };
  };

  const selectedCourseInfo = getSelectedCourseInfo();

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
    // Course pricing display
    coursePricingInfo: {
      backgroundColor: '#f0f9ff',
      border: '2px solid #0ea5e9',
      borderRadius: '8px',
      padding: '16px',
      marginTop: '12px',
      marginBottom: '16px',
    },
    coursePricingTitle: {
      fontSize: '16px',
      fontWeight: 'bold',
      color: '#0369a1',
      marginBottom: '8px',
    },
    coursePricingDetails: {
      fontSize: '14px',
      color: '#0369a1',
      marginBottom: '4px',
    },
    totalDueInput: {
      width: '90%',
      padding: '10px',
      marginBottom: '16px',
      border: '2px solid #10b981',
      borderRadius: '4px',
      fontSize: '16px',
      fontWeight: 'bold',
      backgroundColor: '#f0fdf4',
      color: '#059669',
    },
    // Improved referrer search styles
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
              <label style={styles.label}>Course<span style={styles.required}>*</span></label>
              <select 
                name="course_id" 
                style={styles.select} 
                value={formData.course_id} 
                onChange={handleChange} 
                disabled={loading}
                required
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
              
              {/* Course pricing information */}
              {selectedCourseInfo && (
                <div style={styles.coursePricingInfo}>
                  <div style={styles.coursePricingTitle}>
                    📚 Course: {selectedCourseInfo.course_name}
                  </div>
                  <div style={styles.coursePricingDetails}>
                    Duration: {selectedCourseInfo.duration_weeks} weeks
                  </div>
                  <div style={styles.coursePricingDetails}>
                    Credits: {selectedCourseInfo.credits || 'N/A'}
                  </div>
                  {selectedCourseInfo.pricing.regular && (
                    <div style={styles.coursePricingDetails}>
                      💰 Regular Price: ₱{parseFloat(selectedCourseInfo.pricing.regular).toLocaleString()}
                    </div>
                  )}
                  {selectedCourseInfo.pricing.early_bird && (
                    <div style={styles.coursePricingDetails}>
                      🎯 Early Bird Price: ₱{parseFloat(selectedCourseInfo.pricing.early_bird).toLocaleString()}
                    </div>
                  )}
                  {selectedCourseInfo.averagePrice > 0 && (
                    <div style={styles.coursePricingDetails}>
                      📊 Average Price: ₱{parseFloat(selectedCourseInfo.averagePrice).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
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
            {['Face-to-face', 'Online'].map(style => (
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
          <legend style={styles.legend}>Sponsor Information</legend>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Do you have a sponsor?</label>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
              <label style={styles.checkboxLabel}>
                <input
                  type="radio"
                  name="hasSponsor"
                  value="yes"
                  checked={formData.hasSponsor === 'yes'}
                  onChange={handleChange}
                  disabled={loading}
                />
                Yes
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="radio"
                  name="hasSponsor"
                  value="no"
                  checked={formData.hasSponsor === 'no'}
                  onChange={handleChange}
                  disabled={loading}
                />
                No
              </label>
            </div>
          </div>

          {/* Conditional Sponsor Information Fields */}
          {formData.hasSponsor === 'yes' && (
            <div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Sponsor Type<span style={styles.required}>*</span>
                  </label>
                  <select
                    name="sponsorType"
                    value={formData.sponsorType}
                    onChange={handleChange}
                    style={styles.select}
                    required
                    disabled={loading}
                  >
                    <option value="">Select Sponsor Type</option>
                    {sponsorTypes.length === 0 ? (
                      <option value="" disabled>No sponsor types available</option>
                    ) : (
                      sponsorTypes.map((type) => (
                        <option key={type.sponsor_type_id} value={type.type_name}>
                          {type.type_name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Sponsor Name<span style={styles.required}>*</span>
                  </label>
                  <input 
                    style={styles.input} 
                    name="sponsor_name" 
                    value={formData.sponsor_name} 
                    onChange={handleChange} 
                    required
                    disabled={loading}
                    placeholder="Organization/Company/Individual Name"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Contact Person<span style={styles.required}>*</span>
                  </label>
                  <input 
                    style={styles.input} 
                    name="contact_person" 
                    value={formData.contact_person} 
                    onChange={handleChange} 
                    required
                    disabled={loading}
                    placeholder="Full Name of Contact Person"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Contact Email<span style={styles.required}>*</span>
                  </label>
                  <input 
                    type="email" 
                    style={styles.input} 
                    name="contact_email" 
                    value={formData.contact_email} 
                    onChange={handleChange} 
                    required 
                    disabled={loading}
                    placeholder="contact@example.com"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Contact Number<span style={styles.required}>*</span>
                  </label>
                  <input 
                    style={styles.input} 
                    name="contact_number" 
                    value={formData.contact_number} 
                    onChange={handleChange} 
                    required
                    disabled={loading}
                    placeholder="+63 XXX XXX XXXX"
                  />
                </div>
              </div>
            </div>
          )}
        </fieldset>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

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
      </div>
      )}
    </div>
  );
};

export default StudentForm;