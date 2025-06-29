import { useState, useEffect, useMemo } from 'react';
import { Filter, ChevronDown, ChevronUp, User, Users, RefreshCw, Plus, BookOpen, Edit3, Trash2, Save, X } from 'lucide-react';

const DisplayAccount = () => {
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseOfferings, setCourseOfferings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('students');
  const [modalData, setModalData] = useState(null);
  const [modalType, setModalType] = useState(null);
  
  // Course application states
  const [showCourseApplication, setShowCourseApplication] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [applicationError, setApplicationError] = useState('');
  
  // Course management states
  const [showCourseManagement, setShowCourseManagement] = useState(false);
  const [currentEnrollments, setCurrentEnrollments] = useState([]);
  const [managementLoading, setManagementLoading] = useState(false);
  const [managementError, setManagementError] = useState('');
  
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
        await fetchCourses();
        await fetchCourseOfferings();
        await fetchAccounts();
      } catch (error) {
        console.error('Error initializing data:', error);
        setError('Failed to initialize data. Please refresh the page.');
      }
    };
    
    initializeData();
  }, []);

  // Debug function to check student data structure
  useEffect(() => {
    if (students.length > 0) {
      console.log('=== STUDENT DATA DEBUG ===');
      console.log('Sample student:', students[0]);
      console.log('Available batches in filter:', uniqueBatches);
      
      // Show batch-related fields for first few students
      students.slice(0, 3).forEach(student => {
        console.log(`Student ${student.student_id} batch data:`, {
          batch_identifiers: student.batch_identifiers,
          batch_identifier: student.batch_identifier,
          batch_year: student.batch_year,
          enrolled_courses: student.enrolled_courses
        });
      });
    }
  }, [students]);

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
      let errorMessage = `Server error: ${response.status} ${response.statusText}`;
      let errorDetails = null;
      
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        errorDetails = errorData;
      } catch (parseError) {
        console.warn('Could not parse error response:', parseError);
      }

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (response.status === 403) {
        throw new Error('Access denied. Insufficient permissions.');
      } else if (response.status === 404) {
        throw new Error('Data not found.');
      } else if (response.status === 409) {
        const conflictError = new Error(errorMessage);
        conflictError.details = errorDetails;
        conflictError.status = 409;
        throw conflictError;
      } else {
        const serverError = new Error(errorMessage);
        serverError.details = errorDetails;
        serverError.status = response.status;
        throw serverError;
      }
    }

    return response.json();
  };

  // Fetch courses
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
    }
  };

  // Fetch course offerings
  const fetchCourseOfferings = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.warn('No token available for course offerings fetch');
        return;
      }

      const offeringsData = await makeAuthenticatedRequest('http://localhost:3000/api/course-offerings');
      setCourseOfferings(offeringsData || []);
      console.log('Fetched course offerings:', offeringsData);
    } catch (err) {
      console.error('Failed to fetch course offerings:', err.message);
    }
  };

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getAuthToken();
      if (!token) {
        setError('No authentication token found. Please log in to view accounts.');
        return;
      }
      
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

  // Fixed function to fetch actual enrollments for a student from the API
  const fetchStudentEnrollments = async (studentId) => {
    try {
      console.log('Fetching enrollments for student ID:', studentId);
      
      const response = await makeAuthenticatedRequest(
        `http://localhost:3000/api/student/${studentId}/enrollments`
      );
      
      console.log('Raw API response for enrollments:', response);
      
      // Handle different response formats
      let enrollments = [];
      if (response.enrollments && Array.isArray(response.enrollments)) {
        enrollments = response.enrollments;
      } else if (response.message && response.enrollments) {
        enrollments = response.enrollments;
      } else if (Array.isArray(response)) {
        enrollments = response;
      } else {
        console.warn('Unexpected enrollment response format:', response);
        enrollments = [];
      }
      
      console.log('Processed enrollments:', enrollments);
      return enrollments;
          
    } catch (error) {
      console.error('Failed to fetch student enrollments:', error);
      return [];
    }
  };

  // Function to handle course management
  const handleCourseManagement = async (studentId) => {
    try {
      const student = students.find(s => s.student_id === studentId);
      if (!student) {
        setManagementError('Student not found.');
        return;
      }

      setSelectedStudent(student);
      setManagementError('');
      setManagementLoading(true);
      
      console.log('=== COURSE MANAGEMENT PREP ===');
      console.log('Student:', student);
      
      // Fetch current enrollments
      const enrollments = await fetchStudentEnrollments(studentId);
      console.log('Current enrollments:', enrollments);
      
      setCurrentEnrollments(enrollments);
      setShowCourseManagement(true);
      
    } catch (error) {
      console.error('Error preparing course management:', error);
      setManagementError('Failed to load course enrollments. Please try again.');
    } finally {
      setManagementLoading(false);
    }
  };

  // Function to withdraw from a course
  const withdrawFromCourse = async (enrollmentId, courseName) => {
    if (!confirm(`Are you sure you want to withdraw ${selectedStudent?.first_name} ${selectedStudent?.last_name} from ${courseName}?`)) {
      return;
    }

    try {
      setManagementLoading(true);
      
      await makeAuthenticatedRequest(
        `http://localhost:3000/api/student/enrollment/${enrollmentId}`,
        {
          method: 'DELETE'
        }
      );
      
      // Refresh enrollments
      const updatedEnrollments = await fetchStudentEnrollments(selectedStudent.student_id);
      setCurrentEnrollments(updatedEnrollments);
      
      // Refresh accounts data
      await fetchAccounts();
      
      alert('Successfully withdrew from course!');
      
    } catch (error) {
      console.error('Failed to withdraw from course:', error);
      setManagementError('Failed to withdraw from course: ' + error.message);
    } finally {
      setManagementLoading(false);
    }
  };

  // Fixed function to get and display student courses
  const getStudentCoursesDisplay = (student) => {
    console.log('Processing student for course display:', student.student_id);
    
    let courseInfo = [];
    
    // Method 1: Parse enrolled_courses string (most common format)
    if (student.enrolled_courses && typeof student.enrolled_courses === 'string') {
      const enrolledCourseStrings = student.enrolled_courses.split(',').map(c => c.trim());
      console.log('Enrolled course strings:', enrolledCourseStrings);
      
      courseInfo = enrolledCourseStrings.map(courseStr => {
        // Try to find exact course code match
        let matchedCourse = courses.find(course => 
          course.course_code?.toLowerCase() === courseStr.toLowerCase()
        );
        
        // If no exact match, try partial matching
        if (!matchedCourse) {
          matchedCourse = courses.find(course => 
            courseStr.toLowerCase().includes(course.course_code?.toLowerCase()) ||
            course.course_name?.toLowerCase().includes(courseStr.toLowerCase())
          );
        }
        
        if (matchedCourse) {
          return `${matchedCourse.course_code} - ${matchedCourse.course_name}`;
        } else {
          return courseStr; // Return original string if no match
        }
      });
    }
    // Method 2: Single course by ID
    else if (student.course_id) {
      const matchedCourse = courses.find(course => 
        course.course_id === parseInt(student.course_id)
      );
      
      if (matchedCourse) {
        courseInfo = [`${matchedCourse.course_code} - ${matchedCourse.course_name}`];
      } else {
        courseInfo = [`Course ID: ${student.course_id}`];
      }
    }
    // Method 3: Single course by code
    else if (student.course_code) {
      const matchedCourse = courses.find(course => 
        course.course_code?.toLowerCase() === student.course_code?.toLowerCase()
      );
      
      if (matchedCourse) {
        courseInfo = [`${matchedCourse.course_code} - ${matchedCourse.course_name}`];
      } else {
        courseInfo = [student.course_code];
      }
    }
    // Method 4: Array of courses
    else if (Array.isArray(student.courses)) {
      courseInfo = student.courses.map(course => {
        if (typeof course === 'object' && course.course_name) {
          return `${course.course_code || 'N/A'} - ${course.course_name}`;
        } else if (typeof course === 'object' && course.course_id) {
          const matchedCourse = courses.find(c => c.course_id === course.course_id);
          if (matchedCourse) {
            return `${matchedCourse.course_code} - ${matchedCourse.course_name}`;
          }
          return `Course ID: ${course.course_id}`;
        }
        return course.toString();
      });
    }
    // Method 5: Direct course_name
    else if (student.course_name) {
      courseInfo = [`${student.course_code || 'N/A'} - ${student.course_name}`];
    }
    
    // Return formatted display text
    if (courseInfo.length === 0) {
      return 'No active enrollments';
    } else if (courseInfo.length === 1) {
      return courseInfo[0];
    } else {
      return `${courseInfo.length} courses: ${courseInfo.slice(0, 2).join(', ')}${courseInfo.length > 2 ? '...' : ''}`;
    }
  };

  // Fixed function to submit course applications
  const submitCourseApplication = async () => {
    if (selectedCourses.length === 0 || !selectedStudent) {
      setApplicationError('Please select at least one course.');
      return;
    }

    setApplicationLoading(true);
    setApplicationError('');

    try {
      const studentId = selectedStudent.student_id;

      console.log('🚀 Submitting enrollments for student:', studentId);
      console.log('📚 Selected courses:', selectedCourses);

      const enrollmentResults = [];
      const enrollmentErrors = [];

      // Enroll in each selected course
      for (const courseId of selectedCourses) {
        try {
          console.log(`📝 Enrolling in course ${courseId}...`);
          
          const response = await makeAuthenticatedRequest(
            'http://localhost:3000/api/student/enroll-course',
            {
              method: 'POST',
              body: JSON.stringify({
                student_id: studentId,
                course_id: parseInt(courseId)
              })
            }
          );

          enrollmentResults.push(response);
          console.log('✅ Enrollment success:', response);
          
        } catch (error) {
          console.error('❌ Enrollment error:', error);
          
          const course = courses.find(c => c.course_id === parseInt(courseId));
          const courseName = course ? `${course.course_code} - ${course.course_name}` : `Course ID: ${courseId}`;
          
          // Extract meaningful error message
          let errorMessage = error.message;
          if (error.details && error.details.message) {
            errorMessage = error.details.message;
          } else if (typeof error.details === 'string') {
            errorMessage = error.details;
          }
          
          enrollmentErrors.push(`${courseName}: ${errorMessage}`);
        }
      }

      // Close the modal
      setShowCourseApplication(false);
      setSelectedStudent(null);
      setSelectedCourses([]);
      
      // Refresh the accounts data to show the new enrollments
      await fetchAccounts();
      
      // Show results
      let message = '';
      if (enrollmentResults.length > 0) {
        message += `✅ Successfully enrolled in ${enrollmentResults.length} course(s):\n`;
        enrollmentResults.forEach(result => {
          const courseName = result.enrollment?.course?.course_name || 
                            result.enrollment?.course?.course_code || 
                            'Unknown Course';
          const batchInfo = result.enrollment?.offering?.batch_identifier || '';
          message += `• ${courseName} ${batchInfo ? `(${batchInfo})` : ''}\n`;
        });
      }
      
      if (enrollmentErrors.length > 0) {
        if (message) message += '\n';
        message += `❌ Failed to enroll in ${enrollmentErrors.length} course(s):\n`;
        enrollmentErrors.forEach(error => {
          message += `• ${error}\n`;
        });
      }
      
      alert(message || 'Course applications submitted!');
      
    } catch (error) {
      console.error('❌ Failed to submit course applications:', error);
      setApplicationError(error.message || 'Failed to submit course applications. Please try again.');
    } finally {
      setApplicationLoading(false);
    }
  };

  // Enhanced course application handler with better error handling
  const handleCourseApplication = async (studentId) => {
    try {
      const student = students.find(s => s.student_id === studentId);
      if (!student) {
        setApplicationError('Student not found.');
        return;
      }

      console.log('🎯 Preparing course application for student:', student);

      setSelectedStudent(student);
      setApplicationError('');
      setSelectedCourses([]);
      
      // Get current enrollments from API
      const currentEnrollments = await fetchStudentEnrollments(studentId);
      console.log('📚 Current enrollments:', currentEnrollments);
      
      // Extract enrolled course IDs
      const enrolledCourseIds = new Set();
      
      if (currentEnrollments && currentEnrollments.length > 0) {
        currentEnrollments.forEach(enrollment => {
          if (['enrolled', 'active', 'completed'].includes(enrollment.enrollment_status?.toLowerCase())) {
            if (enrollment.course_id) {
              enrolledCourseIds.add(enrollment.course_id);
            }
          }
        });
      }
      
      console.log('🔒 Already enrolled in course IDs:', Array.from(enrolledCourseIds));
      
      // Filter out already enrolled courses
      const available = courses.filter(course => {
        const isEnrolled = enrolledCourseIds.has(course.course_id);
        console.log(`📋 Course ${course.course_code} (ID: ${course.course_id}) - Enrolled: ${isEnrolled}`);
        return !isEnrolled;
      });
      
      console.log('✅ Available courses for enrollment:', available.length);
      
      if (available.length === 0) {
        if (courses.length === 0) {
          setApplicationError('No courses are currently available in the system.');
        } else {
          setApplicationError('This student is already enrolled in all available courses.');
        }
      }
      
      setAvailableCourses(available);
      setShowCourseApplication(true);
      
    } catch (error) {
      console.error('❌ Error preparing course application:', error);
      setApplicationError('Failed to prepare course application: ' + error.message);
    }
  };

  // Handle course selection for multiple courses
  const handleCourseSelectionToggle = (courseId) => {
    setSelectedCourses(prev => {
      const courseIdInt = parseInt(courseId);
      if (prev.includes(courseIdInt)) {
        return prev.filter(id => id !== courseIdInt);
      } else {
        return [...prev, courseIdInt];
      }
    });
  };

  // Get unique values for filter dropdowns
  const getUniqueValues = (data, field) => {
    const values = data.map(item => item[field]).filter(Boolean);
    return [...new Set(values)].sort();
  };

  // Updated to use actual courses data
  const uniqueCourses = useMemo(() => {
    return courses.map(course => ({
      id: course.course_id,
      code: course.course_code,
      name: course.course_name,
      display: `${course.course_code} - ${course.course_name}`
    })).sort((a, b) => a.display.localeCompare(b.display));
  }, [courses]);

  // Fixed batch filter to use student batch identifiers
  const uniqueBatches = useMemo(() => {
    // Get batch identifiers from student data
    const studentBatchIdentifiers = students
      .map(student => student.batch_identifiers)
      .filter(Boolean)
      .flatMap(batchStr => batchStr.split(',').map(b => b.trim()))
      .filter(Boolean);
    
    // Also get from course offerings as backup
    const courseOfferingBatches = courseOfferings
      .map(offering => offering.batch_identifier)
      .filter(Boolean);
    
    // Also include batch years from students if available
    const studentBatchYears = students
      .map(student => student.batch_year)
      .filter(Boolean)
      .map(year => year.toString());
    
    // Combine all sources and remove duplicates
    const allBatches = [...studentBatchIdentifiers, ...courseOfferingBatches, ...studentBatchYears];
    return [...new Set(allBatches)].sort();
  }, [students, courseOfferings]);

  const uniqueStatuses = useMemo(() => {
    return getUniqueValues(students, 'graduation_status');
  }, [students]);

  const uniqueRoles = useMemo(() => {
    return getUniqueValues(staff, 'role_name');
  }, [staff]);

  // Updated filter logic for courses and batches
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
      
      // Fixed batch matching logic
      const matchesBatch = !filters.batch || (() => {
        console.log('Filtering student:', student.student_id, 'for batch:', filters.batch);
        
        // Method 1: Check batch_identifiers field from student enrollments
        if (student.batch_identifiers) {
          const studentBatches = student.batch_identifiers.split(',').map(b => b.trim());
          const hasMatch = studentBatches.includes(filters.batch);
          if (hasMatch) {
            console.log('✅ Match via batch_identifiers:', student.batch_identifiers);
            return true;
          }
        }
        
        // Method 2: Check direct batch_identifier field
        if (student.batch_identifier && student.batch_identifier === filters.batch) {
          console.log('✅ Match via batch_identifier:', student.batch_identifier);
          return true;
        }
        
        // Method 3: Check batch_year field (convert to string for comparison)
        if (student.batch_year && student.batch_year.toString() === filters.batch) {
          console.log('✅ Match via batch_year:', student.batch_year);
          return true;
        }
        
        // Method 4: Check other possible batch fields
        const studentFields = [
          student.batch,
          student.batch_id,
          student.current_batch,
          student.enrollment_batch,
          student.cohort_identifier,
          student.class_identifier
        ];
        
        for (const field of studentFields) {
          if (field && field.toString() === filters.batch) {
            console.log('✅ Match via student field:', field);
            return true;
          }
        }
        
        console.log('❌ No batch match found for student:', student.student_id);
        return false;
      })();
      
      const matchesStatus = !filters.status || 
        (student.graduation_status && student.graduation_status.toLowerCase() === filters.status.toLowerCase());

      return matchesName && matchesCourse && matchesBatch && matchesStatus;
    });
  }, [students, filters, courses, courseOfferings]);

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

  // Function to close course application modal
  const closeCourseApplication = () => {
    setShowCourseApplication(false);
    setSelectedStudent(null);
    setSelectedCourses([]);
    setApplicationError('');
  };

  // Function to close course management modal
  const closeCourseManagement = () => {
    setShowCourseManagement(false);
    setSelectedStudent(null);
    setCurrentEnrollments([]);
    setManagementError('');
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

  // Render course application modal (for adding new courses)
  const renderCourseApplicationModal = () => {
    if (!showCourseApplication || !selectedStudent) return null;

    return (
      <div style={styles.modalOverlay} onClick={closeCourseApplication}>
        <div onClick={(e) => e.stopPropagation()} style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h3 style={styles.modalTitle}>
              <Plus size={20} style={{ marginRight: '8px' }} />
              Enroll in Additional Courses
            </h3>
            <button style={styles.closeButton} onClick={closeCourseApplication}>
              ×
            </button>
          </div>
          
          <div style={styles.modalBody}>
            <div style={styles.courseApplicationContainer}>
              <div style={styles.studentInfo}>
                <h4 style={styles.sectionTitle}>Student Information</h4>
                <p><strong>Name:</strong> {selectedStudent.first_name} {selectedStudent.last_name}</p>
                <p><strong>Student ID:</strong> {selectedStudent.student_id}</p>
                <p><strong>Current Courses:</strong> {getStudentCoursesDisplay(selectedStudent)}</p>
                <p><strong>Batch:</strong> {selectedStudent.batch_identifiers || selectedStudent.batch_identifier || selectedStudent.batch_year || 'N/A'}</p>
              </div>

              <div style={styles.courseSelection}>
                <h4 style={styles.sectionTitle}>Available Courses</h4>
                {availableCourses.length === 0 ? (
                  <div style={styles.noCourses}>
                    <p>No additional courses available for enrollment.</p>
                    <p style={{ fontSize: '14px', marginTop: '8px', color: colors.olive }}>
                      This could be because:
                    </p>
                    <ul style={{ fontSize: '14px', color: colors.olive, marginLeft: '20px' }}>
                      <li>The student is already enrolled in all available courses</li>
                      <li>No course offerings are currently open for enrollment</li>
                      <li>All available offerings are at maximum capacity</li>
                    </ul>
                  </div>
                ) : (
                  <>
                    <div style={styles.courseGrid}>
                      {availableCourses.map(course => {
                        const isSelected = selectedCourses.includes(course.course_id);
                        return (
                          <div
                            key={course.course_id}
                            style={{
                              ...styles.courseCard,
                              ...(isSelected ? styles.courseCardSelected : {})
                            }}
                            onClick={() => handleCourseSelectionToggle(course.course_id)}
                          >
                            <div style={styles.courseCardHeader}>
                              <input
                                type="checkbox"
                                style={styles.courseCheckbox}
                                checked={isSelected}
                                onChange={(e) => handleCourseSelectionToggle(course.course_id)}
                              />
                              <div style={styles.courseInfo}>
                                <div style={styles.courseTitle}>
                                  {course.course_code} - {course.course_name}
                                </div>
                                <div style={styles.courseDescription}>
                                  {course.course_description && (
                                    <div>{course.course_description}</div>
                                  )}
                                  {course.duration_weeks && (
                                    <div>Duration: {course.duration_weeks} weeks</div>
                                  )}
                                  {course.credits && (
                                    <div>Credits: {course.credits}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selectedCourses.length > 0 && (
                      <div style={styles.selectedCoursesInfo}>
                        <strong>Selected Courses ({selectedCourses.length}):</strong>
                        <ul style={{ margin: '8px 0 0 20px', fontSize: '14px' }}>
                          {selectedCourses.map(courseId => {
                            const course = availableCourses.find(c => c.course_id === courseId);
                            return (
                              <li key={courseId}>
                                {course ? `${course.course_code} - ${course.course_name}` : `Course ID: ${courseId}`}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>

              {applicationError && (
                <div style={styles.errorMessage}>
                  {applicationError}
                </div>
              )}

              <div style={styles.modalActions}>
                <button
                  style={styles.cancelButton}
                  onClick={closeCourseApplication}
                  disabled={applicationLoading}
                >
                  Cancel
                </button>
                <button
                  style={{
                    ...styles.submitButton,
                    opacity: (selectedCourses.length === 0 || applicationLoading) ? 0.6 : 1
                  }}
                  onClick={submitCourseApplication}
                  disabled={selectedCourses.length === 0 || applicationLoading || availableCourses.length === 0}
                >
                  {applicationLoading ? 'Enrolling...' : `Enroll in ${selectedCourses.length} Course(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render course management modal (for viewing and editing existing enrollments)
  const renderCourseManagementModal = () => {
    if (!showCourseManagement || !selectedStudent) return null;

    return (
      <div style={styles.modalOverlay} onClick={closeCourseManagement}>
        <div onClick={(e) => e.stopPropagation()} style={{...styles.modalContent, maxWidth: '900px'}}>
          <div style={styles.modalHeader}>
            <h3 style={styles.modalTitle}>
              <Edit3 size={20} style={{ marginRight: '8px' }} />
              Manage Course Enrollments
            </h3>
            <button style={styles.closeButton} onClick={closeCourseManagement}>
              ×
            </button>
          </div>
          
          <div style={styles.modalBody}>
            <div style={styles.courseApplicationContainer}>
              <div style={styles.studentInfo}>
                <h4 style={styles.sectionTitle}>Student Information</h4>
                <p><strong>Name:</strong> {selectedStudent.first_name} {selectedStudent.last_name}</p>
                <p><strong>Student ID:</strong> {selectedStudent.student_id}</p>
                <p><strong>Email:</strong> {selectedStudent.email}</p>
                <p><strong>Batch:</strong> {selectedStudent.batch_identifiers || selectedStudent.batch_identifier || selectedStudent.batch_year || 'N/A'}</p>
              </div>

              <div style={styles.courseSelection}>
                <h4 style={styles.sectionTitle}>Current Enrollments</h4>
                {managementLoading ? (
                  <div style={styles.loadingContainer}>Loading enrollments...</div>
                ) : currentEnrollments.length === 0 ? (
                  <div style={styles.noCourses}>
                    <p>No active enrollments found.</p>
                  </div>
                ) : (
                  <div style={styles.enrollmentsList}>
                    {currentEnrollments.map((enrollment, index) => (
                      <div key={enrollment.enrollment_id || index} style={styles.enrollmentCard}>
                        <div style={styles.enrollmentInfo}>
                          <div style={styles.courseTitle}>
                            {enrollment.course_code} - {enrollment.course_name}
                          </div>
                          <div style={styles.enrollmentDetails}>
                            <span style={styles.enrollmentBadge}>
                              Status: {enrollment.enrollment_status}
                            </span>
                            {enrollment.batch_identifier && (
                              <span style={styles.enrollmentBadge}>
                                Batch: {enrollment.batch_identifier}
                              </span>
                            )}
                            {enrollment.enrollment_date && (
                              <span style={styles.enrollmentDetail}>
                                Enrolled: {formatDate(enrollment.enrollment_date)}
                              </span>
                            )}
                            {enrollment.start_date && (
                              <span style={styles.enrollmentDetail}>
                                Start: {formatDate(enrollment.start_date)}
                              </span>
                            )}
                            {enrollment.end_date && (
                              <span style={styles.enrollmentDetail}>
                                End: {formatDate(enrollment.end_date)}
                              </span>
                            )}
                          </div>
                          {enrollment.completion_percentage !== undefined && (
                            <div style={styles.progressBar}>
                              <div style={styles.progressLabel}>
                                Progress: {enrollment.completion_percentage}%
                              </div>
                              <div style={styles.progressTrack}>
                                <div 
                                  style={{
                                    ...styles.progressFill,
                                    width: `${Math.max(0, Math.min(100, enrollment.completion_percentage))}%`
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={styles.enrollmentActions}>
                          {enrollment.enrollment_status === 'enrolled' && (
                            <button
                              style={styles.withdrawButton}
                              onClick={() => withdrawFromCourse(
                                enrollment.enrollment_id, 
                                `${enrollment.course_code} - ${enrollment.course_name}`
                              )}
                              disabled={managementLoading}
                            >
                              <Trash2 size={14} />
                              Withdraw
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {managementError && (
                <div style={styles.errorMessage}>
                  {managementError}
                </div>
              )}

              <div style={styles.modalActions}>
                <button
                  style={styles.cancelButton}
                  onClick={closeCourseManagement}
                  disabled={managementLoading}
                >
                  Close
                </button>
                <button
                  style={styles.submitButton}
                  onClick={() => {
                    closeCourseManagement();
                    handleCourseApplication(selectedStudent.student_id);
                  }}
                  disabled={managementLoading}
                >
                  <Plus size={14} style={{ marginRight: '4px' }} />
                  Add More Courses
                </button>
              </div>
            </div>
          </div>
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
    buttonContainer: {
      display: 'flex',
      gap: '8px',
      marginTop: '15px',
    },
    viewMoreButton: {
      backgroundColor: colors.lightGreen,
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '12px',
      transition: 'background-color 0.2s ease',
      flex: 1,
    },
    applyCourseButton: {
      backgroundColor: colors.coral,
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '12px',
      transition: 'background-color 0.2s ease',
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
    },
    manageCourseButton: {
      backgroundColor: colors.olive,
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '12px',
      transition: 'background-color 0.2s ease',
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
    },
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
      display: 'flex',
      alignItems: 'center',
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
    },
    courseApplicationContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    },
    studentInfo: {
      backgroundColor: '#f8f9fa',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #e9ecef',
    },
    courseSelection: {
      backgroundColor: '#ffffff',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #e9ecef',
    },
    courseGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '12px',
      marginBottom: '16px',
    },
    courseCard: {
      border: '2px solid #e5e7eb',
      borderRadius: '8px',
      padding: '12px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      backgroundColor: '#fff',
    },
    courseCardSelected: {
      border: '2px solid #4F46E5',
      backgroundColor: '#EEF2FF',
    },
    courseCardHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
      marginBottom: '8px',
    },
    courseCheckbox: {
      marginTop: '2px',
    },
    courseInfo: {
      flex: 1,
    },
    courseTitle: {
      fontWeight: 'bold',
      color: colors.black,
      fontSize: '14px',
      marginBottom: '4px',
    },
    courseDescription: {
      fontSize: '12px',
      color: colors.olive,
      lineHeight: '1.4',
    },
    selectedCoursesInfo: {
      marginTop: '12px',
      padding: '12px',
      backgroundColor: '#EEF2FF',
      borderRadius: '6px',
      border: '1px solid #4F46E5',
    },
    noCourses: {
      color: colors.olive,
      fontStyle: 'italic',
      textAlign: 'center',
      padding: '20px',
    },
    errorMessage: {
      backgroundColor: '#f8d7da',
      color: '#721c24',
      padding: '12px',
      borderRadius: '6px',
      border: '1px solid #f5c6cb',
    },
    modalActions: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
      paddingTop: '16px',
      borderTop: '1px solid #e9ecef',
    },
    cancelButton: {
      padding: '10px 20px',
      backgroundColor: '#6c757d',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'background-color 0.2s ease',
    },
    submitButton: {
      padding: '10px 20px',
      backgroundColor: colors.darkGreen,
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'background-color 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    },
    enrollmentsList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    enrollmentCard: {
      border: '1px solid #e9ecef',
      borderRadius: '8px',
      padding: '16px',
      backgroundColor: '#f8f9fa',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    enrollmentInfo: {
      flex: 1,
    },
    enrollmentDetails: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      marginTop: '8px',
      marginBottom: '8px',
    },
    enrollmentBadge: {
      backgroundColor: colors.lightGreen,
      color: 'white',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 'bold',
    },
    enrollmentDetail: {
      fontSize: '12px',
      color: colors.olive,
    },
    progressBar: {
      marginTop: '8px',
    },
    progressLabel: {
      fontSize: '12px',
      color: colors.olive,
      marginBottom: '4px',
    },
    progressTrack: {
      width: '100%',
      height: '8px',
      backgroundColor: '#e9ecef',
      borderRadius: '4px',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.darkGreen,
      transition: 'width 0.3s ease',
    },
    enrollmentActions: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      marginLeft: '16px',
    },
    withdrawButton: {
      padding: '6px 12px',
      backgroundColor: colors.red,
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      transition: 'background-color 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    },
    loadingContainer: {
      padding: '20px',
      textAlign: 'center',
      color: colors.olive,
    },
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
                <label style={styles.filterLabel}>Batch</label>
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

      {/* Student Content */}
      {activeTab === 'students' && (
        <div>
          <div style={styles.sectionTitle}>
            Students
            {filteredStudents.length !== students.length && (
              <span style={{...styles.count, backgroundColor: colors.olive}}>
                {filteredStudents.length} of {students.length}
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
                        <span style={styles.infoLabel}>Batch:</span>
                        <span style={styles.infoValue}>
                          {student.batch_identifiers || student.batch_identifier || student.batch_year || 'N/A'}
                        </span>
                      </div>
                      
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Registered:</span>
                        <span style={styles.infoValue}>
                          {formatDate(student.registration_date)}
                        </span>
                      </div>
                    </div>

                    <div style={styles.buttonContainer}>
                      <button
                        style={styles.viewMoreButton}
                        onClick={() => openModal(student, 'student')}
                        onMouseOver={(e) => e.target.style.backgroundColor = colors.darkGreen}
                        onMouseOut={(e) => e.target.style.backgroundColor = colors.lightGreen}
                      >
                        View More
                      </button>
                      
                      <button
                        style={styles.manageCourseButton}
                        onClick={() => handleCourseManagement(student.student_id)}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#5a6b4d'}
                        onMouseOut={(e) => e.target.style.backgroundColor = colors.olive}
                      >
                        <Edit3 size={12} />
                        Manage
                      </button>
                      
                      <button
                        style={styles.applyCourseButton}
                        onClick={() => handleCourseApplication(student.student_id)}
                        onMouseOver={(e) => e.target.style.backgroundColor = colors.red}
                        onMouseOut={(e) => e.target.style.backgroundColor = colors.coral}
                      >
                        <Plus size={12} />
                        Add
                      </button>
                    </div>
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

      {/* Original Modal for viewing detailed info */}
      {modalData && modalType !== 'course-application' && modalType !== 'course-management' && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div onClick={(e) => e.stopPropagation()}>
            {renderModalContent()}
          </div>
        </div>
      )}

      {/* Course Application Modal (for adding new courses) */}
      {showCourseApplication && renderCourseApplicationModal()}

      {/* Course Management Modal (for viewing and editing existing enrollments) */}
      {showCourseManagement && renderCourseManagementModal()}
    </div>
  );
};

export default DisplayAccount;