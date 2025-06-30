import { useState, useEffect, useMemo } from 'react';
import { 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Users, 
  RefreshCw, 
  User,
  BookOpen,
  CheckSquare,
  Square,
  Edit3,
  Save,
  X,
  UserCheck,
  Calendar
} from 'lucide-react';

const Batch = () => {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseOfferings, setCourseOfferings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('byBatch'); // 'byBatch', 'byCourse', 'allStudents'
  
  // Selection states
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Batch reassignment states
  const [showBatchReassignment, setShowBatchReassignment] = useState(false);
  const [newBatchId, setNewBatchId] = useState('');
  const [reassignmentLoading, setReassignmentLoading] = useState(false);
  const [reassignmentError, setReassignmentError] = useState('');
  
  // Filter states
  const [filters, setFilters] = useState({
    name: '',
    course: '',
    batch: '',
    status: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState(new Set());

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
    initializeData();
  }, []);

  // Clear batch selection when selected students change
  useEffect(() => {
    if (showBatchReassignment) {
      setNewBatchId('');
      setReassignmentError('');
    }
  }, [selectedStudents, showBatchReassignment]);

  const initializeData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStudents(),
        fetchCourses(),
        fetchCourseOfferings()
      ]);
    } catch (error) {
      console.error('Error initializing data:', error);
      setError('Failed to initialize data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

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
      
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (parseError) {
        console.warn('Could not parse error response:', parseError);
      }

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (response.status === 403) {
        throw new Error('Access denied. Insufficient permissions.');
      } else {
        throw new Error(errorMessage);
      }
    }

    return response.json();
  };

  const fetchStudents = async () => {
    try {
      const studentsData = await makeAuthenticatedRequest('http://localhost:3000/api/students');
      setStudents(studentsData || []);
      console.log('Fetched students:', studentsData);
    } catch (err) {
      console.error('Failed to fetch students:', err.message);
      setError('Failed to fetch students: ' + err.message);
    }
  };

  const fetchCourses = async () => {
    try {
      const coursesData = await makeAuthenticatedRequest('http://localhost:3000/api/courses');
      setCourses(coursesData || []);
      console.log('Fetched courses:', coursesData);
    } catch (err) {
      console.error('Failed to fetch courses:', err.message);
    }
  };

  const fetchCourseOfferings = async () => {
    try {
      const offeringsData = await makeAuthenticatedRequest('http://localhost:3000/api/course-offerings');
      setCourseOfferings(offeringsData || []);
      console.log('Fetched course offerings:', offeringsData);
    } catch (err) {
      console.error('Failed to fetch course offerings:', err.message);
    }
  };

  // Get unique batches from students and course offerings
  const uniqueBatches = useMemo(() => {
    const studentBatchIdentifiers = students
      .map(student => student.batch_identifiers)
      .filter(Boolean)
      .flatMap(batchStr => batchStr.split(',').map(b => b.trim()))
      .filter(Boolean);
    
    const courseOfferingBatches = courseOfferings
      .map(offering => offering.batch_identifier)
      .filter(Boolean);
    
    const studentBatchYears = students
      .map(student => student.batch_year)
      .filter(Boolean)
      .map(year => year.toString());
    
    const allBatches = [...studentBatchIdentifiers, ...courseOfferingBatches, ...studentBatchYears];
    return [...new Set(allBatches)].sort();
  }, [students, courseOfferings]);

  // Get courses for selected students
  const getCoursesForSelectedStudents = useMemo(() => {
    const selectedStudentData = students.filter(student => 
      selectedStudents.has(student.student_id)
    );
    
    const courseIds = new Set();
    const courseCodes = new Set();
    
    selectedStudentData.forEach(student => {
      // Handle enrolled_courses (comma-separated string)
      if (student.enrolled_courses) {
        const enrolledCourses = student.enrolled_courses.split(',').map(c => c.trim());
        enrolledCourses.forEach(courseStr => {
          // Extract course code from strings like "BA001 - Business Analytics"
          const courseCode = courseStr.split(' - ')[0].trim();
          courseCodes.add(courseCode);
          
          // Also try to find the full course by name match
          const matchingCourse = courses.find(c => 
            courseStr.toLowerCase().includes(c.course_name.toLowerCase()) ||
            courseStr.toLowerCase().includes(c.course_code.toLowerCase())
          );
          if (matchingCourse) {
            courseIds.add(matchingCourse.course_id);
            courseCodes.add(matchingCourse.course_code);
          }
        });
      }
      
      // Handle direct course_id
      if (student.course_id) {
        courseIds.add(parseInt(student.course_id));
      }
      
      // Handle course_code
      if (student.course_code) {
        courseCodes.add(student.course_code);
        // Also find the course_id for this code
        const matchingCourse = courses.find(c => c.course_code === student.course_code);
        if (matchingCourse) {
          courseIds.add(matchingCourse.course_id);
        }
      }
    });
    
    return { courseIds, courseCodes };
  }, [students, selectedStudents, courses]);

  // Get filtered batches based on selected students' courses
  const availableBatchesForSelectedStudents = useMemo(() => {
    if (selectedStudents.size === 0) {
      return [];
    }
    
    const { courseIds, courseCodes } = getCoursesForSelectedStudents;
    
    // If no courses identified, return empty array
    if (courseIds.size === 0 && courseCodes.size === 0) {
      return [];
    }
    
    // Filter course offerings to only include relevant courses
    const relevantOfferings = courseOfferings.filter(offering => {
      // Find the course for this offering
      const course = courses.find(c => c.course_id === offering.course_id);
      if (!course) return false;
      
      // Check if this course is in the selected students' courses
      return courseIds.has(course.course_id) || courseCodes.has(course.course_code);
    });
    
    // Extract unique batch identifiers
    const batchIdentifiers = relevantOfferings
      .map(offering => offering.batch_identifier)
      .filter(Boolean);
      
    return [...new Set(batchIdentifiers)].sort();
  }, [selectedStudents, courseOfferings, courses, getCoursesForSelectedStudents]);

  // Get unique courses
  const uniqueCourses = useMemo(() => {
    return courses.map(course => ({
      id: course.course_id,
      code: course.course_code,
      name: course.course_name,
      display: `${course.course_code} - ${course.course_name}`
    })).sort((a, b) => a.display.localeCompare(b.display));
  }, [courses]);

  // Filter students based on current filters
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const fullName = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
      const matchesName = !filters.name || fullName.includes(filters.name.toLowerCase());
      
      const matchesCourse = !filters.course || (() => {
        if (student.enrolled_courses) {
          return student.enrolled_courses.toLowerCase().includes(filters.course.toLowerCase());
        }
        if (student.course_id) {
          return student.course_id.toString() === filters.course;
        }
        if (student.course_code) {
          return student.course_code.toLowerCase().includes(filters.course.toLowerCase());
        }
        return false;
      })();
      
      const matchesBatch = !filters.batch || (() => {
        if (student.batch_identifiers) {
          const studentBatches = student.batch_identifiers.split(',').map(b => b.trim());
          return studentBatches.includes(filters.batch);
        }
        if (student.batch_identifier && student.batch_identifier === filters.batch) {
          return true;
        }
        if (student.batch_year && student.batch_year.toString() === filters.batch) {
          return true;
        }
        return false;
      })();
      
      const matchesStatus = !filters.status || 
        (student.graduation_status && student.graduation_status.toLowerCase() === filters.status.toLowerCase());

      return matchesName && matchesCourse && matchesBatch && matchesStatus;
    });
  }, [students, filters]);

  // Group students by batch
  const studentsByBatch = useMemo(() => {
    const grouped = {};
    
    filteredStudents.forEach(student => {
      let studentBatches = [];
      
      if (student.batch_identifiers) {
        studentBatches = student.batch_identifiers.split(',').map(b => b.trim());
      } else if (student.batch_identifier) {
        studentBatches = [student.batch_identifier];
      } else if (student.batch_year) {
        studentBatches = [student.batch_year.toString()];
      } else {
        studentBatches = ['Unassigned'];
      }
      
      studentBatches.forEach(batch => {
        if (!grouped[batch]) {
          grouped[batch] = [];
        }
        grouped[batch].push(student);
      });
    });
    
    return grouped;
  }, [filteredStudents]);

  // Group students by course
  const studentsByCourse = useMemo(() => {
    const grouped = {};
    
    filteredStudents.forEach(student => {
      let courseName = 'Unassigned';
      
      if (student.enrolled_courses) {
        courseName = student.enrolled_courses;
      } else if (student.course_code) {
        const course = courses.find(c => c.course_code === student.course_code);
        courseName = course ? `${course.course_code} - ${course.course_name}` : student.course_code;
      } else if (student.course_id) {
        const course = courses.find(c => c.course_id === parseInt(student.course_id));
        courseName = course ? `${course.course_code} - ${course.course_name}` : `Course ID: ${student.course_id}`;
      }
      
      if (!grouped[courseName]) {
        grouped[courseName] = [];
      }
      grouped[courseName].push(student);
    });
    
    return grouped;
  }, [filteredStudents, courses]);

  // Handle filter changes
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
      status: ''
    });
  };

  // Handle student selection
  const handleStudentSelect = (studentId) => {
    setSelectedStudents(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(studentId)) {
        newSelected.delete(studentId);
      } else {
        newSelected.add(studentId);
      }
      return newSelected;
    });
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedStudents(new Set());
    } else {
      const allStudentIds = filteredStudents.map(s => s.student_id);
      setSelectedStudents(new Set(allStudentIds));
    }
    setSelectAll(!selectAll);
  };

  // Handle section expansion
  const toggleSection = (sectionName) => {
    setExpandedSections(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(sectionName)) {
        newExpanded.delete(sectionName);
      } else {
        newExpanded.add(sectionName);
      }
      return newExpanded;
    });
  };

  // Handle batch reassignment
  const handleBatchReassignment = async () => {
    if (selectedStudents.size === 0) {
      setReassignmentError('Please select at least one student.');
      return;
    }

    if (availableBatchesForSelectedStudents.length === 0) {
      setReassignmentError('No available batches found for the selected students\' enrolled courses.');
      return;
    }

    if (!newBatchId) {
      setReassignmentError('Please select a new batch.');
      return;
    }

    setReassignmentLoading(true);
    setReassignmentError('');

    try {
      const studentIds = Array.from(selectedStudents);
      
      // Call API to update batch assignments
      const response = await makeAuthenticatedRequest(
        'http://localhost:3000/api/students/batch-reassign',
        {
          method: 'PUT',
          body: JSON.stringify({
            student_ids: studentIds,
            new_batch_identifier: newBatchId
          })
        }
      );

      // Refresh students data
      await fetchStudents();
      
      // Clear selections and close modal
      setSelectedStudents(new Set());
      setSelectAll(false);
      setShowBatchReassignment(false);
      setNewBatchId('');
      
      alert(`Successfully reassigned ${studentIds.length} student(s) to batch ${newBatchId}`);
      
    } catch (error) {
      console.error('Failed to reassign batch:', error);
      setReassignmentError('Failed to reassign batch: ' + error.message);
    } finally {
      setReassignmentLoading(false);
    }
  };

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  // Get status badge helper
  const getStatusBadge = (status) => {
    const badgeColors = {
      active: '#28a745',
      inactive: '#6c757d',
      suspended: '#dc3545',
      enrolled: '#007bff',
      graduated: '#28a745',
      dropped: '#dc3545',
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

  // Get student courses display
  const getStudentCoursesDisplay = (student) => {
    if (student.enrolled_courses && typeof student.enrolled_courses === 'string') {
      const courseStrings = student.enrolled_courses.split(',').map(c => c.trim());
      if (courseStrings.length === 1) {
        return courseStrings[0];
      } else {
        return `${courseStrings.length} courses: ${courseStrings.slice(0, 2).join(', ')}${courseStrings.length > 2 ? '...' : ''}`;
      }
    }
    
    if (student.course_id) {
      const course = courses.find(c => c.course_id === parseInt(student.course_id));
      return course ? `${course.course_code} - ${course.course_name}` : `Course ID: ${student.course_id}`;
    }
    
    return 'No active enrollments';
  };

  // Render student card
  const renderStudentCard = (student) => {
    const isSelected = selectedStudents.has(student.student_id);
    
    return (
      <div
        key={student.student_id}
        style={{
          ...styles.studentCard,
          ...(isSelected ? styles.selectedCard : {})
        }}
      >
        <div style={styles.cardHeader}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => handleStudentSelect(student.student_id)}
            style={styles.checkbox}
          />
          <div style={styles.studentInfo}>
            <h4 style={styles.studentName}>
              {student.first_name} {student.last_name}
            </h4>
            <p style={styles.studentId}>ID: {student.student_id}</p>
          </div>
        </div>
        
        <div style={styles.studentDetails}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Status:</span>
            <span style={getStatusBadge(student.graduation_status)}>
              {student.graduation_status || 'N/A'}
            </span>
          </div>
          
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Courses:</span>
            <span style={styles.detailValue}>
              {getStudentCoursesDisplay(student)}
            </span>
          </div>
          
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Batch:</span>
            <span style={styles.detailValue}>
              {student.batch_identifiers || student.batch_identifier || student.batch_year || 'N/A'}
            </span>
          </div>
          
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Email:</span>
            <span style={styles.detailValue}>
              {student.email || 'N/A'}
            </span>
          </div>
          
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Registered:</span>
            <span style={styles.detailValue}>
              {formatDate(student.registration_date)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Render batch reassignment modal
  const renderBatchReassignmentModal = () => {
    if (!showBatchReassignment) return null;

    return (
      <div style={styles.modalOverlay} onClick={() => setShowBatchReassignment(false)}>
        <div onClick={(e) => e.stopPropagation()} style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h3 style={styles.modalTitle}>
              <Edit3 size={20} style={{ marginRight: '8px' }} />
              Batch Reassignment
            </h3>
            <button style={styles.closeButton} onClick={() => setShowBatchReassignment(false)}>
              ×
            </button>
          </div>
          
          <div style={styles.modalBody}>
            <div style={styles.reassignmentContainer}>
              <div style={styles.selectionInfo}>
                <p><strong>Selected Students:</strong> {selectedStudents.size}</p>
                <p style={{ fontSize: '14px', color: colors.olive, marginTop: '8px' }}>
                  You are about to reassign {selectedStudents.size} student(s) to a new batch.
                </p>
                {selectedStudents.size > 0 && availableBatchesForSelectedStudents.length === 0 && (
                  <p style={{ fontSize: '14px', color: colors.coral, marginTop: '8px', fontWeight: 'bold' }}>
                    No available batches found for the selected students' enrolled courses.
                  </p>
                )}
              </div>

              <div style={styles.batchSelection}>
                <label style={styles.formLabel}>Select New Batch:</label>
                <select
                  value={newBatchId}
                  onChange={(e) => setNewBatchId(e.target.value)}
                  style={styles.formSelect}
                  disabled={availableBatchesForSelectedStudents.length === 0}
                >
                  <option value="">
                    {availableBatchesForSelectedStudents.length === 0 
                      ? 'No batches available for selected students\' courses'
                      : 'Select a batch...'
                    }
                  </option>
                  {availableBatchesForSelectedStudents.map(batch => (
                    <option key={batch} value={batch}>{batch}</option>
                  ))}
                </select>
                {selectedStudents.size > 0 && availableBatchesForSelectedStudents.length > 0 && (
                  <p style={{ fontSize: '12px', color: colors.olive, marginTop: '4px' }}>
                    Showing {availableBatchesForSelectedStudents.length} batch(es) for the selected students' enrolled courses.
                  </p>
                )}
              </div>

              {reassignmentError && (
                <div style={styles.errorMessage}>
                  {reassignmentError}
                </div>
              )}

              <div style={styles.modalActions}>
                <button
                  style={styles.cancelButton}
                  onClick={() => setShowBatchReassignment(false)}
                  disabled={reassignmentLoading}
                >
                  Cancel
                </button>
                <button
                  style={{
                    ...styles.submitButton,
                    opacity: (!newBatchId || reassignmentLoading || availableBatchesForSelectedStudents.length === 0) ? 0.6 : 1
                  }}
                  onClick={handleBatchReassignment}
                  disabled={!newBatchId || reassignmentLoading || availableBatchesForSelectedStudents.length === 0}
                >
                  {reassignmentLoading ? 'Processing...' : 'Reassign Batch'}
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
    viewToggle: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      marginBottom: '24px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden'
    },
    viewHeader: {
      display: 'flex',
      backgroundColor: colors.lightGreen,
    },
    viewTab: {
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
    activeViewTab: {
      backgroundColor: colors.darkGreen,
      color: '#ffffff',
    },
    inactiveViewTab: {
      backgroundColor: colors.lightGreen,
      color: '#ffffff',
      opacity: 0.8
    },
    selectionControls: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '16px 24px',
      marginBottom: '24px',
      border: '1px solid #e2e8f0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '12px'
    },
    selectionInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px'
    },
    selectAllButton: {
      padding: '8px 16px',
      backgroundColor: colors.olive,
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    bulkActionButton: {
      padding: '8px 16px',
      backgroundColor: colors.coral,
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      opacity: selectedStudents.size === 0 ? 0.6 : 1
    },
    contentSection: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
      border: '1px solid #e2e8f0'
    },
    sectionHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      marginBottom: '16px',
      cursor: 'pointer',
      transition: 'background-color 0.2s'
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: colors.darkGreen,
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    sectionCount: {
      backgroundColor: colors.lightGreen,
      color: 'white',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '500'
    },
    studentsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
      gap: '16px',
      marginTop: '16px'
    },
    studentCard: {
      backgroundColor: '#f8f9fa',
      border: '2px solid #dee2e6',
      borderRadius: '8px',
      padding: '16px',
      transition: 'all 0.2s ease'
    },
    selectedCard: {
      border: '2px solid #4F46E5',
      backgroundColor: '#EEF2FF'
    },
    cardHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      marginBottom: '12px'
    },
    checkbox: {
      marginTop: '4px',
      transform: 'scale(1.2)'
    },
    studentInfo: {
      flex: 1
    },
    studentName: {
      fontSize: '16px',
      fontWeight: 'bold',
      color: colors.darkGreen,
      margin: '0 0 4px 0'
    },
    studentId: {
      fontSize: '12px',
      color: colors.olive,
      margin: 0,
      fontFamily: 'monospace'
    },
    studentDetails: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    detailRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    detailLabel: {
      fontWeight: 'bold',
      color: colors.black,
      fontSize: '12px'
    },
    detailValue: {
      color: colors.olive,
      fontSize: '12px',
      textAlign: 'right',
      maxWidth: '60%',
      wordBreak: 'break-word'
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: colors.olive,
      fontSize: '16px'
    },
    loading: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '400px',
      fontSize: '18px',
      color: colors.olive
    },
    error: {
      backgroundColor: '#f8d7da',
      color: '#721c24',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #f5c6cb',
      marginBottom: '24px'
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
      maxWidth: '600px',
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
    reassignmentContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    },
    batchSelection: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    formLabel: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#4a5568',
    },
    formSelect: {
      padding: '12px 16px',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      fontSize: '14px',
      outline: 'none',
      backgroundColor: 'white',
      cursor: 'pointer',
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
    },
  };

  const hasActiveFilters = Object.values(filters).some(filter => filter !== '');

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Batch Management</h1>
          <p style={styles.subtitle}>Loading student batch data...</p>
        </div>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Batch Management</h1>
          <p style={styles.subtitle}>Error loading data</p>
        </div>
        <div style={styles.error}>
          {error}
          <button 
            style={styles.refreshButton}
            onClick={initializeData}
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
        <h1 style={styles.title}>Batch Management</h1>
        <p style={styles.subtitle}>Organize and manage students by batches and courses</p>
      </div>
      
      {/* Filter Section */}
      <div style={styles.filterSection}>
        <div style={styles.filterTitle}>
          <Filter size={20} />
          Filter Students
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
        </div>
        
        {hasActiveFilters && (
          <div style={styles.filterActions}>
            <button
              style={styles.clearButton}
              onClick={clearFilters}
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* View Toggle */}
      <div style={styles.viewToggle}>
        <div style={styles.viewHeader}>
          <button
            style={{
              ...styles.viewTab,
              ...(activeView === 'byBatch' ? styles.activeViewTab : styles.inactiveViewTab)
            }}
            onClick={() => setActiveView('byBatch')}
          >
            <Calendar size={20} />
            By Batch
          </button>
          
          <button
            style={{
              ...styles.viewTab,
              ...(activeView === 'allStudents' ? styles.activeViewTab : styles.inactiveViewTab)
            }}
            onClick={() => setActiveView('allStudents')}
          >
            <Users size={20} />
            All Students ({filteredStudents.length})
          </button>
        </div>
      </div>

      {/* Selection Controls */}
      <div style={styles.selectionControls}>
        <div style={styles.selectionInfo}>
          <button
            style={styles.selectAllButton}
            onClick={handleSelectAll}
          >
            {selectAll ? <CheckSquare size={16} /> : <Square size={16} />}
            {selectAll ? 'Deselect All' : 'Select All'}
          </button>
          <span>
            {selectedStudents.size} of {filteredStudents.length} students selected
          </span>
        </div>
        
        <button
          style={styles.bulkActionButton}
          onClick={() => {
            setShowBatchReassignment(true);
            setNewBatchId(''); // Clear previous selection when opening modal
            setReassignmentError(''); // Clear any previous errors
          }}
          disabled={selectedStudents.size === 0}
        >
          <Edit3 size={16} />
          Reassign Batch ({selectedStudents.size})
        </button>
      </div>

      {/* Content based on active view */}
      {activeView === 'byBatch' && (
        <div>
          {Object.keys(studentsByBatch).length === 0 ? (
            <div style={styles.emptyState}>
              No students found matching the current filters.
            </div>
          ) : (
            Object.entries(studentsByBatch)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([batchName, batchStudents]) => {
                const isExpanded = expandedSections.has(`batch-${batchName}`);
                
                return (
                  <div key={batchName} style={styles.contentSection}>
                    <div 
                      style={styles.sectionHeader}
                      onClick={() => toggleSection(`batch-${batchName}`)}
                    >
                      <div style={styles.sectionTitle}>
                        <Calendar size={20} />
                        Batch: {batchName}
                        <span style={styles.sectionCount}>
                          {batchStudents.length} students
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    
                    {isExpanded && (
                      <div style={styles.studentsGrid}>
                        {batchStudents.map(student => renderStudentCard(student))}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      )}

      {activeView === 'allStudents' && (
        <div style={styles.contentSection}>
          <div style={styles.sectionTitle}>
            <Users size={20} />
            All Students
            <span style={styles.sectionCount}>
              {filteredStudents.length} students
            </span>
          </div>
          
          {filteredStudents.length === 0 ? (
            <div style={styles.emptyState}>
              No students found matching the current filters.
            </div>
          ) : (
            <div style={styles.studentsGrid}>
              {filteredStudents.map(student => renderStudentCard(student))}
            </div>
          )}
        </div>
      )}

      {/* Batch Reassignment Modal */}
      {renderBatchReassignmentModal()}
    </div>
  );
};

export default Batch;