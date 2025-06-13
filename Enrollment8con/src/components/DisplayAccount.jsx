import { useState, useEffect } from 'react';

const DisplayAccount = () => {
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('students');

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

  useEffect(() => { fetchAccounts(); }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      
      // Check for token first
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Call both sub-fetches with Promise.all for better error handling
      await Promise.all([
        fetchStudents(headers),
        fetchStaff(headers)
      ]);

    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (headers) => {
    try {
      console.log('Fetching students...');
      const response = await fetch('http://localhost:3000/api/students', { headers });

      if (!response.ok) {
        throw new Error(`Failed to fetch students: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Students data:', data);
      
      // Ensure data is an array
      if (Array.isArray(data)) {
        setStudents(data);
      } else {
        console.warn('Students data is not an array:', data);
        setStudents([]);
      }
    } catch (err) {
      console.error('Error in fetchStudents:', err);
      throw err; // Re-throw to be caught by main function
    }
  };

  const fetchStaff = async (headers) => {
    try {
      console.log('Fetching staff...');
      const response = await fetch('http://localhost:3000/api/admin/staff', { headers });

      if (!response.ok) {
        throw new Error(`Failed to fetch staff: ${response.status} ${response.statusText}`);
      }

      const accounts = await response.json();
      console.log('staff accounts:', accounts);

      // Ensure accounts is an array before processing
      if (Array.isArray(accounts)) {
        // Transform nested data to flat structure for display
        const staffData = accounts.map(account => ({
          // Use nested person data
          first_name: account.person?.first_name || account.first_name,
          last_name: account.person?.last_name || account.last_name,
          middle_name: account.person?.middle_name || account.middle_name,
          birth_date: account.person?.birth_date || account.birth_date,
          gender: account.person?.gender || account.gender,
          email: account.person?.email || account.email,
          
          // Use nested account data
          account_id: account.account?.account_id || account.account_id,
          username: account.account?.username || account.username,
          account_status: account.account?.account_status || account.account_status,
          last_login: account.account?.last_login || account.last_login,
          role_name: account.account?.role || account.role_name,
          
          // Staff specific data
          staff_id: account.staff_id,
          employee_id: account.employee_id,
          hire_date: account.hire_date,
          
          // Contact info
          primary_email: account.contact?.primary_email,
          phone_numbers: account.contact?.phone_numbers,
          
          // Add a unique identifier for React keys
          user_identifier: account.staff_id || account.employee_id || account.account?.account_id || account.account_id
        }));
        
        console.log('Transformed staff data:', staffData);
        setStaff(staffData);
      } else {
        console.warn('Staff accounts data is not an array:', accounts);
        setStaff([]);
      }
    } catch (err) {
      console.error('Error in fetchStaff:', err);
      throw err; // Re-throw to be caught by main function
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
      staff: '#17a2b8'
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
    },
    loading: {
      textAlign: 'center',
      padding: '40px',
      fontSize: '18px',
      color: colors.olive,
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
    refreshButton: {
      backgroundColor: colors.coral,
      color: 'white',
      border: 'none',
      padding: '10px 20px',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '14px',
      marginBottom: '20px',
      transition: 'background-color 0.2s ease',
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading accounts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Error: {error}</div>
        <button 
          style={styles.refreshButton} 
          onClick={fetchAccounts}
          onMouseOver={(e) => e.target.style.backgroundColor = colors.dustyRose}
          onMouseOut={(e) => e.target.style.backgroundColor = colors.coral}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Account Management</h1>
      
      <button 
        style={styles.refreshButton} 
        onClick={fetchAccounts}
        onMouseOver={(e) => e.target.style.backgroundColor = colors.dustyRose}
        onMouseOut={(e) => e.target.style.backgroundColor = colors.coral}
      >
        Refresh Data
      </button>

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
              No students registered yet.
            </div>
          ) : (
            <div style={styles.accountsGrid}>
              {students.map((student) => (
                <div
                  key={student.student_id}
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
                      {student.first_name} {student.last_name}
                    </h3>
                    <div style={styles.accountId}>
                      ID: {student.student_id}
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
                    
                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Birth Date:</span>
                      <span style={styles.infoValue}>
                        {formatDate(student.birth_date)}
                      </span>
                    </div>
                    
                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Gender:</span>
                      <span style={styles.infoValue}>
                        {student.gender || 'N/A'}
                      </span>
                    </div>
                    
                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Enrollments:</span>
                      <span style={styles.infoValue}>
                        {student.total_enrollments || 0}
                      </span>
                    </div>
                    
                    {student.gpa && (
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>GPA:</span>
                        <span style={styles.infoValue}>
                          {student.gpa.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
              No staff members found. Check console for debugging info.
            </div>
          ) : (
            <div style={styles.accountsGrid}>
              {staff.map((member, index) => (
                <div
                  key={member.account_id || member.user_identifier || index}
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
                      ID: {member.user_identifier || member.account_id}
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
                      <span style={styles.infoLabel}>Username:</span>
                      <span style={styles.infoValue}>
                        {member.username || 'N/A'}
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
                      <span style={styles.infoLabel}>Account ID:</span>
                      <span style={styles.infoValue}>
                        {member.account_id || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DisplayAccount;