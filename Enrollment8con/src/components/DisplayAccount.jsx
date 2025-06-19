import { useState, useEffect } from 'react';

const DisplayAccount = () => {
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('students');
  const [modalData, setModalData] = useState(null);
  const [modalType, setModalType] = useState(null); // 'student' or 'staff'

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
    fetchAccounts(); 
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
      
      // Fetch students and staff data concurrently
      const [studentsResult, staffResult] = await Promise.allSettled([
        makeAuthenticatedRequest(`http://localhost:3000/api/students`),
        makeAuthenticatedRequest(`http://localhost:3000/api/admin/staff`)
      ]);

      // Handle students data
      if (studentsResult.status === 'fulfilled') {
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
      maxWidth: '1200px',
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
    tabContainer: {
      display: 'flex',
      marginBottom: '30px',
      borderBottom: '2px solid #e9ecef',
    },
    tab: {
      padding: '12px 24px',
      backgroundColor: 'transparent',
      border: 'none',
      borderRadius: '4px 4px 0 0',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: 'bold',
      transition: 'all 0.3s ease',
      marginRight: '4px',
    },
    activeTab: {
      backgroundColor: colors.darkGreen,
      color: 'white',
    },
    inactiveTab: {
      backgroundColor: '#f8f9fa',
      color: colors.black,
    },
    error: {
      color: colors.red,
      textAlign: 'center',
      padding: '20px',
      backgroundColor: '#ffebee',
      borderRadius: '4px',
      border: `1px solid ${colors.red}`,
      marginBottom: '20px',
    },
    warning: {
      color: '#856404',
      textAlign: 'center',
      padding: '15px',
      backgroundColor: '#fff3cd',
      borderRadius: '4px',
      border: '1px solid #ffeaa7',
      marginBottom: '20px',
    },
    loading: {
      textAlign: 'center',
      padding: '40px',
      fontSize: '18px',
      color: colors.olive,
    },
    refreshButton: {
      backgroundColor: colors.lightGreen,
      color: 'white',
      border: 'none',
      padding: '10px 20px',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '14px',
      marginLeft: '10px',
      transition: 'background-color 0.2s ease',
    },
    accountsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
      gap: '20px',
      marginTop: '20px',
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
    sectionTitle: {
      fontSize: '20px',
      fontWeight: 'bold',
      color: colors.darkGreen,
      marginBottom: '10px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    count: {
      backgroundColor: colors.coral,
      color: 'white',
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 'bold',
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px',
      color: colors.olive,
      fontSize: '16px',
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
    // Modal styles
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
        <div style={styles.loading}>Loading accounts...</div>
      </div>
    );
  }

  if (error && (students.length === 0 && staff.length === 0)) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          {error}
          <br />
          <button 
            style={styles.refreshButton}
            onClick={fetchAccounts}
            onMouseOver={(e) => e.target.style.backgroundColor = colors.darkGreen}
            onMouseOut={(e) => e.target.style.backgroundColor = colors.lightGreen}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>
        Account Management
      </h1>
      
      {/* Show warning if there was a partial error */}
      {error && (students.length > 0 || staff.length > 0) && (
        <div style={styles.warning}>{error}</div>
      )}

      <div style={styles.tabContainer}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'students' ? styles.activeTab : styles.inactiveTab)
          }}
          onClick={() => setActiveTab('students')}
        >
          Students ({students.length})
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'staff' ? styles.activeTab : styles.inactiveTab)
          }}
          onClick={() => setActiveTab('staff')}
        >
          Staff ({staff.length})
        </button>
      </div>

      {activeTab === 'students' && (
        <div>
          <div style={styles.sectionTitle}>
            Students
            <span style={styles.count}>{students.length}</span>
          </div>
          
          {students.length === 0 ? (
            <div style={styles.emptyState}>
              No students data available. This could be due to access restrictions or empty database.
            </div>
          ) : (
            <div style={styles.accountsGrid}>
              {students.map((student, index) => {
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

      {activeTab === 'staff' && (
        <div>
          <div style={styles.sectionTitle}>
            Staff
            <span style={styles.count}>{staff.length}</span>
          </div>
          {staff.length === 0 ? (
            <div style={styles.emptyState}>
              No staff data available. This could be due to insufficient admin privileges or empty database.
            </div>
          ) : (
            <div style={styles.accountsGrid}>
              {staff.map((member, index) => {
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