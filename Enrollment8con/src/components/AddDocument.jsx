import { useState, useEffect, useCallback, useRef } from 'react';

const AddDocument = () => {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({
    document_type_id: '',
    notes: ''
  });
  const [studentDocuments, setStudentDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const searchTimeoutRef = useRef(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Modern color scheme
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
  const UploadIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );

  const CheckIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );

  const ClockIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const DocumentIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

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
    <svg width={size} height={size} className="spinner" viewBox="0 0 24 24">
      <circle className="spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  // Predefined document types
  const tesdaDocumentTypes = [
    { document_type_id: 1, type_name: 'TESDA Application Form', is_required: true, category: 'application' },
    { document_type_id: 2, type_name: 'Birth Certificate (PSA/NSO)', is_required: true, category: 'identification' },
    { document_type_id: 3, type_name: 'Valid ID (Government/School)', is_required: true, category: 'identification' },
    { document_type_id: 4, type_name: 'Passport Size Photo (2pcs)', is_required: true, category: 'identification' },
    { document_type_id: 5, type_name: 'High School/College Diploma', is_required: true, category: 'education' },
    { document_type_id: 6, type_name: 'Form 137/Transcript of Records', is_required: true, category: 'education' },
    { document_type_id: 7, type_name: 'Barangay Clearance/Certificate of Indigency', is_required: false, category: 'scholarship' },
    { document_type_id: 8, type_name: 'Medical Certificate', is_required: false, category: 'health' },
    { document_type_id: 9, type_name: 'Certificate of Good Moral Character', is_required: false, category: 'character' },
    { document_type_id: 10, type_name: 'Marriage Certificate', is_required: false, category: 'identification' },
    { document_type_id: 11, type_name: 'NBI/Police Clearance', is_required: false, category: 'clearance' }
  ];

  const fetchDocumentTypes = useCallback(async () => {
    try {
      const token = localStorage?.getItem('token');
      if (!token) {
        setDocumentTypes(tesdaDocumentTypes);
        return;
      }

      const response = await fetch('http://localhost:3000/api/document-types', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const types = await response.json();
          setDocumentTypes(types.length > 0 ? types : tesdaDocumentTypes);
        } else {
          setDocumentTypes(tesdaDocumentTypes);
        }
      } else {
        setDocumentTypes(tesdaDocumentTypes);
      }
    } catch (error) {
      setDocumentTypes(tesdaDocumentTypes);
    }
  }, []);

  const fetchStudentDocuments = useCallback(async (studentId) => {
    if (!studentId) return;
    
    setLoadingDocuments(true);
    try {
      const token = localStorage?.getItem('token');
      if (!token) return;

      const response = await fetch(`http://localhost:3000/api/documents/student/${studentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const docs = await response.json();
        setStudentDocuments(docs);
      }
    } catch (error) {
      console.error('Error fetching student documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  const searchStudents = useCallback(async (searchValue) => {
    if (!searchValue.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setError(null);
    
    try {
      const token = localStorage?.getItem('token');
      if (!token) {
        setError('Please log in to search for students');
        setSearchLoading(false);
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
          setSearchResults(studentsData);
          
          if (studentsData.length === 0) {
            setError('No students found matching your search');
          }
        } else {
          setError('Invalid response from server');
        }
      } else {
        let errorMessage = 'Failed to search students';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        
        setError(errorMessage);
      }
    } catch (error) {
      setError('Failed to search students. Please check your connection and try again.');
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocumentTypes();
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [fetchDocumentTypes]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (error) setError(null);
    if (success) setSuccess(null);
    
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchStudents(value);
    }, 300);
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setSearchTerm(`${student.first_name} ${student.last_name} (${student.student_id})`);
    setSearchResults([]);
    setError(null);
    fetchStudentDocuments(student.student_id);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf', 
                          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid file type (JPEG, PNG, PDF, DOC, DOCX, XLS, XLSX)');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const validateForm = () => {
    if (!selectedStudent) {
      setError('Please select a student');
      return false;
    }

    if (!formData.document_type_id) {
      setError('Please select a document type');
      return false;
    }

    if (!selectedFile) {
      setError('Please select a file to upload');
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
      const token = localStorage?.getItem('token');
      
      if (!token) {
        setError('No authentication token found. Please login again.');
        setLoading(false);
        return;
      }

      const uploadData = new FormData();
      uploadData.append('document', selectedFile);
      uploadData.append('student_id', selectedStudent.student_id);
      uploadData.append('document_type_id', formData.document_type_id);
      if (formData.notes) {
        uploadData.append('notes', formData.notes);
      }

      const response = await fetch('http://localhost:3000/api/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: uploadData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Server error: ${response.status}`);
      }

      setSuccess('Document uploaded successfully!');
      
      // Refresh student documents
      fetchStudentDocuments(selectedStudent.student_id);
      
      // Reset form
      setSelectedFile(null);
      setFormData({
        document_type_id: '',
        notes: ''
      });

      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fileInput.value = '';
      }

    } catch (error) {
      setError(error.message || 'Failed to upload document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getDocumentStatus = (docTypeId) => {
    const doc = studentDocuments.find(d => d.document_type_id === docTypeId);
    if (!doc) return null;
    return doc.status || 'pending';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified':
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'rejected':
        return colors.danger;
      default:
        return colors.gray[400];
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'verified':
        return <CheckIcon />;
      case 'pending':
        return <ClockIcon />;
      default:
        return <DocumentIcon />;
    }
  };

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: colors.gray[50],
      padding: '32px 16px',
    },
    maxWidth: {
      maxWidth: '1024px',
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
      textAlign: 'center',
      marginBottom: '8px',
    },
    title: {
      fontSize: '30px',
      fontWeight: 'bold',
      color: colors.gray[900],
      marginBottom: '8px',
    },
    subtitle: {
      color: colors.gray[600],
      fontSize: '16px',
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
    alertIcon: {
      flexShrink: 0,
      marginRight: '12px',
    },
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      color: colors.gray[700],
      marginBottom: '8px',
    },
    required: {
      color: colors.danger,
      marginLeft: '4px',
    },
    inputGroup: {
      position: 'relative',
      marginBottom: '16px',
    },
    inputIcon: {
      position: 'absolute',
      left: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: colors.gray[400],
      pointerEvents: 'none',
    },
    input: {
      width: '94%',
      padding: '8px 12px 8px 40px',
      border: `1px solid ${colors.gray[300]}`,
      borderRadius: '6px',
      fontSize: '16px',
      outline: 'none',
      transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
    },
    inputFocus: {
      borderColor: colors.primary,
      boxShadow: `0 0 0 3px ${colors.primary}20`,
    },
    select: {
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${colors.gray[300]}`,
      borderRadius: '6px',
      fontSize: '16px',
      backgroundColor: '#fff',
      outline: 'none',
      cursor: 'pointer',
    },
    textarea: {
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${colors.gray[300]}`,
      borderRadius: '6px',
      fontSize: '16px',
      minHeight: '80px',
      resize: 'vertical',
      outline: 'none',
    },
    searchResults: {
      marginTop: '16px',
      maxHeight: '240px',
      overflowY: 'auto',
      border: `1px solid ${colors.gray[200]}`,
      borderRadius: '6px',
    },
    searchResultItem: {
      padding: '12px 16px',
      borderBottom: `1px solid ${colors.gray[100]}`,
      cursor: 'pointer',
      transition: 'background-color 0.15s ease-in-out',
    },
    searchResultItemHover: {
      backgroundColor: colors.gray[50],
    },
    selectedStudent: {
      marginTop: '16px',
      backgroundColor: '#EEF2FF',
      border: `1px solid ${colors.primaryLight}`,
      borderRadius: '6px',
      padding: '16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    fileUpload: {
      marginTop: '8px',
      border: `2px dashed ${colors.gray[300]}`,
      borderRadius: '6px',
      padding: '40px 24px',
      textAlign: 'center',
      transition: 'border-color 0.15s ease-in-out',
      cursor: 'pointer',
    },
    fileUploadHover: {
      borderColor: colors.gray[400],
    },
    fileUploadIcon: {
      margin: '0 auto 16px',
      color: colors.gray[400],
    },
    fileInput: {
      display: 'none',
    },
    fileLabel: {
      color: colors.primary,
      fontWeight: '500',
      cursor: 'pointer',
      marginRight: '4px',
    },
    fileLabelHover: {
      color: colors.primaryDark,
    },
    fileInfo: {
      marginTop: '8px',
      backgroundColor: colors.gray[50],
      borderRadius: '6px',
      padding: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    button: {
      marginTop: '24px',
      width: '100%',
      padding: '12px 16px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '16px',
      fontWeight: '500',
      color: '#fff',
      backgroundColor: colors.primary,
      cursor: 'pointer',
      transition: 'background-color 0.15s ease-in-out',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonHover: {
      backgroundColor: colors.primaryDark,
    },
    buttonDisabled: {
      backgroundColor: colors.gray[400],
      cursor: 'not-allowed',
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: colors.gray[900],
      marginBottom: '16px',
    },
    documentGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '16px',
    },
    documentCard: {
      border: `1px solid ${colors.gray[200]}`,
      borderRadius: '6px',
      padding: '16px',
    },
    documentCardActive: {
      border: `1px solid ${colors.gray[300]}`,
    },
    documentName: {
      fontWeight: '500',
      color: colors.gray[900],
      marginBottom: '8px',
    },
    documentNameInactive: {
      color: colors.gray[500],
    },
    statusBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 12px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: '500',
      gap: '4px',
    },
    loadingContainer: {
      textAlign: 'center',
      padding: '32px',
    },
    loadingText: {
      marginLeft: '12px',
      color: colors.gray[600],
    },
    list: {
      listStyle: 'none',
      padding: 0,
      margin: 0,
    },
    listItem: {
      display: 'flex',
      alignItems: 'flex-start',
      marginBottom: '8px',
      fontSize: '14px',
      color: colors.gray[600],
    },
    listIcon: {
      marginRight: '8px',
      flexShrink: 0,
      marginTop: '2px',
    },
    closeButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: colors.primary,
      padding: '4px',
    },
    closeButtonHover: {
      color: colors.primaryDark,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.maxWidth}>
        {/* Header */}
        <div style={styles.card}>
          <div style={styles.header}>
            <h1 style={styles.title}>Upload Student Document</h1>
            <p style={styles.subtitle}>Submit required documents for TESDA scholarship applications</p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{ ...styles.alert, ...styles.alertError }}>
            <div style={styles.alertIcon}>
              <XIcon />
            </div>
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div style={{ ...styles.alert, ...styles.alertSuccess }}>
            <div style={styles.alertIcon}>
              <CheckIcon />
            </div>
            <p>{success}</p>
          </div>
        )}

        {/* Search Section */}
        <div style={styles.card}>
          <label style={styles.label}>
            Search Student<span style={styles.required}>*</span>
          </label>
          <div style={styles.inputGroup}>
            <div style={styles.inputIcon}>
              <SearchIcon />
            </div>
            <input
              type="text"
              style={styles.input}
              placeholder="Enter student name or ID..."
              value={searchTerm}
              onChange={handleSearchChange}
              disabled={loading}
              onFocus={(e) => {
                e.target.style.borderColor = colors.primary;
                e.target.style.boxShadow = `0 0 0 3px ${colors.primary}20`;
                if (selectedStudent && searchTerm.includes('(')) {
                  setSelectedStudent(null);
                  setSearchTerm('');
                  setStudentDocuments([]);
                }
              }}
              onBlur={(e) => {
                e.target.style.borderColor = colors.gray[300];
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {searchLoading && (
            <div style={styles.loadingContainer}>
              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                <LoadingSpinner />
                <span style={styles.loadingText}>Searching students...</span>
              </div>
            </div>
          )}

          {searchResults.length > 0 && !selectedStudent && (
            <div style={styles.searchResults}>
              {searchResults.map((student) => (
                <div
                  key={student.student_id}
                  style={styles.searchResultItem}
                  onClick={() => handleStudentSelect(student)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.gray[50];
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: '500', color: colors.gray[900] }}>
                        {student.first_name} {student.last_name}
                      </p>
                      <p style={{ fontSize: '14px', color: colors.gray[600] }}>
                        ID: {student.student_id}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '12px', color: colors.gray[500] }}>
                        Status: {student.graduation_status || 'N/A'}
                      </p>
                      <p style={{ fontSize: '12px', color: colors.gray[500] }}>
                        Level: {student.current_trading_level || 'Not assigned'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedStudent && (
            <div style={styles.selectedStudent}>
              <div>
                <p style={{ fontWeight: '500', color: '#4338CA' }}>
                  {selectedStudent.first_name} {selectedStudent.last_name}
                </p>
                <p style={{ fontSize: '14px', color: '#6366F1' }}>ID: {selectedStudent.student_id}</p>
              </div>
              <button
                style={styles.closeButton}
                onClick={() => {
                  setSelectedStudent(null);
                  setSearchTerm('');
                  setStudentDocuments([]);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = colors.primaryDark;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = colors.primary;
                }}
              >
                <XIcon />
              </button>
            </div>
          )}
        </div>

        {/* Upload Form */}
        <form onSubmit={handleSubmit} style={styles.card}>
          <h2 style={styles.sectionTitle}>Document Information</h2>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={styles.label}>
              Document Type<span style={styles.required}>*</span>
            </label>
            <select
              name="document_type_id"
              style={styles.select}
              value={formData.document_type_id}
              onChange={handleChange}
              disabled={loading}
              required
            >
              <option value="">Select Document Type</option>
              {documentTypes.map((type) => (
                <option key={type.document_type_id} value={type.document_type_id}>
                  {type.type_name}
                  {type.is_required && ' *'}
                </option>
              ))}
            </select>
            <p style={{ marginTop: '4px', fontSize: '12px', color: colors.gray[500] }}>
              * Required documents for TESDA scholarship applications
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={styles.label}>
              Document File<span style={styles.required}>*</span>
            </label>
            <div
              style={styles.fileUpload}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.gray[400];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.gray[300];
              }}
            >
              <div style={styles.fileUploadIcon}>
                <UploadIcon size={32} />
              </div>
              <div style={{ fontSize: '14px', color: colors.gray[600] }}>
                <label
                  style={styles.fileLabel}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = colors.primaryDark;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = colors.primary;
                  }}
                >
                  <span>Upload a file</span>
                  <input
                    type="file"
                    style={styles.fileInput}
                    onChange={handleFileChange}
                    disabled={loading}
                    accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx"
                    required
                  />
                </label>
                <span>or drag and drop</span>
              </div>
              <p style={{ fontSize: '12px', color: colors.gray[500], marginTop: '8px' }}>
                JPEG, PNG, PDF, DOC, DOCX, XLS, XLSX up to 10MB
              </p>
            </div>
            {selectedFile && (
              <div style={styles.fileInfo}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <DocumentIcon />
                  <span style={{ marginLeft: '8px', fontSize: '14px', color: colors.gray[600] }}>
                    {selectedFile.name}
                  </span>
                </div>
                <span style={{ fontSize: '14px', color: colors.gray[500] }}>
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            )}
          </div>

          <div>
            <label style={styles.label}>Notes (Optional)</label>
            <textarea
              name="notes"
              style={styles.textarea}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add any additional notes about this document..."
              disabled={loading}
              onFocus={(e) => {
                e.target.style.borderColor = colors.primary;
                e.target.style.boxShadow = `0 0 0 3px ${colors.primary}20`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = colors.gray[300];
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={loading ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = colors.primaryDark;
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = colors.primary;
              }
            }}
          >
            {loading ? (
              <>
                <LoadingSpinner />
                <span style={{ marginLeft: '8px' }}>Uploading Document...</span>
              </>
            ) : (
              <>
                <UploadIcon />
                <span style={{ marginLeft: '8px' }}>Upload Document</span>
              </>
            )}
          </button>
        </form>

        {/* Document Status Section */}
        {selectedStudent && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Document Status</h2>
            
            {loadingDocuments ? (
              <div style={styles.loadingContainer}>
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <LoadingSpinner />
                  <span style={styles.loadingText}>Loading document status...</span>
                </div>
              </div>
            ) : (
              <div style={styles.documentGrid}>
                {documentTypes.map((docType) => {
                  const status = getDocumentStatus(docType.document_type_id);
                  const hasDocument = status !== null;
                  
                  return (
                    <div
                      key={docType.document_type_id}
                      style={hasDocument ? { ...styles.documentCard, ...styles.documentCardActive } : styles.documentCard}
                    >
                      <p style={hasDocument ? styles.documentName : { ...styles.documentName, ...styles.documentNameInactive }}>
                        {docType.type_name}
                        {docType.is_required && <span style={styles.required}>*</span>}
                      </p>
                      {hasDocument ? (
                        <div style={{ marginTop: '8px' }}>
                          <span
                            style={{
                              ...styles.statusBadge,
                              backgroundColor: `${getStatusColor(status)}20`,
                              color: getStatusColor(status),
                            }}
                          >
                            {getStatusIcon(status)}
                            <span style={{ textTransform: 'capitalize' }}>{status}</span>
                          </span>
                        </div>
                      ) : (
                        <p style={{ marginTop: '4px', fontSize: '14px', color: colors.gray[400] }}>
                          Not uploaded
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
  );
};

export default AddDocument;