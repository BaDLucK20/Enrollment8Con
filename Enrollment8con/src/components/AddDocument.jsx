import { useState, useEffect, useCallback ,useRef} from 'react';

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
  const searchTimeoutRef = useRef(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

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

  // Predefined document types based on TESDA requirements
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

      const response = await fetch('/api/document-types', {
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
        console.warn('Document types endpoint returned:', response.status);
        setDocumentTypes(tesdaDocumentTypes);
      }
    } catch (error) {
      console.warn('Using predefined document types due to error:', error.message);
      setDocumentTypes(tesdaDocumentTypes);
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

    // Build the API URL with search parameter - this searches by ID, first name, or last name
    const apiUrl = `http://localhost:3000/api/students?search=${encodeURIComponent(searchValue)}`;
    
    console.log('🔍 Searching students by ID or name:', searchValue);

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📡 Response status:', response.status);

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const studentsData = await response.json();
        
        // The API returns an array of student objects directly from the database
        console.log('👥 Students found:', studentsData.length);
        
        // Use the data exactly as returned by the API since it matches the database structure
        setSearchResults(studentsData);
        
        if (studentsData.length === 0) {
          setError('No students found matching your search');
        }
      } else {
        const responseText = await response.text();
        console.error('❌ Response is not JSON:');
        console.error('Content-Type:', contentType);
        console.error('Response preview:', responseText.substring(0, 200));
        
        if (responseText.includes('<!doctype html>') || responseText.includes('<html')) {
          setError('🚨 API endpoint not found - getting React app instead of API response. Check your server configuration.');
        } else {
          setError('Invalid response from server - expected JSON but got: ' + contentType);
        }
      }
    } else {
      // Handle different error status codes
      let errorMessage = 'Failed to search students';
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      
      console.error('❌ API Error:', response.status, errorMessage);
      
      switch (response.status) {
        case 401:
          setError('Please log in again');
          localStorage?.removeItem('token');
          break;
        case 403:
          setError('You do not have permission to search students');
          break;
        case 404:
          setError('🚨 API endpoint not found (/api/students). Check your server routes.');
          break;
        case 500:
          setError('Server error occurred while searching students');
          break;
        default:
          setError(`${errorMessage} (${response.status})`);
      }
    }
  } catch (error) {
    console.error('💥 Network Error:', error);
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      setError('🌐 Network error - Cannot connect to server. Is your backend running?');
    } else if (error.name === 'AbortError') {
      setError('Request was cancelled');
    } else {
      setError('Failed to search students. Please check your connection and try again.');
    }
  } finally {
    setSearchLoading(false);
  }
}, []);
  
  useEffect(() => {
    fetchDocumentTypes();
    
    return () => {
      if (window.searchTimeout) {
        clearTimeout(window.searchTimeout);
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
  
  // Clear the previous timeout
  if (searchTimeoutRef.current) {
    clearTimeout(searchTimeoutRef.current);
  }
  
  // Set a new timeout
  searchTimeoutRef.current = setTimeout(() => {
    searchStudents(value);
  }, 300);
};

// Optional: Clean up timeout on component unmount
useEffect(() => {
  return () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };
}, []);

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setSearchTerm(`${student.first_name} ${student.last_name} (${student.student_id})`);
    setSearchResults([]);
    setError(null);
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
      
      setSelectedStudent(null);
      setSearchTerm('');
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
      console.error('Document upload error:', error);
      
      if (error.message.includes('403')) {
        setError('Access denied. You do not have permission to upload documents for this student.');
      } else if (error.message.includes('401')) {
        setError('Unauthorized access. Please login again.');
      } else if (error.message.includes('400')) {
        setError('Invalid file or data. Please check your selection and try again.');
      } else {
        setError(error.message || 'Failed to upload document. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      maxWidth: '800px',
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
    searchSection: {
      marginBottom: '30px',
      padding: '20px',
      backgroundColor: colors.cream,
      borderRadius: '8px',
      border: '1px solid #ddd',
    },
    searchLabel: {
      display: 'block',
      fontWeight: 'bold',
      marginBottom: '10px',
      color: colors.black,
    },
    searchInput: {
      width: '100%',
      padding: '12px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '16px',
      marginBottom: '10px',
      boxSizing: 'border-box',
    },
    searchResults: {
      maxHeight: '200px',
      overflowY: 'auto',
      border: '1px solid #ddd',
      borderRadius: '4px',
      backgroundColor: '#fff',
    },
    searchResultItem: {
      padding: '10px',
      borderBottom: '1px solid #eee',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    },
    selectedStudent: {
      padding: '15px',
      backgroundColor: colors.lightGreen,
      borderRadius: '4px',
      color: 'white',
      fontWeight: 'bold',
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
    formGroup: {
      marginBottom: '20px',
    },
    label: {
      display: 'block',
      fontWeight: 'bold',
      marginBottom: '6px',
      color: colors.black,
    },
    select: {
      width: '100%',
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      backgroundColor: '#fff',
      fontSize: '16px',
      boxSizing: 'border-box',
    },
    fileInput: {
      width: '100%',
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '16px',
      backgroundColor: '#fff',
      boxSizing: 'border-box',
    },
    textarea: {
      width: '100%',
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '16px',
      minHeight: '100px',
      resize: 'vertical',
      boxSizing: 'border-box',
    },
    fileInfo: {
      marginTop: '10px',
      padding: '10px',
      backgroundColor: '#f0f8ff',
      borderRadius: '4px',
      fontSize: '14px',
      color: colors.darkGreen,
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
      textAlign: 'center',
      padding: '10px',
      backgroundColor: '#e8f5e8',
      borderRadius: '4px',
      border: `1px solid ${colors.darkGreen}`,
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
    documentNote: {
      fontSize: '12px',
      color: colors.olive,
      fontStyle: 'italic',
      marginTop: '5px',
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Upload Student Document</h1>
      
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.searchSection}>
        <label style={styles.searchLabel}>
          Search Student<span style={styles.required}>*</span>
        </label>
        <input
          type="text"
          style={styles.searchInput}
          placeholder="Enter student name or ID..."
          value={searchTerm}
          onChange={handleSearchChange}
          disabled={loading}
          onFocus={() => {
            if (selectedStudent && searchTerm.includes('(')) {
              setSelectedStudent(null);
              setSearchTerm('');
            }
          }}
        />
        
        {searchLoading && (
          <div style={{ textAlign: 'center', color: colors.olive }}>
            Searching students...
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
                  e.target.style.backgroundColor = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                <strong>{student.first_name} {student.last_name}</strong> ({student.student_id})
                <br />
                <small style={{ color: colors.olive }}>
                  Status: {student.graduation_status || 'N/A'} | 
                  Level: {student.current_trading_level || 'No trading level assigned'}
                </small>
              </div>
            ))}
          </div>
        )}

        {selectedStudent && (
          <div style={styles.selectedStudent}>
            Selected: {selectedStudent.first_name} {selectedStudent.last_name} ({selectedStudent.student_id})
          </div>
        )}
      </div>

      <div onSubmit={handleSubmit}>
        <div style={styles.fieldset}>
          <div style={styles.legend}>Document Information</div>
          
          <div style={styles.formGroup}>
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
            <div style={styles.documentNote}>
              * Required documents for TESDA scholarship applications
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Document File<span style={styles.required}>*</span>
            </label>
            <input
              type="file"
              style={styles.fileInput}
              onChange={handleFileChange}
              disabled={loading}
              accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx"
              required
            />
            <div style={styles.documentNote}>
              Supported formats: JPEG, PNG, PDF, DOC, DOCX, XLS, XLSX (Max 10MB)
            </div>
            {selectedFile && (
              <div style={styles.fileInfo}>
                Selected file: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Notes (Optional)</label>
            <textarea
              name="notes"
              style={styles.textarea}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add any additional notes about this document..."
              disabled={loading}
            />
          </div>
        </div>

        <button type="submit" style={styles.button} disabled={loading} onClick={handleSubmit}>
          {loading ? 'Uploading Document...' : 'Upload Document'}
        </button>
      </div>

      <div style={styles.fieldset}>
        <div style={styles.legend}>TESDA Scholarship Requirements</div>
        <div style={{ fontSize: '14px', color: colors.black, lineHeight: '1.6' }}>
          <strong>Required Documents:</strong>
          <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
            <li>TESDA Application Form (duly accomplished)</li>
            <li>Birth Certificate (PSA or NSO photocopy)</li>
            <li>Valid ID (government-issued or school ID)</li>
            <li>2 pcs. Passport-size photos (white background with name tag)</li>
            <li>High School or College Diploma (or Form 137/Transcript)</li>
          </ul>
          <strong style={{ marginTop: '15px', display: 'block' }}>Additional Documents (if applicable):</strong>
          <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
            <li>Barangay Clearance or Certificate of Indigency (for scholarship)</li>
            <li>Medical Certificate (for courses requiring physical fitness)</li>
            <li>Certificate of Good Moral Character</li>
            <li>Marriage Certificate (if name has changed)</li>
            <li>NBI or Police Clearance (for courses with industry immersion)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AddDocument;