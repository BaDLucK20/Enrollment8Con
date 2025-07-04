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
  Calendar,
  Award,
  ArrowRight,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

const Batch = () => {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseOfferings, setCourseOfferings] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [studentCompetencies, setStudentCompetencies] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('byBatch');
  
  // Selection states
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Batch reassignment states
  const [showBatchReassignment, setShowBatchReassignment] = useState(false);
  const [newBatchId, setNewBatchId] = useState('');
  const [reassignmentLoading, setReassignmentLoading] = useState(false);
  const [reassignmentError, setReassignmentError] = useState('');
  
  // Competency reassignment states
  const [showCompetencyReassignment, setShowCompetencyReassignment] = useState(false);
  const [competencyReassignmentData, setCompetencyReassignmentData] = useState({
    fromCompetency: '',
    toCompetency: '',
    transferProgress: false,
    resetProgress: false
  });
  const [competencyReassignmentLoading, setCompetencyReassignmentLoading] = useState(false);
  const [competencyReassignmentError, setCompetencyReassignmentError] = useState('');
  
  // Filter states
  const [filters, setFilters] = useState({
    name: '',
    course: '',
    batch: '',
    status: '',
    competency: ''
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
    blue: '#3b82f6',
    purple: '#8b5cf6'
  };

  useEffect(() => {
    initializeData();
  }, []);

  useEffect(() => {
    if (showBatchReassignment) {
      setNewBatchId('');
      setReassignmentError('');
    }
  }, [selectedStudents, showBatchReassignment]);

  useEffect(() => {
    if (showCompetencyReassignment) {
      setCompetencyReassignmentData({
        fromCompetency: '',
        toCompetency: '',
        transferProgress: false,
        resetProgress: false
      });
      setCompetencyReassignmentError('');
    }
  }, [selectedStudents, showCompetencyReassignment]);

  const initializeData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStudents(),
        fetchCourses(),
        fetchCourseOfferings(),
        fetchCompetencies()
      ]);
    } catch (error) {
      console.error('Error initializing data:', error);
      setError('Failed to initialize data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const getAuthToken = () => {
    try {
      return localStorage.getItem('token') || localStorage.getItem('authToken');
    } catch (e) {
      console.warn('Could not access localStorage:', e);
      return null;
    }
  };

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
      
      if (studentsData && studentsData.length > 0) {
        await fetchStudentCompetencies(studentsData);
      }
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

  const fetchCompetencies = async () => {
    try {
      const competenciesData = await makeAuthenticatedRequest('http://localhost:3000/api/competencies');
      setCompetencies(competenciesData || []);
      console.log('Fetched competencies:', competenciesData);
    } catch (err) {
      console.error('Failed to fetch competencies:', err.message);
    }
  };

  const fetchStudentCompetencies = async (studentsData = students) => {
    try {
      const studentCompetencyMap = {};
      
      for (const student of studentsData) {
        try {
          // First try to get competency progress directly
          let studentComps = [];
          
          try {
            const competencyProgress = await makeAuthenticatedRequest(
              `http://localhost:3000/api/students/${student.student_id}/competency-progress`
            );
            
            if (competencyProgress && competencyProgress.competency_progress) {
              studentComps = competencyProgress.competency_progress.map(progress => ({
                ...progress,
                competency_id: progress.competency_id,
                competency_name: progress.type_name || progress.competency_name,
                is_enrolled: true,
                has_progress: true,
                progress_data: progress
              }));
            }
          } catch (err) {
            console.warn(`Failed to fetch competency progress for student ${student.student_id}:`, err.message);
          }
          
          // Fallback: Get competencies from enrollments
          if (studentComps.length === 0) {
          try {
            const enrollments = await makeAuthenticatedRequest(
              `http://localhost:3000/api/students/${student.student_id}/enrollments`
            );
            
            const uniqueCourseIds = new Set();

            for (const enrollment of enrollments || []) {
              if (enrollment.course_code) {
                const course = courses.find(c => c.course_code === enrollment.course_code);
                if (course) {
                  uniqueCourseIds.add(course.course_id);
                }
              }
            }

            let fallbackComps = [];

            for (const courseId of uniqueCourseIds) {
              try {
                const courseComps = await makeAuthenticatedRequest(
                  `http://localhost:3000/api/courses/${courseId}/competencies`
                );

                const enrichedComps = (courseComps || []).map(comp => ({
                  ...comp,
                  source: 'enrollment',
                  course_id: courseId,
                  is_current: true,
                  is_enrolled: true,
                  has_progress: false
                }));

                fallbackComps = [...fallbackComps, ...enrichedComps];
              } catch (err) {
                console.warn(`Failed to fetch competencies for course ${courseId}:`, err.message);
              }
            }

            // Replace progress-based competencies with fallback ones
            studentComps = fallbackComps;

      console.log('fallbacks:',fallbackComps);
          } catch (err) {
            console.warn(`Enrollment-based competency fetch failed for student ${student.student_id}:`, err.message);
          }
          }
          
          // Remove duplicates based on competency_id
          const uniqueCompetencies = [];
          const seenIds = new Set();
          
          for (const comp of studentComps) {
            const compId = comp.competency_id;
            if (compId && !seenIds.has(compId)) {
              seenIds.add(compId);
              uniqueCompetencies.push({
                ...comp,
                competency_id: compId
              });
            }
          }
          
          studentCompetencyMap[student.student_id] = uniqueCompetencies;
          
        } catch (err) {
          console.warn(`Failed to fetch competencies for student ${student.student_id}:`, err.message);
          studentCompetencyMap[student.student_id] = [];
        }
      }
      
      setStudentCompetencies(studentCompetencyMap);
      console.log('Fetched student competencies:', studentCompetencyMap);
    } catch (err) {
      console.error('Failed to fetch student competencies:', err.message);
      setStudentCompetencies({});
    }
  };

  // Get unique competencies that selected students are enrolled in
  const getEnrolledCompetenciesForSelectedStudents = useMemo(() => {
    if (selectedStudents.size === 0) return [];
    
    const competencyMap = new Map();
    
    Array.from(selectedStudents).forEach(studentId => {
      const studentComps = studentCompetencies[studentId] || [];
      studentComps.forEach(comp => {
        if (comp.is_enrolled) {
          const key = comp.competency_id;
          const name = comp.competency_name || comp.type_name || `Competency ${key}`;
          
          if (!competencyMap.has(key)) {
            competencyMap.set(key, {
              competency_id: key,
              competency_name: name,
              competency_type: comp.competency_type || comp.type_name || 'General',
              student_count: 0,
              students: []
            });
          }
          
          const existing = competencyMap.get(key);
          existing.student_count++;
          existing.students.push(studentId);
        }
      });
    });
    
    return Array.from(competencyMap.values()).sort((a, b) => a.competency_name.localeCompare(b.competency_name));
  }, [selectedStudents, studentCompetencies]);

  // Get available competencies for reassignment (all competencies except the selected from competency)
  const getAvailableTargetCompetencies = useMemo(() => {
    const fromCompetencyId = competencyReassignmentData.fromCompetency;
    
    return competencies
      .filter(comp => comp.competency_id !== parseInt(fromCompetencyId))
      .sort((a, b) => a.competency_name.localeCompare(b.competency_name));
  }, [competencies, competencyReassignmentData.fromCompetency]);

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

  const getCoursesForSelectedStudents = useMemo(() => {
    const selectedStudentData = students.filter(student => 
      selectedStudents.has(student.student_id)
    );
    
    const courseIds = new Set();
    const courseCodes = new Set();
    
    selectedStudentData.forEach(student => {
      if (student.enrolled_courses) {
        const enrolledCourses = student.enrolled_courses.split(',').map(c => c.trim());
        enrolledCourses.forEach(courseStr => {
          const courseCode = courseStr.split(' - ')[0].trim();
          courseCodes.add(courseCode);
          
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
      
      if (student.course_id) {
        courseIds.add(parseInt(student.course_id));
      }
      
      if (student.course_code) {
        courseCodes.add(student.course_code);
        const matchingCourse = courses.find(c => c.course_code === student.course_code);
        if (matchingCourse) {
          courseIds.add(matchingCourse.course_id);
        }
      }
    });
    
    return { courseIds, courseCodes };
  }, [students, selectedStudents, courses]);

  const availableBatchesForSelectedStudents = useMemo(() => {
    if (selectedStudents.size === 0) {
      return [];
    }
    
    const { courseIds, courseCodes } = getCoursesForSelectedStudents;
    
    if (courseIds.size === 0 && courseCodes.size === 0) {
      return [];
    }
    
    const relevantOfferings = courseOfferings.filter(offering => {
      const course = courses.find(c => c.course_id === offering.course_id);
      if (!course) return false;
      
      return courseIds.has(course.course_id) || courseCodes.has(course.course_code);
    });
    
    const batchIdentifiers = relevantOfferings
      .map(offering => offering.batch_identifier)
      .filter(Boolean);
      
    return [...new Set(batchIdentifiers)].sort();
  }, [selectedStudents, courseOfferings, courses, getCoursesForSelectedStudents]);

  const uniqueCourses = useMemo(() => {
    return courses.map(course => ({
      id: course.course_id,
      code: course.course_code,
      name: course.course_name,
      display: `${course.course_code} - ${course.course_name}`
    })).sort((a, b) => a.display.localeCompare(b.display));
  }, [courses]);

  // Get unique competencies for filtering
  const uniqueCompetenciesForFilter = useMemo(() => {
    const competencySet = new Set();
    
    Object.values(studentCompetencies).forEach(studentComps => {
      studentComps.forEach(comp => {
        if (comp.competency_name) {
          competencySet.add(comp.competency_name);
        }
      });
    });
    
    return Array.from(competencySet).sort();
  }, [studentCompetencies]);

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

      const matchesCompetency = !filters.competency || (() => {
        const studentComps = studentCompetencies[student.student_id] || [];
        return studentComps.some(comp => 
          comp.competency_name && comp.competency_name.toLowerCase().includes(filters.competency.toLowerCase())
        );
      })();

      return matchesName && matchesCourse && matchesBatch && matchesStatus && matchesCompetency;
    });
  }, [students, filters, studentCompetencies]);

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

  const getStudentCompetencies = (studentId) => {
    return studentCompetencies[studentId] || [];
  };

  const formatStudentCompetenciesDisplay = (studentId) => {
    const studentComps = getStudentCompetencies(studentId);
    
    if (!studentComps || studentComps.length === 0) {
      return 'No active competencies';
    }
    
    if (studentComps.length === 1) {
      const comp = studentComps[0];
      return comp.competency_name || 'Active Competency';
    }
    
    const byType = studentComps.reduce((acc, comp) => {
      const type = comp.competency_type || comp.type_name || 'General';
      if (!acc[type]) acc[type] = [];
      acc[type].push(comp);
      return acc;
    }, {});
    
    const typeNames = Object.keys(byType);
    if (typeNames.length === 1 && byType[typeNames[0]].length <= 3) {
      return byType[typeNames[0]]
        .map(comp => comp.competency_name || comp.competency_code)
        .filter(Boolean)
        .join(', ') || `${studentComps.length} competencies`;
    }
    
    if (typeNames.length === 1) {
      return `${studentComps.length} ${typeNames[0]} competencies`;
    }
    
    return `${studentComps.length} competencies (${typeNames.slice(0, 2).join(', ')}${typeNames.length > 2 ? '...' : ''})`;
  };

  const getBatchCompetenciesSummary = (batchStudents) => {
    const competencyStats = {};
    const totalStudents = batchStudents.length;
    
    batchStudents.forEach(student => {
      const studentComps = getStudentCompetencies(student.student_id);
      studentComps.forEach(comp => {
        const key = comp.competency_id || comp.competency_code || comp.competency_name;
        const name = comp.competency_name || comp.competency_code || 'Unknown Competency';
        const type = comp.competency_type || comp.type_name || 'General';
        
        if (key) {
          if (!competencyStats[key]) {
            competencyStats[key] = {
              name: name,
              type: type,
              studentCount: 0,
              students: []
            };
          }
          competencyStats[key].studentCount++;
          competencyStats[key].students.push(student.student_id);
        }
      });
    });
    
    return { competencyStats, totalStudents };
  };

  const formatBatchCompetenciesDisplay = (batchStudents) => {
    const { competencyStats, totalStudents } = getBatchCompetenciesSummary(batchStudents);
    const competencyKeys = Object.keys(competencyStats);
    
    if (competencyKeys.length === 0) {
      return 'No competencies found';
    }
    
    if (competencyKeys.length === 1) {
      const comp = competencyStats[competencyKeys[0]];
      return `${comp.name} (${comp.studentCount}/${totalStudents} students)`;
    }
    
    const typeGroups = {};
    competencyKeys.forEach(key => {
      const comp = competencyStats[key];
      if (!typeGroups[comp.type]) {
        typeGroups[comp.type] = [];
      }
      typeGroups[comp.type].push(comp);
    });
    
    const typeNames = Object.keys(typeGroups);
    if (typeNames.length === 1) {
      const typeName = typeNames[0];
      const count = typeGroups[typeName].length;
      return `${count} ${typeName} competencies`;
    }
    
    return `${competencyKeys.length} competencies across ${typeNames.length} types`;
  };

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
      competency: ''
    });
  };

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

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedStudents(new Set());
    } else {
      const allStudentIds = filteredStudents.map(s => s.student_id);
      setSelectedStudents(new Set(allStudentIds));
    }
    setSelectAll(!selectAll);
  };

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

      await fetchStudents();
      
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

  // Handle competency reassignment
  const handleCompetencyReassignment = async () => {
    if (selectedStudents.size === 0) {
      setCompetencyReassignmentError('Please select at least one student.');
      return;
    }

    if (!competencyReassignmentData.fromCompetency || !competencyReassignmentData.toCompetency) {
      setCompetencyReassignmentError('Please select both source and target competencies.');
      return;
    }

    setCompetencyReassignmentLoading(true);
    setCompetencyReassignmentError('');

    try {
      const studentIds = Array.from(selectedStudents);
      const fromCompetencyId = parseInt(competencyReassignmentData.fromCompetency);
      const toCompetencyId = parseInt(competencyReassignmentData.toCompetency);
      
      // Process each student individually
      const results = [];
      const errors = [];
      
      for (const studentId of studentIds) {
        try {
          // First, get current competency progress for the from competency
          let currentProgress = null;
          try {
            const progressResponse = await makeAuthenticatedRequest(
              `http://localhost:3000/api/students/${studentId}/competency-progress`
            );
            
            if (progressResponse && progressResponse.competency_progress) {
              currentProgress = progressResponse.competency_progress.find(
                p => ( p.competency_id) === fromCompetencyId
              );
            }
          } catch (err) {
            console.warn(`Failed to fetch current progress for student ${studentId}:`, err.message);
          }
          
          // Update or create progress for the target competency
          const updateData = {
            score: competencyReassignmentData.transferProgress && currentProgress ? 
              (currentProgress.score || 0) : 0,
            exam_status: competencyReassignmentData.transferProgress && currentProgress ? 
              (currentProgress.exam_status || 'Not taken') : 'Not taken',
            passed: competencyReassignmentData.transferProgress && currentProgress ? 
              (currentProgress.passed || false) : false
          };
          
          if (competencyReassignmentData.resetProgress) {
            updateData.score = 0;
            updateData.exam_status = 'Not taken';
            updateData.passed = false;
          }
          
          // Update target competency progress
          await makeAuthenticatedRequest(
            `http://localhost:3000/api/students/${studentId}/competency-progress/${toCompetencyId}`,
            {
              method: 'PUT',
              body: JSON.stringify(updateData)
            }
          );
          
          // // Remove or reset progress for the from competency if needed
          // if (currentProgress) {
          //   await makeAuthenticatedRequest(
          //     `http://localhost:3000/api/students/${studentId}/competency-progress/${fromCompetencyId}`,
          //     {
          //       method: 'PUT',
          //       body: JSON.stringify({
          //         score: 0,
          //         exam_status: 'Not taken',
          //         passed: false
          //       })
          //     }
          //   );
          // }
          
          results.push({ studentId, status: 'success' });
          
        } catch (error) {
          console.error(`Failed to reassign competency for student ${studentId}:`, error);
          errors.push({ studentId, error: error.message });
        }
      }
      
      // Refresh student competency data
      await fetchStudentCompetencies();
      
      // Show results
      if (errors.length === 0) {
        alert(`Successfully reassigned competencies for ${results.length} student(s).`);
      } else if (results.length === 0) {
        setCompetencyReassignmentError(`Failed to reassign competencies for all students. Errors: ${errors.map(e => e.error).join(', ')}`);
        return;
      } else {
        alert(`Partially successful: ${results.length} students updated, ${errors.length} failed.`);
      }
      
      // Reset form and close modal
      setSelectedStudents(new Set());
      setSelectAll(false);
      setShowCompetencyReassignment(false);
      setCompetencyReassignmentData({
        fromCompetency: '',
        toCompetency: '',
        transferProgress: false,
        resetProgress: false
      });
      
    } catch (error) {
      console.error('Failed to reassign competencies:', error);
      setCompetencyReassignmentError('Failed to reassign competencies: ' + error.message);
    } finally {
      setCompetencyReassignmentLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
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

  const renderStudentCard = (student) => {
    const isSelected = selectedStudents.has(student.student_id);
    const studentComps = getStudentCompetencies(student.student_id);
    
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
            <span style={styles.detailLabel}>Current Competencies:</span>
            <span style={styles.detailValue}>
              {formatStudentCompetenciesDisplay(student.student_id)}
            </span>
          </div>
          
          {studentComps.length > 0 && (
            <div style={styles.competencyDetails}>
              {studentComps.slice(0, 3).map((comp, index) => (
                <span key={index} style={styles.competencyBadge}>
                  {comp.competency_name || comp.competency_code || `Competency ${index + 1}`}
                  {comp.has_progress && comp.progress_data && (
                    <span style={styles.progressIndicator}>
                      {comp.progress_data.passed ? ' ✓' : ` ${comp.progress_data.score || 0}%`}
                    </span>
                  )}
                </span>
              ))}
              {studentComps.length > 3 && (
                <span style={{...styles.competencyBadge, backgroundColor: '#f0f0f0', color: '#666'}}>
                  +{studentComps.length - 3} more
                </span>
              )}
            </div>
          )}
          
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

  // Render competency reassignment modal
  const renderCompetencyReassignmentModal = () => {
    if (!showCompetencyReassignment) return null;

    const enrolledCompetencies = getEnrolledCompetenciesForSelectedStudents;
    const targetCompetencies = getAvailableTargetCompetencies;

    return (
      <div style={styles.modalOverlay} onClick={() => setShowCompetencyReassignment(false)}>
        <div onClick={(e) => e.stopPropagation()} style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h3 style={styles.modalTitle}>
              <Award size={20} style={{ marginRight: '8px' }} />
              Competency Reassignment
            </h3>
            <button style={styles.closeButton} onClick={() => setShowCompetencyReassignment(false)}>
              ×
            </button>
          </div>
          
          <div style={styles.modalBody}>
            <div style={styles.reassignmentContainer}>
              <div style={styles.selectionInfo}>
                <p><strong>Selected Students:</strong> {selectedStudents.size}</p>
                <p style={{ fontSize: '14px', color: colors.olive, marginTop: '8px' }}>
                  Move students from one competency to another. Only competencies that selected students are currently enrolled in will be shown.
                </p>
                {enrolledCompetencies.length === 0 && (
                  <div style={styles.warningMessage}>
                    <AlertCircle size={16} />
                    <span>No enrolled competencies found for the selected students.</span>
                  </div>
                )}
              </div>

              {enrolledCompetencies.length > 0 && (
                <>
                  <div style={styles.competencyTransferSection}>
                    <div style={styles.competencySelectGroup}>
                      <label style={styles.formLabel}>From Competency:</label>
                      <select
                        value={competencyReassignmentData.fromCompetency}
                        onChange={(e) => setCompetencyReassignmentData(prev => ({
                          ...prev,
                          fromCompetency: e.target.value,
                          toCompetency: ''
                        }))}
                        style={styles.formSelect}
                      >
                        <option value="">Select source competency...</option>
                        {enrolledCompetencies.map(comp => (
                          <option key={comp.competency_id} value={comp.competency_id}>
                            {comp.competency_name} ({comp.student_count}/{selectedStudents.size} students)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.arrowContainer}>
                      <ArrowRight size={24} color={colors.lightGreen} />
                    </div>

                    <div style={styles.competencySelectGroup}>
                      <label style={styles.formLabel}>To Competency:</label>
                      <select
                        value={competencyReassignmentData.toCompetency}
                        onChange={(e) => setCompetencyReassignmentData(prev => ({
                          ...prev,
                          toCompetency: e.target.value
                        }))}
                        style={styles.formSelect}
                        disabled={!competencyReassignmentData.fromCompetency}
                      >
                        <option value="">
                          {!competencyReassignmentData.fromCompetency 
                            ? 'Select source competency first...'
                            : 'Select target competency...'
                          }
                        </option>
                        {targetCompetencies.map(comp => (
                          <option key={comp.competency_id} value={comp.competency_id}>
                            {comp.competency_name} ({comp.competency_type || 'General'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* <div style={styles.progressOptionsSection}>
                    <h4 style={styles.progressOptionsTitle}>Progress Options:</h4>
                    
                    <div style={styles.checkboxGroup}>
                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={competencyReassignmentData.transferProgress}
                          onChange={(e) => setCompetencyReassignmentData(prev => ({
                            ...prev,
                            transferProgress: e.target.checked,
                            resetProgress: e.target.checked ? false : prev.resetProgress
                          }))}
                          style={styles.checkbox}
                        />
                        <span>Transfer existing progress to new competency</span>
                      </label>
                      <p style={styles.optionDescription}>
                        Copy scores, exam status, and completion status from the source competency.
                      </p>
                    </div>

                    <div style={styles.checkboxGroup}>
                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={competencyReassignmentData.resetProgress}
                          onChange={(e) => setCompetencyReassignmentData(prev => ({
                            ...prev,
                            resetProgress: e.target.checked,
                            transferProgress: e.target.checked ? false : prev.transferProgress
                          }))}
                          style={styles.checkbox}
                        />
                        <span>Reset all progress (fresh start)</span>
                      </label>
                      <p style={styles.optionDescription}>
                        Start with clean progress in the new competency (score: 0, status: "Not taken").
                      </p>
                    </div>

                    {!competencyReassignmentData.transferProgress && !competencyReassignmentData.resetProgress && (
                      <div style={styles.infoMessage}>
                        <AlertCircle size={16} />
                        <span>Students will be enrolled in the new competency with default initial progress.</span>
                      </div>
                    )}
                  </div> */}

                  {competencyReassignmentData.fromCompetency && competencyReassignmentData.toCompetency && (
                    <div style={styles.summarySection}>
                      <h4 style={styles.summaryTitle}>
                        <CheckCircle size={16} />
                        Summary
                      </h4>
                      <div style={styles.summaryContent}>
                        <p>
                          <strong>{selectedStudents.size}</strong> student(s) will be moved from{' '}
                          <strong>
                            {enrolledCompetencies.find(c => c.competency_id == competencyReassignmentData.fromCompetency)?.competency_name}
                          </strong>{' '}
                          to{' '}
                          <strong>
                            {targetCompetencies.find(c => c.competency_id == competencyReassignmentData.toCompetency)?.competency_name}
                          </strong>
                        </p>
                        <p style={{ fontSize: '14px', color: colors.olive, marginTop: '8px' }}>
                          {competencyReassignmentData.transferProgress && 'Existing progress will be transferred.'}
                          {competencyReassignmentData.resetProgress && 'All progress will be reset.'}
                          {!competencyReassignmentData.transferProgress && !competencyReassignmentData.resetProgress && 
                            'Students will start with default progress in the new competency.'}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {competencyReassignmentError && (
                <div style={styles.errorMessage}>
                  {competencyReassignmentError}
                </div>
              )}

              <div style={styles.modalActions}>
                <button
                  style={styles.cancelButton}
                  onClick={() => setShowCompetencyReassignment(false)}
                  disabled={competencyReassignmentLoading}
                >
                  Cancel
                </button>
                <button
                  style={{
                    ...styles.submitButton,
                    opacity: (!competencyReassignmentData.fromCompetency || 
                             !competencyReassignmentData.toCompetency || 
                             competencyReassignmentLoading ||
                             enrolledCompetencies.length === 0) ? 0.6 : 1
                  }}
                  onClick={handleCompetencyReassignment}
                  disabled={!competencyReassignmentData.fromCompetency || 
                           !competencyReassignmentData.toCompetency || 
                           competencyReassignmentLoading ||
                           enrolledCompetencies.length === 0}
                >
                  {competencyReassignmentLoading ? 'Processing...' : 'Reassign Competencies'}
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
    competencyActionButton: {
      padding: '8px 16px',
      backgroundColor: colors.purple,
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
    competenciesInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '8px',
      fontSize: '14px',
      color: colors.olive,
      fontStyle: 'italic'
    },
    competencyBadge: {
      backgroundColor: '#e8f4f8',
      color: '#2c5aa0',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: '500',
      border: '1px solid #d1e7dd',
      marginRight: '4px',
      display: 'inline-block',
      position: 'relative'
    },
    progressIndicator: {
      color: '#28a745',
      fontWeight: 'bold'
    },
    competencyDetails: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px',
      marginTop: '8px',
      padding: '8px',
      backgroundColor: '#f8f9fa',
      borderRadius: '6px',
      border: '1px solid #e9ecef'
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
      maxWidth: '700px',
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
    competencyTransferSection: {
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      gap: '16px',
      alignItems: 'end',
      marginBottom: '20px'
    },
    competencySelectGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    arrowContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '0 8px'
    },
    progressOptionsSection: {
      backgroundColor: '#f8f9fa',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #e9ecef'
    },
    progressOptionsTitle: {
      margin: '0 0 12px 0',
      fontSize: '16px',
      fontWeight: 'bold',
      color: colors.darkGreen
    },
    checkboxGroup: {
      marginBottom: '12px'
    },
    checkboxLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      cursor: 'pointer',
      fontWeight: '500'
    },
    optionDescription: {
      fontSize: '12px',
      color: colors.olive,
      margin: '4px 0 0 24px',
      fontStyle: 'italic'
    },
    summarySection: {
      backgroundColor: '#e8f5e8',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #d4edda'
    },
    summaryTitle: {
      margin: '0 0 8px 0',
      fontSize: '16px',
      fontWeight: 'bold',
      color: colors.darkGreen,
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    summaryContent: {
      fontSize: '14px',
      color: colors.black
    },
    warningMessage: {
      backgroundColor: '#fff3cd',
      color: '#856404',
      padding: '12px',
      borderRadius: '6px',
      border: '1px solid #ffeaa7',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    infoMessage: {
      backgroundColor: '#d1ecf1',
      color: '#0c5460',
      padding: '12px',
      borderRadius: '6px',
      border: '1px solid #bee5eb',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
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
        <p style={styles.subtitle}>Organize and manage students by batches and courses with competency tracking</p>
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

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Competency</label>
            <select
              value={filters.competency}
              onChange={(e) => handleFilterChange('competency', e.target.value)}
              style={styles.filterSelect}
            >
              <option value="">All Competencies</option>
              {uniqueCompetenciesForFilter.map(competency => (
                <option key={competency} value={competency}>
                  {competency}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              style={styles.filterSelect}
            >
              <option value="">All Statuses</option>
              <option value="enrolled">Enrolled</option>
              <option value="active">Active</option>
              <option value="graduated">Graduated</option>
              <option value="dropped">Dropped</option>
              <option value="suspended">Suspended</option>
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
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            style={styles.competencyActionButton}
            onClick={() => {
              setShowCompetencyReassignment(true);
              setCompetencyReassignmentData({
                fromCompetency: '',
                toCompetency: '',
                transferProgress: false,
                resetProgress: false
              });
              setCompetencyReassignmentError('');
            }}
            disabled={selectedStudents.size === 0}
          >
            <Award size={16} />
            Reassign Competencies ({selectedStudents.size})
          </button>

          <button
            style={styles.bulkActionButton}
            onClick={() => {
              setShowBatchReassignment(true);
              setNewBatchId('');
              setReassignmentError('');
            }}
            disabled={selectedStudents.size === 0}
          >
            <Edit3 size={16} />
            Reassign Batch ({selectedStudents.size})
          </button>
        </div>
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
                const competenciesDisplay = formatBatchCompetenciesDisplay(batchStudents);
                
                return (
                  <div key={batchName} style={styles.contentSection}>
                    <div 
                      style={styles.sectionHeader}
                      onClick={() => toggleSection(`batch-${batchName}`)}
                    >
                      <div>
                        <div style={styles.sectionTitle}>
                          <Calendar size={20} />
                          <strong>Batch: {batchName}</strong>
                          <span style={styles.sectionCount}>
                            {batchStudents.length} students
                          </span>
                        </div>
                        <div style={styles.competenciesInfo}>
                          <Award size={16} />
                          <span>Competencies: </span>
                          <span style={styles.competencyBadge}>
                            {competenciesDisplay}
                          </span>
                        </div>
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

      {/* Competency Reassignment Modal */}
      {renderCompetencyReassignmentModal()}
    </div>
  );
};

export default Batch;