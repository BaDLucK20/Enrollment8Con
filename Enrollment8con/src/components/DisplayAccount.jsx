import { useState, useEffect, useMemo } from 'react';
import { Filter, ChevronDown, ChevronUp, User, Users, RefreshCw } from 'lucide-react';

const DisplayAccount = () => {
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [courses, setCourses] = useState([]); // Add courses state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('students');
  const [modalData, setModalData] = useState(null);
  const [modalType, setModalType] = useState(null); // 'student' or 'staff'
  
  // Filter states
  const [filters, setFilters] = useState({
    name: '',
    course: '',
    batch: '',
    status: '',
    role: ''
  });
  const [showFilters, setShowFilters] = useState(false);

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

  useEffect(() => { 
    const initializeData = async () => {
      try {
        // First, fetch courses
        await fetchCourses();
        // Then fetch accounts
        await fetchAccounts();
      } catch (error) {
        console.error('Error initializing data:', error);
        setError('Failed to initialize data. Please refresh the page.');
      }
    };
    
    initializeData();
  }, []);

  // Helper function to get auth token
  const getAuthToken = () => {
    try {
      return localStorage.getItem('token') || localStorage.getItem('authToken');
    } catch (e) {
      console.warn('Could not access localStorage:', e);
      return null;
    }
  };

  // Helper function to make authenticated API calls
  const makeAuthenticatedRequest = async (url, options = {}) => {
    const token = getAuthToken();
    
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
      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (response.status === 403) {
        throw new Error('Access denied. Insufficient permissions.');
      } else if (response.status === 404) {
        throw new Error('Data not found.');
      } else {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
    }

    return response.json();
  };

  // Add function to fetch courses
  const fetchCourses = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.warn('No token available for courses fetch');
        return;
      }

      const coursesData = await makeAuthenticatedRequest('http://localhost:3000/api/courses');
      setCourses(coursesData || []);
      console.log('Fetched courses:', coursesData);
    } catch (err) {
      console.error('Failed to fetch courses:', err.message);
      // Don't set error state here as it's not critical for the main functionality
    }
  };

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if we have an auth token
      const token = getAuthToken();
      if (!token) {
        setError('No authentication token found. Please log in to view accounts.');
        return;
      }
      
      // Ensure courses are loaded first if not already loaded
      if (courses.length === 0) {
        console.log('Courses not loaded yet, fetching courses first...');
        await fetchCourses();
      }
      
      // Fetch students and staff data concurrently
      const [studentsResult, staffResult] = await Promise.allSettled([
        makeAuthenticatedRequest(`http://localhost:3000/api/students`),
        makeAuthenticatedRequest(`http://localhost:3000/api/admin/staff`)
      ]);

      // Handle students data
      if (studentsResult.status === 'fulfilled') {
        console.log('Fetched students:', studentsResult.value);
        setStudents(studentsResult.value || []);
      } else {
        console.error('Failed to fetch students:', studentsResult.reason.message);
        if (studentsResult.reason.message.includes('Access denied')) {
          console.warn('Student data access denied - user may not have sufficient permissions');
        }
      }

      // Handle staff data  
      if (staffResult.status === 'fulfilled') {
        setStaff(staffResult.value || []);
      } else {
        console.error('Failed to fetch staff:', staffResult.reason.message);
        if (staffResult.reason.message.includes('Access denied')) {
          console.warn('Staff data access denied - user may not have admin permissions');
        }
      }

      // Set error only if both requests failed
      if (studentsResult.status === 'rejected' && staffResult.status === 'rejected') {
        const primaryError = studentsResult.reason.message.includes('Authentication') 
          ? studentsResult.reason.message 
          : 'Failed to fetch account data. Please check your permissions and try again.';
        setError(primaryError);
      } else if (studentsResult.status === 'rejected' || staffResult.status === 'rejected') {
        // Partial failure - show warning but don't block the UI
        const failedType = studentsResult.status === 'rejected' ? 'students' : 'staff';
        const reason = studentsResult.status === 'rejected' ? studentsResult.reason : staffResult.reason;
        setError(`Warning: Could not load ${failedType} data. ${reason.message}`);
      }

    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Get unique values for filter dropdowns
  const getUniqueValues = (data, field) => {
    const values = data.map(item => item[field]).filter(Boolean);
    return [...new Set(values)].sort();
  };

  // Updated to use actual courses data
  const uniqueCourses = useMemo(() => {
    // Use the actual courses from the API instead of parsing student enrollment strings
    return courses.map(course => ({
      id: course.course_id,
      code: course.course_code,
      name: course.course_name,
      display: `${course.course_code} - ${course.course_name}`
    })).sort((a, b) => a.display.localeCompare(b.display));
  }, [courses]);

  const uniqueBatches = useMemo(() => {
    return getUniqueValues(students, 'batch_year');
  }, [students]);

  const uniqueStatuses = useMemo(() => {
    return getUniqueValues(students, 'graduation_status');
  }, [students]);

  const uniqueRoles = useMemo(() => {
    return getUniqueValues(staff, 'role_name');
  }, [staff]);

  const getStudentCoursesDisplay = (student) => {
    let courseInfo = [];
    
    console.log('Processing student:', student.student_id, 'Available courses:', courses.length);
    console.log('Student course data:', {
      enrolled_courses: courses.courses,
      course_id: courses.course_id,
      course_code: courses.course_code,
      courses: courses.courses
    });

    // Method 1: If student has enrolled_courses as a string (comma-separated course codes/names)
    if (student.enrolled_courses && typeof student.enrolled_courses === 'string') {
      const enrolledCourseStrings = course.courses.split(',').map(c => c.trim());
      console.log('Enrolled course strings:', enrolledCourseStrings);
      
      courseInfo = enrolledCourseStrings.map(courseStr => {
        // Try to find exact course code match first
        let matchedCourse = courses.find(course => 
          courses.course_code.toLowerCase() === courseStr.toLowerCase()
        );
        
        // If no exact match, try partial matching
        if (!matchedCourse) {
          matchedCourse = courses.find(course => 
            courses.course_name.toLowerCase().includes(courseStr.toLowerCase()) ||
            courseStr.toLowerCase().includes(course.course_code.toLowerCase())
          );
        }
        
        if (matchedCourse) {
          console.log('Found match for', courseStr, ':', matchedCourse);
          return `${matchedCourse.course_code} - ${matchedCourse.course_name}`;
        } else {
          console.log('No match found for:', courseStr);
          return courseStr; // Return original string if no match
        }
      });
    }
    
    // Method 2: If student has course_id, find the matching course
    else if (student.course_id) {
      const matchedCourse = courses.find(course => 
        courses.course_id === parseInt(courses.course_id)
      );
      
      if (matchedCourse) {
        console.log('Found course by ID:', matchedCourse);
        courseInfo = [`${matchedCourse.course_code} - ${matchedCourse.course_name}`];
      } else {
        console.log('No course found for ID:', courses.course_id);
        courseInfo = [`Course ID: ${courses.course_id}`];
      }
    }
    
    // Method 3: If student has course_code, find the matching course
    else if (student.course_code) {
      const matchedCourse = courses.find(course => 
        courses.course_code.toLowerCase() === courses.course_code.toLowerCase()
      );
      
      if (matchedCourse) {
        console.log('Found course by code:', matchedCourse);
        courseInfo = [`${matchedCourse.course_code} - ${matchedCourse.course_name}`];
      } else {
        console.log('No course found for code:', courses.course_code);
        courseInfo = [student.course_code];
      }
    }
    
    // Method 4: If student has an array of courses
    else if (Array.isArray(student.courses)) {
      courseInfo = student.courses.map(course => {
        if (typeof courses === 'object' && courses.course_name) {
          return `${courses.course_code || 'N/A'} - ${course.course_name}`;
        } else if (typeof course === 'object' && course.course_id) {
          // Look up course by ID
          const matchedCourse = courses.find(c => c.course_id === courses.course_id);
          if (matchedCourse) {
            return `${matchedCourse.course_code} - ${matchedCourse.course_name}`;
          }
          return `Course ID: ${course.course_id}`;
        }
        return course.toString();
      });
    }
    
    // Method 5: Check if student has course_name directly
    else if (courses.course_name) {
      courseInfo = [`${courses.course_code || 'N/A'} - ${courses.course_name}`];
    }
    
    // Return formatted display text
    if (courseInfo.length === 0) {
      console.log('No course info found for student:', student.student_id);
      return 'No active enrollments';
    } else if (courseInfo.length === 1) {
      return courseInfo[0];
    } else {
      return `${courseInfo.length} courses: ${courseInfo.slice(0, 2).join(', ')}${courseInfo.length > 2 ? '...' : ''}`;
    }
  };

  // Updated filter logic for courses
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const fullName = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
      const matchesName = fullName.includes(filters.name.toLowerCase());
      
      // Updated course matching logic
      const matchesCourse = !filters.course || (() => {
        // If student has enrolled_courses as a string, check if it contains the course
        if (student.enrolled_courses) {
          return student.enrolled_courses.toLowerCase().includes(filters.course.toLowerCase());
        }
        
        // If student has course_id or course_code, match against that
        if (student.course_id) {
          return student.course_id.toString() === filters.course;
        }
        
        if (student.course_code) {
          return student.course_code.toLowerCase().includes(filters.course.toLowerCase());
        }
        
        // If student has an array of courses
        if (Array.isArray(student.courses)) {
          return student.courses.some(course => 
            course.course_id?.toString() === filters.course ||
            course.course_code?.toLowerCase().includes(filters.course.toLowerCase()) ||
            course.course_name?.toLowerCase().includes(filters.course.toLowerCase())
          );
        }
        
        return false;
      })();
      
      const matchesBatch = !filters.batch || 
        (student.batch_year && student.batch_year.toString() === filters.batch);
      
      const matchesStatus = !filters.status || 
        (student.graduation_status && student.graduation_status.toLowerCase() === filters.status.toLowerCase());

      return matchesName && matchesCourse && matchesBatch && matchesStatus;
    });
  }, [students, filters, courses]);

  const filteredStaff = useMemo(() => {
    return staff.filter(member => {
      const fullName = `${member.first_name || ''} ${member.last_name || ''}`.toLowerCase();
      const matchesName = fullName.includes(filters.name.toLowerCase());
      
      const matchesRole = !filters.role || 
        (member.role_name && member.role_name.toLowerCase() === filters.role.toLowerCase());

      return matchesName && matchesRole;
    });
  }, [staff, filters]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      name: '',
      course: '',
      batch: '',
      status: '',
      role: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(filter => filter !== '');

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      console.warn('Invalid date format:', dateString);
      return 'Invalid Date';
    }
  };

  const getStatusBadge = (status) => {
    const badgeColors = {
      active: '#28a745',
      inactive: '#6c757d',
      suspended: '#dc3545',
      enrolled: '#007bff',
      graduated: '#28a745',
      dropped: '#dc3545',
      staff: '#17a2b8',
      admin: '#6f42c1',
      teacher: '#fd7e14',
      unknown: '#6c757d'
    };

    return {
      backgroundColor: badgeColors[status?.toLowerCase()] || '#6c757d',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold'
    };
  };

  const openModal = (data, type) => {
    setModalData(data);
    setModalType(type);
  };

  const closeModal = () => {
    setModalData(null);
    setModalType(null);
  };

  const renderModalContent = () => {
    if (!modalData || !modalType) return null;

    const allFields = Object.entries(modalData).filter(([key, value]) => 
      value !== null && value !== undefined && value !== '' && 
      key !== 'originalData' && key !== 'user_identifier'
    );

    return (
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>
            Complete {modalType === 'student' ? 'Student' : 'Staff'} Information
          </h3>
          <button style={styles.closeButton} onClick={closeModal}>
            ×
          </button>
        </div>
        
        <div style={styles.modalBody}>
          {/* Special handling for student courses */}
          {modalType === 'student' && (
            <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 12px 0', color: colors.darkGreen }}>Course Information</h4>
              <div style={styles.expandedRow}>
                <span style={styles.expandedLabel}>Enrolled Courses:</span>
                <span style={styles.expandedValue}>
                  {getStudentCoursesDisplay(modalData)}
                </span>
              </div>
              {modalData.enrolled_courses && (
                <div style={styles.expandedRow}>
                  <span style={styles.expandedLabel}>Raw Course Data:</span>
                  <span style={styles.expandedValue}>
                    {modalData.enrolled_courses}
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div style={styles.expandedGrid}>
            {allFields.map(([key, value]) => (
              <div key={key} style={styles.expandedRow}>
                <span style={styles.expandedLabel}>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                </span>
                <span style={styles.expandedValue}>
                  {typeof value === 'object' && value !== null 
                    ? JSON.stringify(value, null, 2)
                    : key.includes('date') 
                      ? formatDate(value)
                      : String(value)
                  }
                </span>
              </div>
            ))}
          </div>
          
          {modalType === 'staff' && modalData.originalData && (
            <div style={styles.rawDataSection}>
              <h4 style={styles.rawDataTitle}>Raw API Data</h4>
              <pre style={styles.rawDataPre}>
                {JSON.stringify(modalData.originalData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  const styles = {
    container: {
      padding: '24px',
      backgroundColor: colors.cream,
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    },

    header: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    },

    title: {
      fontSize: '32px',
      fontWeight: 'bold',
      color: colors.black,
      margin: 0,
      marginBottom: '8px'
    },

    subtitle: {
      fontSize: '16px',
      color: colors.lightGreen,
      margin: 0
    },

    // Updated Filter Section to match PendingPayment.jsx design
    filterSection: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    },

    filterTitle: {
      fontSize: '20px',
      fontWeight: 'bold',
      color: '#2d3748',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },

    filterGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '20px',
      alignItems: 'end'
    },

    filterGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },

    filterLabel: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#4a5568',
      marginBottom: '4px'
    },

    filterInput: {
      padding: '12px 16px',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s',
      width: '100%'
    },

    filterSelect: {
      padding: '12px 16px',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      fontSize: '14px',
      outline: 'none',
      backgroundColor: 'white',
      cursor: 'pointer',
      transition: 'border-color 0.2s',
      width: '100%'
    },

    filterActions: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
      marginTop: '20px',
      flexWrap: 'wrap'
    },

    clearButton: {
      padding: '12px 24px',
      backgroundColor: '#e53e3e',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'background-color 0.2s'
    },

    refreshButton: {
      padding: '12px 24px',
      backgroundColor: colors.lightGreen,
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'background-color 0.2s'
    },

    // Stats Card
    statsCard: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '24px',
      border: '1px solid #e2e8f0'
    },

    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px'
    },

    statItem: {
      textAlign: 'center',
      padding: '16px',
      backgroundColor: colors.cream,
      borderRadius: '8px'
    },

    statValue: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: colors.darkGreen,
      margin: 0
    },

    statLabel: {
      fontSize: '14px',
      color: colors.olive,
      margin: 0
    },

    // Tab Container
    tabContainer: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      marginBottom: '24px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden'
    },

    tabHeader: {
      display: 'flex',
      backgroundColor: colors.lightGreen,
    },

    tab: {
      flex: 1,
      padding: '16px 24px',
      backgroundColor: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: '600',
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px'
    },

    activeTab: {
      backgroundColor: colors.darkGreen,
      color: '#ffffff',
    },

    inactiveTab: {
      backgroundColor: colors.lightGreen,
      color: '#ffffff',
      opacity: 0.8
    },

    tabContent: {
      padding: '20px'
    },

    // Account Grid
    accountsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
      gap: '20px'
    },

    accountCard: {
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      padding: '20px',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      cursor: 'pointer',
    },

    accountCardHover: {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    },

    accountHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '15px',
    },

    accountName: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: colors.darkGreen,
      margin: 0,
    },

    accountId: {
      fontSize: '12px',
      color: colors.olive,
      fontFamily: 'monospace',
    },

    accountInfo: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },

    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    infoLabel: {
      fontWeight: 'bold',
      color: colors.black,
      fontSize: '14px',
    },

    infoValue: {
      color: colors.olive,
      fontSize: '14px',
    },

    viewMoreButton: {
      backgroundColor: colors.lightGreen,
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '12px',
      marginTop: '15px',
      transition: 'background-color 0.2s ease',
      width: '100%',
    },

    // Error and Loading States
    error: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '24px',
      marginTop: '24px',
      border: `1px solid ${colors.red}`,
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },

    errorText: {
      color: colors.red,
      margin: 0
    },

    warning: {
      backgroundColor: '#fff3cd',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '24px',
      border: '1px solid #ffeaa7',
      color: '#856404'
    },

    loading: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '400px',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      marginTop: '24px'
    },

    emptyState: {
      textAlign: 'center',
      padding: '40px',
      color: colors.olive,
      fontSize: '16px',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      border: '1px solid #e2e8f0'
    },

    sectionTitle: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: colors.darkGreen,
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },

    count: {
      backgroundColor: colors.darkGreen,
      color: 'white',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '14px',
      fontWeight: '500'
    },

    // Modal styles (kept as is)
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    },
    modalContent: {
      backgroundColor: 'white',
      borderRadius: '12px',
      maxWidth: '800px',
      width: '100%',
      maxHeight: '90vh',
      overflow: 'hidden',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '20px 24px',
      borderBottom: '1px solid #e9ecef',
      backgroundColor: colors.cream,
    },
    modalTitle: {
      margin: 0,
      color: colors.darkGreen,
      fontSize: '20px',
      fontWeight: 'bold',
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '28px',
      cursor: 'pointer',
      color: colors.coral,
      padding: '0',
      width: '32px',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '50%',
      transition: 'background-color 0.2s ease',
    },
    modalBody: {
      padding: '24px',
      maxHeight: 'calc(90vh - 100px)',
      overflowY: 'auto',
    },
    expandedGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '8px',
    },
    expandedRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 2fr',
      gap: '10px',
      padding: '12px',
      backgroundColor: '#f8f9fa',
      borderRadius: '6px',
      border: '1px solid #e9ecef',
    },
    expandedLabel: {
      fontWeight: 'bold',
      color: colors.black,
      fontSize: '14px',
    },
    expandedValue: {
      color: colors.olive,
      fontSize: '14px',
      wordBreak: 'break-word',
    },
    rawDataSection: {
      marginTop: '24px',
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #e9ecef',
    },
    rawDataTitle: {
      color: colors.darkGreen,
      marginBottom: '12px',
      fontSize: '16px',
      fontWeight: 'bold',
    },
    rawDataPre: {
      backgroundColor: 'white',
      padding: '16px',
      borderRadius: '6px',
      fontSize: '12px',
      maxHeight: '300px',
      overflow: 'auto',
      border: '1px solid #dee2e6',
      margin: 0,
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Account Management</h1>
          <p style={styles.subtitle}>Loading account data...</p>
        </div>
        <div style={styles.loading}>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (error && (students.length === 0 && staff.length === 0)) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Account Management</h1>
          <p style={styles.subtitle}>Error loading account data</p>
        </div>
        <div style={styles.error}>
          <p style={styles.errorText}>{error}</p>
          <button 
            style={styles.refreshButton}
            onClick={() => {
              fetchAccounts();
              fetchCourses();
            }}
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentData = activeTab === 'students' ? filteredStudents : filteredStaff;
  const totalStudents = students.length;
  const totalStaff = staff.length;
  const activeStudents = students.filter(s => s.graduation_status?.toLowerCase() === 'enrolled').length;
  const graduatedStudents = students.filter(s => s.graduation_status?.toLowerCase() === 'graduated').length;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Account Management</h1>
        <p style={styles.subtitle}>Manage and track all student and staff accounts</p>
      </div>
      
      {/* Show warning if there was a partial error */}
      {error && (students.length > 0 || staff.length > 0) && (
        <div style={styles.warning}>{error}</div>
      )}

      {/* Updated Filter Section */}
      <div style={styles.filterSection}>
        <div style={styles.filterTitle}>
          <Filter size={20} />
          Filter {activeTab === 'students' ? 'Students' : 'Staff'}
        </div>
        
        <div style={styles.filterGrid}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Search by Name</label>
            <input
              type="text"
              placeholder="Enter name to search..."
              value={filters.name}
              onChange={(e) => handleFilterChange('name', e.target.value)}
              style={styles.filterInput}
            />
          </div>
          
          {activeTab === 'students' && (
            <>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Course</label>
                <select
                  value={filters.course}
                  onChange={(e) => handleFilterChange('course', e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="">All Courses</option>
                  {uniqueCourses.map(course => (
                    <option key={course.id} value={course.code}>
                      {course.display}
                    </option>
                  ))}
                </select>
              </div>
              
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Batch Year</label>
                <select
                  value={filters.batch}
                  onChange={(e) => handleFilterChange('batch', e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="">All Batches</option>
                  {uniqueBatches.map(batch => (
                    <option key={batch} value={batch}>{batch}</option>
                  ))}
                </select>
              </div>
              
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Graduation Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="">All Statuses</option>
                  {uniqueStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          
          {activeTab === 'staff' && (
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Role</label>
              <select
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">All Roles</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        {hasActiveFilters && (
          <div style={styles.filterActions}>
            <button
              style={styles.clearButton}
              onClick={clearFilters}
              onMouseOver={(e) => e.target.style.backgroundColor = '#c53030'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#e53e3e'}
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Tab Container */}
      <div style={styles.tabContainer}>
        <div style={styles.tabHeader}>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'students' ? styles.activeTab : styles.inactiveTab)
            }}
            onClick={() => setActiveTab('students')}
          >
            <User size={20} />
            Students ({students.length})
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'staff' ? styles.activeTab : styles.inactiveTab)
            }}
            onClick={() => setActiveTab('staff')}
          >
            <Users size={20} />
            Staff ({staff.length})
          </button>
        </div>
      </div>

      {/* Debug Info - Remove this in production */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ backgroundColor: '#f0f0f0', padding: '10px', marginBottom: '20px', fontSize: '12px' }}>
          <strong>Debug Info:</strong><br />
          Total Courses Loaded: {courses.length}<br />
          Courses: {courses.map(c => `${c.course_code} - ${c.course_name}`).join(', ')}<br />
          Sample Student Enrolled Courses (Raw): {students[0]?.enrolled_courses || 'N/A'}<br />
          Sample Student Courses (Processed): {students[0] ? getStudentCoursesDisplay(students[0]) : 'N/A'}
        </div>
      )}

      {/* Student Content */}
      {activeTab === 'students' && (
        <div>
          <div style={styles.sectionTitle}>
            Students
            <span style={styles.count}>{filteredStudents.length}</span>
            {filteredStudents.length !== students.length && (
              <span style={{...styles.count, backgroundColor: colors.olive}}>
                of {students.length}
              </span>
            )}
          </div>
          
          {filteredStudents.length === 0 ? (
            <div style={styles.emptyState}>
              {students.length === 0 
                ? "No students data available. This could be due to access restrictions or empty database."
                : "No students match the current filter criteria."
              }
            </div>
          ) : (
            <div style={styles.accountsGrid}>
              {filteredStudents.map((student, index) => {
                const cardId = student.student_id || `student-${index}`;
                
                return (
                  <div
                    key={cardId}
                    style={styles.accountCard}
                    onMouseEnter={(e) => {
                      Object.assign(e.currentTarget.style, styles.accountCardHover);
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                    }}
                  >
                    <div style={styles.accountHeader}>
                      <h3 style={styles.accountName}>
                        {student.first_name || 'Unknown'} {student.last_name || 'Student'}
                      </h3>
                      <div style={styles.accountId}>
                        ID: {student.student_id || 'N/A'}
                      </div>
                    </div>
                    
                    <div style={styles.accountInfo}>
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Status:</span>
                        <span style={getStatusBadge(student.graduation_status)}>
                          {student.graduation_status || 'N/A'}
                        </span>
                      </div>

                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Enrolled Courses:</span>
                        <span style={styles.infoValue}>
                          {getStudentCoursesDisplay(student)}
                        </span>
                      </div>
                      
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Academic Standing:</span>
                        <span style={styles.infoValue}>
                          {student.academic_standing || 'N/A'}
                        </span>
                      </div>
                      
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Trading Level:</span>
                        <span style={styles.infoValue}>
                          {student.current_trading_level || 'Not assigned'}
                        </span>
                      </div>
                      
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Registered:</span>
                        <span style={styles.infoValue}>
                          {formatDate(student.registration_date)}
                        </span>
                      </div>
                    </div>

                    <button
                      style={styles.viewMoreButton}
                      onClick={() => openModal(student, 'student')}
                      onMouseOver={(e) => e.target.style.backgroundColor = colors.darkGreen}
                      onMouseOut={(e) => e.target.style.backgroundColor = colors.lightGreen}
                    >
                      View More Info
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Staff Content */}
      {activeTab === 'staff' && (
        <div>
          <div style={styles.sectionTitle}>
            Staff
            <span style={styles.count}>{filteredStaff.length}</span>
            {filteredStaff.length !== staff.length && (
              <span style={{...styles.count, backgroundColor: colors.olive}}>
                of {staff.length}
              </span>
            )}
          </div>
          {filteredStaff.length === 0 ? (
            <div style={styles.emptyState}>
              {staff.length === 0 
                ? "No staff data available. This could be due to insufficient admin privileges or empty database."
                : "No staff members match the current filter criteria."
              }
            </div>
          ) : (
            <div style={styles.accountsGrid}>
              {filteredStaff.map((member, index) => {
                const cardId = member.account_id || member.user_identifier || `staff-${index}`;
                
                return (
                  <div
                    key={cardId}
                    style={styles.accountCard}
                    onMouseEnter={(e) => {
                      Object.assign(e.currentTarget.style, styles.accountCardHover);
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                    }}
                  >
                    <div style={styles.accountHeader}>
                      <h3 style={styles.accountName}>
                        {member.first_name} {member.last_name}
                      </h3>
                      <div style={styles.accountId}>
                        ID: {member.user_identifier || member.account_id || 'N/A'}
                      </div>
                    </div>
                    
                    <div style={styles.accountInfo}>
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Role:</span>
                        <span style={getStatusBadge(member.role_name)}>
                          {member.role_name || 'N/A'}
                        </span>
                      </div>
                      
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Employee ID:</span>
                        <span style={styles.infoValue}>
                          {member.employee_id || 'N/A'}
                        </span>
                      </div>
                      
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Account Status:</span>
                        <span style={getStatusBadge(member.account_status)}>
                          {member.account_status || 'N/A'}
                        </span>
                      </div>
                      
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Last Login:</span>
                        <span style={styles.infoValue}>
                          {formatDate(member.last_login)}
                        </span>
                      </div>
                      
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Email:</span>
                        <span style={styles.infoValue}>
                          {member.email || member.primary_email || 'N/A'}
                        </span>
                      </div>
                      
                      {member.hire_date && (
                        <div style={styles.infoRow}>
                          <span style={styles.infoLabel}>Hire Date:</span>
                          <span style={styles.infoValue}>
                            {formatDate(member.hire_date)}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      style={styles.viewMoreButton}
                      onClick={() => openModal(member, 'staff')}
                      onMouseOver={(e) => e.target.style.backgroundColor = colors.darkGreen}
                      onMouseOut={(e) => e.target.style.backgroundColor = colors.lightGreen}
                    >
                      View More Info
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalData && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div onClick={(e) => e.stopPropagation()}>
            {renderModalContent()}
          </div>
        </div>
      )}
    </div>
  );
};

export default DisplayAccount;