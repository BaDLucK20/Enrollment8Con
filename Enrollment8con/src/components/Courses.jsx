import { useState, useEffect, useCallback } from 'react';

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // list, add, edit, details, competency-manage, students
  const [courseOfferings, setCourseOfferings] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [allCompetencies, setAllCompetencies] = useState([]);
  const [courseCompetencies, setCourseCompetencies] = useState([]);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [studentProgress, setStudentProgress] = useState({});
  const [selectedOffering, setSelectedOffering] = useState(null);
  const [selectedCompetency, setSelectedCompetency] = useState(null);
  const [competencyStudents, setCompetencyStudents] = useState([]);
  const [courseEnrollmentStats, setCourseEnrollmentStats] = useState({});
  const [editingCompetency, setEditingCompetency] = useState(null);
  const [showAddCompetency, setShowAddCompetency] = useState(false);
  const [courseCodeExists, setCourseCodeExists] = useState(false);
  const [showAssignCompetencies, setShowAssignCompetencies] = useState(false);

  // Form data for add/edit course
  const [formData, setFormData] = useState({
    course_code: '',
    course_name: '',
    course_description: '',
    duration_weeks: '',
    credits: '',
    competencies: [],
    pricing: {
      regular: '',
    }
  });

  // Form data for competency
  const [competencyFormData, setCompetencyFormData] = useState({
    competency_code: '',
    competency_name: '',
    competency_description: '',
    competency_type_id: '',
    weight: '1.00',
    passing_score: '70.00'
  });

  // Modern color scheme (same as AddDocument)
  const colors = {
    primary: '#4F46E5',
    primaryDark: '#4338CA',
    primaryLight: '#6366F1',
    secondary: '#10B981',
    secondaryDark: '#059669',
    warning: '#F59E0B',
    danger: '#EF4444',
    success: '#22C55E',
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
    }
  };

  // Icon components
  const BookIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );

  const UsersIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );

  const ChartIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );

  const PlusIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );

  const EditIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );

  const TrashIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );

  const EyeIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );

  const ClockIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const CurrencyIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const CheckIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );

  const XIcon = ({ size = 12 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  const BackIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );

  const LoadingSpinner = ({ size = 20 }) => (
    <svg width={size} height={size} className="spinner" viewBox="0 0 24 24">
      <circle className="spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  const AcademicIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14v7" />
    </svg>
  );

  const LinkIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );

  // Styles
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: colors.gray[50],
      padding: '32px 16px',
    },
    maxWidth: {
      maxWidth: '1200px',
      margin: '0 auto',
    },
    card: {
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      padding: '24px',
      marginBottom: '24px',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px',
    },
    title: {
      fontSize: '30px',
      fontWeight: 'bold',
      color: colors.gray[900],
    },
    subtitle: {
      color: colors.gray[600],
      fontSize: '16px',
      marginTop: '8px',
    },
    alert: {
      marginBottom: '24px',
      padding: '16px',
      borderRadius: '8px',
      borderLeftWidth: '4px',
      borderLeftStyle: 'solid',
      display: 'flex',
      alignItems: 'center',
    },
    alertError: {
      backgroundColor: '#FEE2E2',
      borderLeftColor: colors.danger,
      color: '#991B1B',
    },
    alertSuccess: {
      backgroundColor: '#D1FAE5',
      borderLeftColor: colors.success,
      color: '#065F46',
    },
    button: {
      padding: '10px 16px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.15s ease-in-out',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
    },
    primaryButton: {
      backgroundColor: colors.primary,
      color: '#fff',
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      color: colors.primary,
      border: `1px solid ${colors.primary}`,
    },
    dangerButton: {
      backgroundColor: 'transparent',
      color: colors.danger,
      border: `1px solid ${colors.danger}`,
    },
    successButton: {
      backgroundColor: colors.success,
      color: '#fff',
    },
    courseGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
      gap: '24px',
    },
    courseCard: {
      backgroundColor: '#fff',
      borderRadius: '8px',
      border: `1px solid ${colors.gray[200]}`,
      padding: '20px',
      transition: 'all 0.2s ease-in-out',
      cursor: 'pointer',
    },
    courseCardHover: {
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      transform: 'translateY(-2px)',
    },
    courseTitle: {
      fontSize: '20px',
      fontWeight: '600',
      color: colors.gray[900],
      marginBottom: '8px',
    },
    courseCode: {
      fontSize: '14px',
      color: colors.gray[500],
      marginBottom: '12px',
    },
    courseStats: {
      display: 'flex',
      gap: '16px',
      marginTop: '16px',
      paddingTop: '16px',
      borderTop: `1px solid ${colors.gray[200]}`,
    },
    statItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      color: colors.gray[600],
    },
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      color: colors.gray[700],
      marginBottom: '8px',
    },
    input: {
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${colors.gray[300]}`,
      borderRadius: '6px',
      fontSize: '16px',
      outline: 'none',
      transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
    },
    textarea: {
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${colors.gray[300]}`,
      borderRadius: '6px',
      fontSize: '16px',
      minHeight: '100px',
      resize: 'vertical',
      outline: 'none',
    },
    formGroup: {
      marginBottom: '20px',
    },
    formRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
    },
    required: {
      color: colors.danger,
      marginLeft: '4px',
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: colors.gray[900],
      marginBottom: '16px',
      marginTop: '24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
    },
    th: {
      textAlign: 'left',
      padding: '12px',
      borderBottom: `2px solid ${colors.gray[200]}`,
      fontSize: '14px',
      fontWeight: '600',
      color: colors.gray[700],
    },
    td: {
      padding: '12px',
      borderBottom: `1px solid ${colors.gray[100]}`,
      fontSize: '14px',
      color: colors.gray[900],
    },
    progressBar: {
      width: '100%',
      height: '8px',
      backgroundColor: colors.gray[200],
      borderRadius: '4px',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.success,
      transition: 'width 0.3s ease-in-out',
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 12px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: '500',
    },
    competencyCard: {
      border: `1px solid ${colors.gray[200]}`,
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
    },
    studentList: {
      maxHeight: '400px',
      overflowY: 'auto',
    },
    backButton: {
      padding: '8px 12px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      backgroundColor: colors.gray[100],
      color: colors.gray[700],
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '20px',
    },
    enrollmentBadge: {
      backgroundColor: colors.primaryLight + '20',
      color: colors.primaryLight,
      padding: '6px 12px',
      borderRadius: '9999px',
      fontSize: '14px',
      fontWeight: '600',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    modalContent: {
      backgroundColor: '#fff',
      borderRadius: '8px',
      padding: '24px',
      maxWidth: '600px',
      width: '90%',
      maxHeight: '90vh',
      overflowY: 'auto',
    },
  };

  // Clear success and error messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Fetch courses with enrollment stats
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/courses', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch courses');

      const data = await response.json();
      setCourses(data);

      // Fetch enrollment stats for each course
      for (const course of data) {
        fetchCourseEnrollmentStats(course.course_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch enrollment statistics for a course
  const fetchCourseEnrollmentStats = useCallback(async (courseId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/courses/${courseId}/students`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;

      const students = await response.json();
      setCourseEnrollmentStats(prev => ({
        ...prev,
        [courseId]: students.length
      }));
    } catch (err) {
      console.error('Error fetching enrollment stats:', err);
    }
  }, []);

  // NEW: Fetch all students enrolled in a specific course
  const fetchCourseStudents = useCallback(async (courseId) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/courses/${courseId}/students`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch course students');

      const students = await response.json();
      setEnrolledStudents(students);
      
      console.log('Fetched students for course:', courseId, students);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching course students:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch course offerings for a specific course
  const fetchCourseOfferings = useCallback(async (courseId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/course-offerings', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch offerings');

      const data = await response.json();
      const courseOfferings = data.filter(offering => offering.course_id === courseId);
      setCourseOfferings(courseOfferings);
    } catch (err) {
      console.error('Error fetching offerings:', err);
    }
  }, []);

  // Fetch all competencies
  const fetchAllCompetencies = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/competencies', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch competencies');

      const data = await response.json();
      setAllCompetencies(data);
    } catch (err) {
      console.error('Error fetching competencies:', err);
    }
  }, []);

  // Fetch competencies for a specific course
  const fetchCourseCompetencies = useCallback(async (courseId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/courses/${courseId}/competencies`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch course competencies');

      const data = await response.json();
      setCourseCompetencies(data);
    } catch (err) {
      console.error('Error fetching course competencies:', err);
    }
  }, []);

  // NEW: Add competency to course
  const handleAssignCompetencyToCourse = async (competencyId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/courses/${selectedCourse.course_id}/competencies`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          competency_id: competencyId,
          is_required: true,
          order_sequence: 0,
          estimated_hours: 0
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to assign competency to course');
      }

      setSuccess('Competency assigned to course successfully!');
      fetchCourseCompetencies(selectedCourse.course_id);
    } catch (err) {
      setError(`Failed to assign competency: ${err.message}`);
    }
  };

  // NEW: Remove competency from course
  const handleRemoveCompetencyFromCourse = async (competencyId) => {
    if (!window.confirm('Are you sure you want to remove this competency from the course?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/courses/${selectedCourse.course_id}/competencies/${competencyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to remove competency from course');
      }

      setSuccess('Competency removed from course successfully!');
      fetchCourseCompetencies(selectedCourse.course_id);
    } catch (err) {
      setError(`Failed to remove competency: ${err.message}`);
    }
  };

  // Fetch students enrolled in a specific competency
  const fetchCompetencyStudents = useCallback(async (courseId, competencyId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/courses/${courseId}/students?competency_id=${competencyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch students');

      const data = await response.json();
      setCompetencyStudents(data);
    } catch (err) {
      console.error('Error fetching competency students:', err);
    }
  }, []);

  // Fetch student progress
  const fetchStudentProgress = useCallback(async (studentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/students/${studentId}/progress`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch progress');

      const data = await response.json();
      setStudentProgress(prev => ({
        ...prev,
        [studentId]: data
      }));
    } catch (err) {
      console.error('Error fetching progress:', err);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
    fetchAllCompetencies();
  }, [fetchCourses, fetchAllCompetencies]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...formData, [name]: value };

    if (name === 'course_code') {
      const exists = courses.some(
        (c) => c.course_code.trim().toLowerCase() === value.trim().toLowerCase()
      );
      setCourseCodeExists(exists);
    }

    setFormData(updatedForm);
  };

  // Handle pricing input changes
  const handlePricingChange = (type, value) => {
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        [type]: value
      }
    }));
  };

  // Handle competency selection
  const handleCompetencyToggle = (competencyId) => {
    setFormData(prev => ({
      ...prev,
      competencies: prev.competencies.includes(competencyId)
        ? prev.competencies.filter(id => id !== competencyId)
        : [...prev.competencies, competencyId]
    }));
  };

  // Handle add course
  const handleAddCourse = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/courses/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to add course');

      setSuccess('Course added successfully!');
      fetchCourses();
      setViewMode('list');
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Frontend: Updated handleUpdateCourse function
  const handleUpdateCourse = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Make sure we have a course ID for updates
      if (!selectedCourse?.course_id) {
        throw new Error('No course selected for update');
      }

      const updateData = {
        course_code: formData.course_code,
        course_name: formData.course_name,
        course_description: formData.course_description,
        duration_weeks: parseInt(formData.duration_weeks),
        credits: parseFloat(formData.credits),
        competencies: formData.competencies,
        pricing: formData.pricing, // Include pricing data
        is_active: formData.is_active !== undefined ? formData.is_active : true
      };

      // Debug logging
      console.log('Update data being sent:', updateData);
      console.log('Course ID:', selectedCourse.course_id);

      const response = await fetch(`http://localhost:3000/api/courses/${selectedCourse.course_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Adjust based on your auth setup
        },
        body: JSON.stringify(updateData)
      });

      // Check if response is ok first
      if (!response.ok) {
        let errorMessage = 'Failed to update course';
        
        // Try to get error message from response
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            // If not JSON, get text response
            const errorText = await response.text();
            console.error('Non-JSON error response:', errorText);
            errorMessage = `Server error (${response.status}): ${response.statusText}`;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      // Parse successful response
      let result;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          result = await response.json();
        } else {
          throw new Error('Server did not return JSON response');
        }
      } catch (parseError) {
        console.error('Error parsing success response:', parseError);
        throw new Error('Invalid response from server');
      }
      
      // Update the courses list with the updated course
      setCourses(prevCourses => 
        prevCourses.map(course => 
          course.course_id === selectedCourse.course_id 
            ? result.course 
            : course
        )
      );

      // Reset form and switch back to list view
      resetForm();
      setViewMode('list');
      setSelectedCourse(null);
      
      // Show success message
      setSuccess('Course updated successfully!');

    } catch (error) {
      console.error('Update course error:', error);
      setError(`Error updating course: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to populate form when editing
  const handleEditCourse = (course) => {
    setSelectedCourse(course);
    setFormData({
      course_code: course.course_code || '',
      course_name: course.course_name || '',
      course_description: course.course_description || '',
      duration_weeks: course.duration_weeks || '',
      credits: course.credits || '',
      competencies: course.competencies || [], // Assume this comes from API
      pricing: course.pricing || {
        regular_price: '',
      },
      is_active: course.is_active !== undefined ? course.is_active : true
    });
    setViewMode('edit'); // or 'add' if you're using the same mode
  };

  // Handle add competency - UPDATED to refresh course competencies
  const handleAddCompetency = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/competencies', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(competencyFormData)
      });

      if (!response.ok) throw new Error('Failed to add competency');

      const newCompetency = await response.json();
      
      setSuccess('Competency added successfully!');
      setShowAddCompetency(false);
      resetCompetencyForm();
      
      // Refresh all competencies
      fetchAllCompetencies();
      
      // If we're viewing a course and want to auto-assign the new competency
      if (selectedCourse && viewMode === 'details') {
        // Optionally auto-assign the new competency to the current course
        try {
          await handleAssignCompetencyToCourse(newCompetency.competency_id);
        } catch (assignError) {
          console.log('Note: New competency created but not auto-assigned to course');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle update competency
  const handleUpdateCompetency = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/competencies/${editingCompetency.competency_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(competencyFormData)
      });

      if (!response.ok) throw new Error('Failed to update competency');

      setSuccess('Competency updated successfully!');
      setEditingCompetency(null);
      resetCompetencyForm();
      fetchAllCompetencies();
      if (selectedCourse) {
        fetchCourseCompetencies(selectedCourse.course_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle delete competency
  const handleDeleteCompetency = async (competencyId) => {
    if (!window.confirm('Are you sure you want to delete this competency?')) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/competencies/${competencyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to delete competency');

      setSuccess('Competency deleted successfully!');
      fetchAllCompetencies();
      if (selectedCourse) {
        fetchCourseCompetencies(selectedCourse.course_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      course_code: '',
      course_name: '',
      course_description: '',
      duration_weeks: '',
      credits: '',
      competencies: [],
      pricing: {
        regular: '',
      }
    });
    setSelectedCourse(null);
  };

  // Reset competency form
  const resetCompetencyForm = () => {
    setCompetencyFormData({
      competency_code: '',
      competency_name: '',
      competency_description: '',
      competency_type_id: '',
      weight: '1.00',
      passing_score: '70.00'
    });
  };

  // Handle view details
  const handleViewDetails = (course) => {
    setSelectedCourse(course);
    setViewMode('details');
    fetchCourseOfferings(course.course_id);
    fetchCourseCompetencies(course.course_id);
  };

  // NEW: Handle view students
  const handleViewStudents = (course) => {
    setSelectedCourse(course);
    setViewMode('students');
    fetchCourseStudents(course.course_id);
  };

  // Handle competency click
  const handleCompetencyClick = (competency) => {
    setSelectedCompetency(competency);
    fetchCompetencyStudents(selectedCourse.course_id, competency.competency_id);
  };

  // Calculate student progress percentage
  const calculateProgressPercentage = (studentId, competencyId) => {
    const progress = studentProgress[studentId];
    if (!progress) return 0;

    const competencyProgress = progress.find(p => p.competency_id === competencyId);
    return competencyProgress?.percentage_score || 0;
  };

  // Count students in competency
  const countStudentsInCompetency = (competencyId) => {
    return competencyStudents.filter(student => {
      const progress = student.competency_progress;
      return progress && progress.competency_id === competencyId;
    }).length;
  };

  // NEW: Get unassigned competencies for current course
  const getUnassignedCompetencies = () => {
    const assignedIds = courseCompetencies.map(cc => cc.competency_id);
    return allCompetencies.filter(comp => !assignedIds.includes(comp.competency_id));
  };

  // NEW: Render course students view
  const renderCourseStudents = () => (
    <div>
      <button
        style={styles.backButton}
        onClick={() => {
          setViewMode('list');
          setSelectedCourse(null);
          setEnrolledStudents([]);
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.gray[200]}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.gray[100]}
      >
        <BackIcon />
        Back to Courses
      </button>

      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Students in {selectedCourse?.course_name}</h1>
            <p style={styles.courseCode}>Code: {selectedCourse?.course_code}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={() => handleViewDetails(selectedCourse)}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.gray[50]}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <EyeIcon />
              Course Details
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <span style={styles.enrollmentBadge}>
            <UsersIcon size={16} />
            {enrolledStudents.length} Students Enrolled
          </span>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <LoadingSpinner />
            <p style={{ marginTop: '16px', color: colors.gray[600] }}>Loading students...</p>
          </div>
        )}

        {!loading && enrolledStudents.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: colors.gray[500] }}>No students enrolled in this course yet.</p>
          </div>
        )}

        {!loading && enrolledStudents.length > 0 && (
          <div style={styles.studentList}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Student ID</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Batch</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {enrolledStudents.map((student) => (
                  <tr key={student.student_id}>
                    <td style={styles.td}>{student.student_id}</td>
                    <td style={styles.td}>
                      {student.first_name} {student.last_name}
                    </td>
                    <td style={styles.td}>{student.email}</td>
                    <td style={styles.td}>{student.batch_identifier}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: student.enrollment_status === 'enrolled' 
                          ? colors.success + '20' 
                          : colors.warning + '20',
                        color: student.enrollment_status === 'enrolled' 
                          ? colors.success 
                          : colors.warning,
                      }}>
                        {student.enrollment_status || 'enrolled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // Render course list
  const renderCourseList = () => (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Course Management</h1>
          <p style={styles.subtitle}>Manage trading courses and track student progress</p>
        </div>
        <button
          style={{ ...styles.button, ...styles.primaryButton }}
          onClick={() => setViewMode('add')}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryDark}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
        >
          <PlusIcon />
          Add Course
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <LoadingSpinner />
          <p style={{ marginTop: '16px', color: colors.gray[600] }}>Loading courses...</p>
        </div>
      )}

      {!loading && courses.length === 0 && (
        <div style={styles.card}>
          <p style={{ textAlign: 'center', color: colors.gray[500] }}>
            No courses found. Click "Add Course" to create your first course.
          </p>
        </div>
      )}

      {!loading && courses.length > 0 && (
        <div style={styles.courseGrid}>
          {courses.map((course) => (
            <div
              key={course.course_id}
              style={styles.courseCard}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, styles.courseCardHover);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <h3 style={styles.courseTitle}>{course.course_name}</h3>
              <p style={styles.courseCode}>Code: {course.course_code}</p>
              <p style={{ fontSize: '14px', color: colors.gray[600], marginBottom: '16px' }}>
                {course.course_description || 'No description available'}
              </p>

              {/* Enrollment Badge */}
              <div style={{ marginBottom: '16px' }}>
                <span style={styles.enrollmentBadge}>
                  <UsersIcon size={16} />
                  {courseEnrollmentStats[course.course_id] || 0} Students Enrolled
                </span>
              </div>

              <div style={styles.courseStats}>
                <div style={styles.statItem}>
                  <ClockIcon />
                  <span>{course.duration_weeks} weeks</span>
                </div>
                <div style={styles.statItem}>
                  <BookIcon />
                  <span>{course.credits} credits</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  style={{ ...styles.button, ...styles.primaryButton, flex: 1 }}
                  onClick={() => handleViewDetails(course)}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryDark}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
                >
                  <EyeIcon />
                  Details
                </button>
                <button
                  style={{ ...styles.button, ...styles.successButton }}
                  onClick={() => handleViewStudents(course)}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.secondaryDark}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.success}
                >
                  <UsersIcon />
                  Students
                </button>
                <button
                  style={{ ...styles.button, ...styles.secondaryButton }}
                  onClick={() => handleEditCourse(course)}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.gray[50]}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <EditIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render course form (add/edit)
  const renderCourseForm = () => (
    <div style={styles.card}>
      <button
        style={styles.backButton}
        onClick={() => {
          setViewMode('list');
          resetForm();
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.gray[200]}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.gray[100]}
      >
        <BackIcon />
        Back to Courses
      </button>

      <h2 style={styles.title}>
        {viewMode === 'add' ? 'Add New Course' : 'Edit Course'}
      </h2>

      <div>
        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={styles.label}>
                Course Code<span style={styles.required}>*</span>
              </label>
              {courseCodeExists && (
                <span style={{ color: 'red', fontSize: '0.9em' }}> Already used</span>
              )}
            </div>
            <input
              type="text"
              name="course_code"
              style={{
                ...styles.input,
                borderColor: courseCodeExists ? 'red' : undefined
              }}
              value={formData.course_code}
              onChange={handleInputChange}
              placeholder="e.g., FX101"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Course Name<span style={styles.required}>*</span>
            </label>
            <input
              type="text"
              name="course_name"
              style={styles.input}
              value={formData.course_name}
              onChange={handleInputChange}
              placeholder="e.g., Forex Trading Fundamentals"
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Course Description</label>
          <textarea
            name="course_description"
            style={styles.textarea}
            value={formData.course_description}
            onChange={handleInputChange}
            placeholder="Enter course description..."
          />
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Duration (weeks)<span style={styles.required}>*</span>
            </label>
            <input
              type="number"
              name="duration_weeks"
              style={styles.input}
              value={formData.duration_weeks}
              onChange={handleInputChange}
              min="1"
              placeholder="12"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Credits<span style={styles.required}>*</span>
            </label>
            <input
              type="number"
              name="credits"
              style={styles.input}
              value={formData.credits}
              onChange={handleInputChange}
              min="0"
              step="0.5"
              placeholder="3"
            />
          </div>
        </div>

        <h3 style={styles.sectionTitle}>Pricing Options</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {Object.entries(formData.pricing).map(([type, value]) => (
            <div key={type} style={styles.formGroup}>
              <label style={styles.label}>
                {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')} Price
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.gray[500] }}>₱</span>
                <input
                  type="number"
                  style={{ ...styles.input, paddingLeft: '28px' }}
                  value={value}
                  onChange={(e) => handlePricingChange(type, e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="10.0"
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
          <button
            onClick={(e) => {
              e.preventDefault();
              if (viewMode === 'add') {
                handleAddCourse(e);
              } else {
                handleUpdateCourse(e);
              }
            }}
            style={{ ...styles.button, ...styles.primaryButton, flex: 1 }}
            disabled={loading}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = colors.primaryDark)}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = colors.primary)}
          >
            {loading ? (
              <>
                <LoadingSpinner />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckIcon />
                <span>{viewMode === 'add' ? 'Add Course' : 'Update Course'}</span>
              </>
            )}
          </button>
          <button
            onClick={() => {
              setViewMode('list');
              resetForm();
            }}
            style={{ ...styles.button, ...styles.secondaryButton }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.gray[50]}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  // NEW: Render assign competencies modal
  const renderAssignCompetenciesModal = () => {
    if (!showAssignCompetencies) return null;

    const unassignedCompetencies = getUnassignedCompetencies();

    return (
      <div style={styles.modal} onClick={() => setShowAssignCompetencies(false)}>
        <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <h2 style={{ ...styles.title, marginBottom: '24px' }}>
            Assign Competencies to Course
          </h2>

          {unassignedCompetencies.length === 0 ? (
            <p style={{ color: colors.gray[500], textAlign: 'center', padding: '40px' }}>
              All available competencies are already assigned to this course.
            </p>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {unassignedCompetencies.map((competency) => (
                <div
                  key={competency.competency_id}
                  style={{
                    ...styles.competencyCard,
                    cursor: 'pointer',
                    marginBottom: '12px',
                  }}
                  onClick={() => {
                    handleAssignCompetencyToCourse(competency.competency_id);
                    setShowAssignCompetencies(false);
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: '600', color: colors.gray[900] }}>
                        {competency.competency_name}
                      </h4>
                      <p style={{ fontSize: '14px', color: colors.gray[600], marginTop: '4px' }}>
                        {competency.competency_description}
                      </p>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <span style={{
                          ...styles.badge,
                          backgroundColor: colors.primaryLight + '20',
                          color: colors.primaryLight,
                        }}>
                          {competency.competency_type}
                        </span>
                        <span style={{ fontSize: '12px', color: colors.gray[500] }}>
                          Code: {competency.competency_code}
                        </span>
                      </div>
                    </div>
                    <button
                      style={{ ...styles.button, ...styles.primaryButton, padding: '6px 12px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAssignCompetencyToCourse(competency.competency_id);
                        setShowAssignCompetencies(false);
                      }}
                    >
                      <LinkIcon />
                      Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={() => setShowAssignCompetencies(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render competency form modal
  const renderCompetencyModal = () => {
    if (!showAddCompetency && !editingCompetency) return null;

    return (
      <div style={styles.modal} onClick={() => {
        setShowAddCompetency(false);
        setEditingCompetency(null);
        resetCompetencyForm();
      }}>
        <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <h2 style={{ ...styles.title, marginBottom: '24px' }}>
            {editingCompetency ? 'Edit Competency' : 'Add New Competency'}
          </h2>

          <form onSubmit={editingCompetency ? handleUpdateCompetency : handleAddCompetency}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Competency Code<span style={styles.required}>*</span>
              </label>
              <input
                type="text"
                style={styles.input}
                value={competencyFormData.competency_code}
                onChange={(e) => setCompetencyFormData(prev => ({ ...prev, competency_code: e.target.value }))}
                required
                placeholder="e.g., COMP001"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Competency Name<span style={styles.required}>*</span>
              </label>
              <input
                type="text"
                style={styles.input}
                value={competencyFormData.competency_name}
                onChange={(e) => setCompetencyFormData(prev => ({ ...prev, competency_name: e.target.value }))}
                required
                placeholder="e.g., Technical Analysis"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                style={styles.textarea}
                value={competencyFormData.competency_description}
                onChange={(e) => setCompetencyFormData(prev => ({ ...prev, competency_description: e.target.value }))}
                placeholder="Enter competency description..."
              />
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Competency Type<span style={styles.required}>*</span>
                </label>
                <select
                  style={styles.input}
                  value={competencyFormData.competency_type_id}
                  onChange={(e) => setCompetencyFormData(prev => ({ ...prev, competency_type_id: e.target.value }))}
                  required
                >
                  <option value="">Select Type</option>
                  <option value="1">Basic</option>
                  <option value="2">Common</option>
                  <option value="3">Core</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Passing Score (%)<span style={styles.required}>*</span>
                </label>
                <input
                  type="number"
                  style={styles.input}
                  value={competencyFormData.passing_score}
                  onChange={(e) => setCompetencyFormData(prev => ({ ...prev, passing_score: e.target.value }))}
                  required
                  min="0"
                  max="100"
                  step="1.0"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                type="submit"
                style={{ ...styles.button, ...styles.primaryButton, flex: 1 }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LoadingSpinner />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckIcon />
                    <span>{editingCompetency ? 'Update' : 'Add'} Competency</span>
                  </>
                )}
              </button>
              <button
                type="button"
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={() => {
                  setShowAddCompetency(false);
                  setEditingCompetency(null);
                  resetCompetencyForm();
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // UPDATED: Render course details with proper competency assignment
  const renderCourseDetails = () => (
    <div>
      <button
        style={styles.backButton}
        onClick={() => {
          setViewMode('list');
          setSelectedCourse(null);
          setSelectedOffering(null);
          setSelectedCompetency(null);
          setEnrolledStudents([]);
          setCompetencyStudents([]);
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.gray[200]}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.gray[100]}
      >
        <BackIcon />
        Back to Courses
      </button>

      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>{selectedCourse?.course_name}</h1>
            <p style={styles.courseCode}>Code: {selectedCourse?.course_code}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              style={{ ...styles.button, ...styles.successButton }}
              onClick={() => handleViewStudents(selectedCourse)}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.secondaryDark}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.success}
            >
              <UsersIcon />
              View Students
            </button>
            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={() => handleEditCourse(selectedCourse)}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.gray[50]}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <EditIcon />
              Edit Course
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '24px', marginTop: '24px' }}>
          <div>
            <p style={{ fontSize: '14px', color: colors.gray[500] }}>Duration</p>
            <p style={{ fontSize: '20px', fontWeight: '600', color: colors.gray[900] }}>
              {selectedCourse?.duration_weeks} weeks
            </p>
          </div>
          <div>
            <p style={{ fontSize: '14px', color: colors.gray[500] }}>Credits</p>
            <p style={{ fontSize: '20px', fontWeight: '600', color: colors.gray[900] }}>
              {selectedCourse?.credits}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '14px', color: colors.gray[500] }}>Total Enrollees</p>
            <p style={{ fontSize: '20px', fontWeight: '600', color: colors.primary }}>
              {courseEnrollmentStats[selectedCourse?.course_id] || 0} Students
            </p>
          </div>
          <div>
            <p style={{ fontSize: '14px', color: colors.gray[500] }}>Status</p>
            <span style={{
              ...styles.badge,
              backgroundColor: selectedCourse?.is_active ? colors.success + '20' : colors.gray[200],
              color: selectedCourse?.is_active ? colors.success : colors.gray[600],
            }}>
              {selectedCourse?.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Course Competencies with Student Progress - UPDATED */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>
          <span>Course Competencies ({courseCompetencies.length})</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={{ ...styles.button, ...styles.primaryButton, padding: '6px 12px', fontSize: '12px' }}
              onClick={() => setShowAssignCompetencies(true)}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryDark}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
            >
              <LinkIcon size={14} />
              Assign Existing
            </button>
            <button
              style={{ ...styles.button, ...styles.successButton, padding: '6px 12px', fontSize: '12px' }}
              onClick={() => setShowAddCompetency(true)}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.secondaryDark}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.success}
            >
              <PlusIcon size={14} />
              Create New
            </button>
            <button
              style={{ ...styles.button, ...styles.secondaryButton, padding: '6px 12px', fontSize: '12px' }}
              onClick={() => setViewMode('competency-manage')}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.gray[50]}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Manage All
            </button>
          </div>
        </div>

        {courseCompetencies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: colors.gray[500], marginBottom: '16px' }}>
              No competencies assigned to this course yet.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={() => setShowAssignCompetencies(true)}
              >
                <LinkIcon />
                Assign Existing Competency
              </button>
              <button
                style={{ ...styles.button, ...styles.successButton }}
                onClick={() => setShowAddCompetency(true)}
              >
                <PlusIcon />
                Create New Competency
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {courseCompetencies.map((competency) => (
              <div
                key={competency.competency_id}
                style={{
                  ...styles.competencyCard,
                  cursor: 'pointer',
                  backgroundColor: selectedCompetency?.competency_id === competency.competency_id ? colors.primary + '10' : '#fff',
                  borderColor: selectedCompetency?.competency_id === competency.competency_id ? colors.primary : colors.gray[200],
                }}
                onClick={() => handleCompetencyClick(competency)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: colors.gray[900], marginBottom: '4px' }}>
                      {competency.competency_name}
                    </h4>
                    <p style={{ fontSize: '14px', color: colors.gray[600], marginBottom: '8px' }}>
                      {competency.competency_description}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: colors.primaryLight + '20',
                        color: colors.primaryLight,
                      }}>
                        {competency.competency_type}
                      </span>
                      <span style={{ fontSize: '12px', color: colors.gray[500] }}>
                        Passing: {competency.passing_score || 70}%
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: '24px' }}>
                    <div style={{
                      backgroundColor: colors.secondary + '20',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      minWidth: '120px'
                    }}>
                      <p style={{ fontSize: '24px', fontWeight: '700', color: colors.secondary }}>
                        {competencyStudents.filter(s => s.competency_progress?.competency_id === competency.competency_id).length || 0}
                      </p>
                      <p style={{ fontSize: '12px', color: colors.gray[600], marginTop: '4px' }}>
                        Students Enrolled
                      </p>
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
                      <button
                        style={{ ...styles.button, ...styles.secondaryButton, padding: '4px 8px', fontSize: '12px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCompetency(competency);
                          setCompetencyFormData({
                            competency_code: competency.competency_code,
                            competency_name: competency.competency_name,
                            competency_description: competency.competency_description || '',
                            competency_type_id: competency.competency_type_id || '',
                            weight: competency.weight || '1.00',
                            passing_score: competency.passing_score || '70.00'
                          });
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.gray[50]}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <EditIcon size={12} />
                      </button>
                      <button
                        style={{ ...styles.button, ...styles.dangerButton, padding: '4px 8px', fontSize: '12px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCompetencyFromCourse(competency.competency_id);
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.danger + '10'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Remove from course"
                      >
                        <XIcon size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Students Progress in Selected Competency */}
      {selectedCompetency && (
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Student Progress - {selectedCompetency.competency_name}
          </h2>
          
          <div style={{ marginBottom: '16px' }}>
            <span style={{
              ...styles.badge,
              backgroundColor: colors.primary + '20',
              color: colors.primary,
              fontSize: '14px',
              padding: '8px 16px'
            }}>
              {competencyStudents.length} Students Currently in This Competency
            </span>
          </div>

          {competencyStudents.length === 0 ? (
            <p style={{ color: colors.gray[500] }}>No students enrolled in this competency yet.</p>
          ) : (
            <div style={styles.studentList}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Student ID</th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {competencyStudents.map((student) => {
                    const progress = student.competency_progress;
                    const progressPercentage = progress?.percentage_score || 0;
                    const isPassed = progress?.passed;
                    
                    return (
                      <tr key={student.student_id}>
                        <td style={styles.td}>{student.student_id}</td>
                        <td style={styles.td}>{student.first_name} {student.last_name}</td>
                        <td style={styles.td}>{student.email}</td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.badge,
                            backgroundColor: isPassed ? colors.success + '20' : progress ? colors.warning + '20' : colors.gray[200],
                            color: isPassed ? colors.success : progress ? colors.warning : colors.gray[600],
                          }}>
                            {isPassed ? 'Passed' : progress ? 'In Progress' : 'Not Started'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Render competency management view
  const renderCompetencyManagement = () => (
    <div>
      <button
        style={styles.backButton}
        onClick={() => setViewMode('details')}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.gray[200]}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.gray[100]}
      >
        <BackIcon />
        Back to Course Details
      </button>

      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Manage Competencies</h1>
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={() => setShowAddCompetency(true)}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryDark}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
          >
            <PlusIcon />
            Add Competency
          </button>
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>
          {allCompetencies.map((competency) => (
            <div key={competency.competency_id} style={styles.competencyCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', color: colors.gray[900] }}>
                    {competency.competency_name}
                  </h4>
                  <p style={{ fontSize: '14px', color: colors.gray[600], marginTop: '4px' }}>
                    {competency.competency_description}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <span style={{
                      ...styles.badge,
                      backgroundColor: colors.primaryLight + '20',
                      color: colors.primaryLight,
                    }}>
                      {competency.competency_type}
                    </span>
                    <span style={{ fontSize: '12px', color: colors.gray[500] }}>
                      Code: {competency.competency_code}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    style={{ ...styles.button, ...styles.secondaryButton, padding: '6px 12px' }}
                    onClick={() => {
                      setEditingCompetency(competency);
                      setCompetencyFormData({
                        competency_code: competency.competency_code,
                        competency_name: competency.competency_name,
                        competency_description: competency.competency_description || '',
                        competency_type_id: competency.competency_type_id || '',
                        weight: competency.weight || '1.00',
                        passing_score: competency.passing_score || '70.00'
                      });
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.gray[50]}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <EditIcon />
                    Edit
                  </button>
                  <button
                    style={{ ...styles.button, ...styles.dangerButton, padding: '6px 12px' }}
                    onClick={() => handleDeleteCompetency(competency.competency_id)}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.danger + '10'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <TrashIcon />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <style>
        {`
          .spinner {
            animation: spin 1s linear infinite;
          }
          .spinner-circle {
            opacity: 0.25;
          }
          .spinner-path {
            opacity: 0.75;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      <div style={styles.maxWidth}>
        {/* Alerts */}
        {error && (
          <div style={{ ...styles.alert, ...styles.alertError }}>
            <XIcon />
            <span style={{ marginLeft: '8px' }}>{error}</span>
          </div>
        )}

        {success && (
          <div style={{ ...styles.alert, ...styles.alertSuccess }}>
            <CheckIcon />
            <span style={{ marginLeft: '8px' }}>{success}</span>
          </div>
        )}

        {/* Content based on view mode */}
        {viewMode === 'list' && renderCourseList()}
        {(viewMode === 'add' || viewMode === 'edit') && renderCourseForm()}
        {viewMode === 'details' && renderCourseDetails()}
        {viewMode === 'students' && renderCourseStudents()}
        {viewMode === 'competency-manage' && renderCompetencyManagement()}

        {/* Modals */}
        {renderCompetencyModal()}
        {renderAssignCompetenciesModal()}
      </div>
    </div>
  );
};

export default Courses;