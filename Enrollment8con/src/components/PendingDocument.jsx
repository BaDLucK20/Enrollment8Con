import { useState, useEffect, useCallback } from 'react';

const PendingDocument = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [processingDoc, setProcessingDoc] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState(false);
  const [documentUrl, setDocumentUrl] = useState('');

  // Updated color palette to match PaymentHistory
  const colors = {
    darkGreen: '#2d4a3d',
    lightGreen: '#7a9b8a', 
    dustyRose: '#c19a9a',
    coral: '#d85c5c',
    red: '#d63447',
    cream: '#f5f2e8',
    olive: '#6b7c5c',
    black: '#2c2c2c',
    white: '#ffffff',
    lightGray: '#f3f4f6',
    gray: '#9ca3af',
    darkGray: '#4b5563'
  };

  const CheckIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );

  const XIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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

  const EyeIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );

  const RefreshIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );

  const FilterIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );

  const LoadingSpinner = ({ size = 20 }) => (
    <svg width={size} height={size} className="animate-spin" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found');
        return;
      }

      let url = 'http://localhost:3000/api/documents';
      const params = new URLSearchParams();
      
      if (filter !== 'all') {
        params.append('verification_status', filter);
      }
      
      if (searchTerm) {
        params.append('student_search', searchTerm);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [filter, searchTerm]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleVerifyDocument = async (documentId, status, notes) => {
    setProcessingDoc(documentId);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`http://localhost:3000/api/documents/${documentId}/verify`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          verification_status: status,
          verification_notes: notes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to verify document');
      }

      setSuccess(`Document ${status === 'verified' ? 'verified' : status === 'rejected' ? 'rejected' : 'marked for update'} successfully`);
      setSelectedDocument(null);
      setVerificationStatus('');
      setVerificationNotes('');
      fetchDocuments();
    } catch (error) {
      setError(error.message);
    } finally {
      setProcessingDoc(null);
    }
  };

  const handleViewDocument = (document) => {
    // Ensure proper URL construction
    const baseUrl = 'http://localhost:3000'; // Use your backend URL
    let documentPath = document.file_path || document.stored_filename;
    
    if (documentPath.startsWith('/')) {
      documentPath = documentPath.substring(1);
    }
    
    // If the path doesn't start with 'uploads/', add it
    if (!documentPath.startsWith('uploads/')) {
      documentPath = `uploads/documents/${documentPath}`;
    }
    
    const fullUrl = `${baseUrl}/${documentPath}`;
    console.log('Document URL:', fullUrl); // Debug log
    
    setDocumentUrl(fullUrl);
    setViewMode(true);
    setSelectedDocument(document);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified':
        return colors.lightGreen;
      case 'pending':
        return colors.coral;
      // case 'rejected':
      //   return colors.red;
      case 'requires_update':
        return colors.dustyRose;
      default:
        return colors.olive;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'verified':
        return <CheckIcon />;
      // case 'rejected':
      //   return <XIcon />;
      case 'pending':
      case 'requires_update':
        return <ClockIcon />;
      default:
        return <DocumentIcon />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate statistics
  const pendingCount = documents.filter(d => d.verification_status === 'pending').length;
  const verifiedCount = documents.filter(d => d.verification_status === 'verified').length;
  // const rejectedCount = documents.filter(d => d.verification_status === 'rejected').length;
  const requiresUpdateCount = documents.filter(d => d.verification_status === 'requires_update').length;

  const styles = {
    container: {
      padding: '24px',
      backgroundColor: colors.cream,
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    },

    header: {
      backgroundColor: colors.white,
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
      border: '1px solid #e2e8f0'
    },

    title: {
      fontSize: '28px',
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

    // Statistics Section
    statsCard: {
      backgroundColor: colors.white,
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

    // Controls Section
    controlsSection: {
      backgroundColor: colors.white,
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '24px',
      border: '1px solid #e2e8f0'
    },

    controlsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '16px',
      marginBottom: '16px',
      '@media (max-width: 768px)': {
        gridTemplateColumns: '1fr'
      }
    },

    filterGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },

    filterLabel: {
      fontSize: '14px',
      fontWeight: '500',
      color: colors.black
    },

    filterButtons: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      padding: '4px',
      backgroundColor: colors.lightGray,
      borderRadius: '8px'
    },

    filterButton: {
      padding: '8px 16px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.15s ease-in-out',
      backgroundColor: 'transparent',
      color: colors.black
    },

    filterButtonActive: {
      backgroundColor: colors.darkGreen,
      color: colors.white
    },

    searchInput: {
      padding: '10px 12px',
      border: `1px solid ${colors.lightGreen}`,
      borderRadius: '6px',
      fontSize: '14px',
      outline: 'none',
      width: '100%'
    },

    refreshButton: {
      padding: '10px 16px',
      border: `1px solid ${colors.lightGreen}`,
      borderRadius: '6px',
      backgroundColor: colors.white,
      color: colors.black,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      fontWeight: '500',
      width: 'fit-content'
    },

    // Alerts
    alert: {
      marginBottom: '24px',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },

    alertError: {
      backgroundColor: '#fee2e2',
      borderColor: colors.red,
      color: colors.red
    },

    alertSuccess: {
      backgroundColor: '#d1fae5',
      borderColor: colors.lightGreen,
      color: colors.darkGreen
    },

    // Table Styles
    tableContainer: {
      backgroundColor: colors.white,
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #e2e8f0'
    },

    tableHeader: {
      backgroundColor: colors.darkGreen,
      color: colors.white,
      padding: '16px 20px',
      fontSize: '18px',
      fontWeight: 'bold'
    },

    tableWrapper: {
      overflowX: 'auto'
    },

    table: {
      width: '100%',
      borderCollapse: 'collapse',
      minWidth: '800px'
    },

    tableHeaderRow: {
      backgroundColor: colors.lightGreen
    },

    tableHeaderCell: {
      padding: '12px 16px',
      textAlign: 'left',
      fontSize: '14px',
      fontWeight: '600',
      color: colors.white,
      whiteSpace: 'nowrap'
    },

    tableRow: {
      borderBottom: '1px solid #e2e8f0',
      '&:hover': {
        backgroundColor: colors.cream
      }
    },

    tableCell: {
      padding: '12px 16px',
      fontSize: '14px',
      color: colors.black,
      verticalAlign: 'top'
    },

    statusBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '500',
      gap: '4px',
      color: colors.white,
      textTransform: 'uppercase'
    },

    actionButton: {
      padding: '6px 12px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.15s ease-in-out',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      margin: '0 2px 4px 0'
    },

    viewButton: {
      backgroundColor: colors.dustyRose,
      color: colors.white
    },

    verifyButton: {
      backgroundColor: colors.lightGreen,
      color: colors.white
    },

    rejectButton: {
      backgroundColor: colors.red,
      color: colors.white
    },

    // Modal Styles
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
      padding: '16px'
    },

    modalContent: {
      backgroundColor: colors.white,
      borderRadius: '12px',
      maxWidth: '600px',
      width: '100%',
      maxHeight: '90vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    },

    modalHeader: {
      padding: '24px 24px 16px',
      borderBottom: `1px solid #e2e8f0`
    },

    modalTitle: {
      fontSize: '20px',
      fontWeight: '600',
      color: colors.black,
      marginBottom: '8px'
    },

    modalSubtitle: {
      fontSize: '14px',
      color: colors.olive,
      margin: 0
    },

    modalBody: {
      padding: '24px',
      flex: 1,
      overflow: 'auto'
    },

    modalFooter: {
      padding: '16px 24px',
      borderTop: `1px solid #e2e8f0`,
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
      flexWrap: 'wrap'
    },

    formGroup: {
      marginBottom: '16px'
    },

    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      color: colors.black,
      marginBottom: '8px'
    },

    select: {
      width: '100%',
      padding: '10px 12px',
      border: `1px solid ${colors.lightGreen}`,
      borderRadius: '6px',
      fontSize: '14px',
      outline: 'none',
      backgroundColor: colors.white
    },

    textarea: {
      width: '100%',
      padding: '10px 12px',
      border: `1px solid ${colors.lightGreen}`,
      borderRadius: '6px',
      fontSize: '14px',
      minHeight: '100px',
      resize: 'vertical',
      outline: 'none',
      fontFamily: 'inherit'
    },

    button: {
      padding: '10px 20px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.15s ease-in-out',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },

    primaryButton: {
      backgroundColor: colors.darkGreen,
      color: colors.white
    },

    secondaryButton: {
      backgroundColor: colors.lightGray,
      color: colors.black
    },

    closeButton: {
      backgroundColor: colors.red,
      color: colors.white
    },

    documentViewer: {
      width: '100%',
      height: '400px',
      border: `1px solid ${colors.lightGreen}`,
      borderRadius: '6px',
      backgroundColor: colors.cream
    },

    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: `1px solid #e2e8f0`,
      flexWrap: 'wrap',
      gap: '8px'
    },

    infoLabel: {
      fontSize: '14px',
      color: colors.olive,
      fontWeight: '500'
    },

    infoValue: {
      fontSize: '14px',
      color: colors.black,
      fontWeight: '500'
    },

    emptyState: {
      textAlign: 'center',
      padding: '64px 24px',
      color: colors.olive
    },

    loadingContainer: {
      textAlign: 'center',
      padding: '64px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px'
    },

    // Responsive styles
    '@media (max-width: 768px)': {
      container: {
        padding: '16px'
      },
      
      header: {
        padding: '16px'
      },

      title: {
        fontSize: '24px'
      },

      statsGrid: {
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))'
      },

      statValue: {
        fontSize: '20px'
      },

      controlsGrid: {
        gridTemplateColumns: '1fr'
      },

      filterButtons: {
        justifyContent: 'center'
      },

      modalContent: {
        margin: '16px',
        maxHeight: 'calc(100vh - 32px)'
      },

      modalFooter: {
        flexDirection: 'column'
      }
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Document Verification</h1>
        <p style={styles.subtitle}>Review and verify student documents for TESDA requirements</p>
      </div>

      {/* Statistics Card */}
      <div style={styles.statsCard}>
        <div style={styles.statsGrid}>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{pendingCount}</div>
            <div style={styles.statLabel}>Pending Documents</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{verifiedCount}</div>
            <div style={styles.statLabel}>Verified Documents</div>
          </div>
          {/* <div style={styles.statItem}>
            <div style={styles.statValue}>{rejectedCount}</div>
            <div style={styles.statLabel}>Rejected Documents</div>
          </div> */}
          <div style={styles.statItem}>
            <div style={styles.statValue}>{requiresUpdateCount}</div>
            <div style={styles.statLabel}>Requires Update</div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ ...styles.alert, ...styles.alertError }}>
          <XIcon />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{ ...styles.alert, ...styles.alertSuccess }}>
          <CheckIcon />
          <span>{success}</span>
        </div>
      )}

      {/* Controls */}
      <div style={styles.controlsSection}>
        <div style={styles.controlsGrid}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Filter by Status</label>
            <div style={styles.filterButtons}>
              {['all', 'pending', 'verified'].map((status) => (
                <button
                  key={status}
                  style={{
                    ...styles.filterButton,
                    ...(filter === status ? styles.filterButtonActive : {})
                  }}
                  onClick={() => setFilter(status)}
                >
                  <FilterIcon size={14} />
                  {status === 'requires_update' ? 'Needs Update' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Search Documents</label>
            <input
              type="text"
              style={styles.searchInput}
              placeholder="Search by student name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Actions</label>
            <button
              style={styles.refreshButton}
              onClick={fetchDocuments}
              disabled={loading}
            >
              <RefreshIcon />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div style={styles.tableContainer}>
        <div style={styles.tableHeader}>
          Document Verification {filter !== 'all' ? `(${filter.charAt(0).toUpperCase() + filter.slice(1)})` : '(All Documents)'}
        </div>
        
        <div style={styles.tableWrapper}>
          {loading ? (
            <div style={styles.loadingContainer}>
              <LoadingSpinner size={32} />
              <p style={{ color: colors.olive }}>Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div style={styles.emptyState}>
              <DocumentIcon size={48} />
              <p style={{ marginTop: '16px', fontSize: '18px', fontWeight: '500' }}>No documents found</p>
              <p style={{ marginTop: '8px', fontSize: '14px', color: colors.olive }}>
                Try adjusting your filters or search criteria
              </p>
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.tableHeaderCell}>Student</th>
                  <th style={styles.tableHeaderCell}>Document Type</th>
                  <th style={styles.tableHeaderCell}>Upload Date</th>
                  <th style={styles.tableHeaderCell}>Status</th>
                  <th style={styles.tableHeaderCell}>Verified By</th>
                  <th style={styles.tableHeaderCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.document_id} style={styles.tableRow}>
                    <td style={styles.tableCell}>
                      <div>
                        <div style={{ fontWeight: '500' }}>{doc.first_name} {doc.last_name}</div>
                        <div style={{ fontSize: '12px', color: colors.olive }}>
                          ID: {doc.student_id}
                        </div>
                      </div>
                    </td>
                    <td style={styles.tableCell}>
                      <div>{doc.document_type}</div>
                      {doc.is_required && (
                        <div style={{ fontSize: '12px', color: colors.red, fontWeight: '500' }}>
                          Required
                        </div>
                      )}
                    </td>
                    <td style={styles.tableCell}>
                      <div style={{ fontSize: '14px' }}>{formatDate(doc.upload_date)}</div>
                    </td>
                    <td style={styles.tableCell}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          backgroundColor: getStatusColor(doc.verification_status)
                        }}
                      >
                        {getStatusIcon(doc.verification_status)}
                        <span>
                          {doc.verification_status === 'requires_update' ? 'Needs Update' : doc.verification_status}
                        </span>
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      {doc.verified_by_first_name ? (
                        <div>
                          <div style={{ fontSize: '14px' }}>
                            {doc.verified_by_first_name} {doc.verified_by_last_name}
                          </div>
                          {doc.verified_date && (
                            <div style={{ fontSize: '12px', color: colors.olive }}>
                              {formatDate(doc.verified_date)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: colors.gray }}>-</span>
                      )}
                    </td>
                    <td style={styles.tableCell}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        <button
                          style={{ ...styles.actionButton, ...styles.viewButton }}
                          onClick={() => handleViewDocument(doc)}
                        >
                          <EyeIcon size={14} />
                          View
                        </button>
                        {doc.verification_status === 'pending' && (
                          <>
                            <button
                              style={{ ...styles.actionButton, ...styles.verifyButton }}
                              onClick={() => {
                                setSelectedDocument(doc);
                                setVerificationStatus('verified');
                                setViewMode(false);
                              }}
                              disabled={processingDoc === doc.document_id}
                            >
                              <CheckIcon size={14} />
                              Verify
                            </button>
                            {/* <button
                              style={{ ...styles.actionButton, ...styles.rejectButton }}
                              onClick={() => {
                                setSelectedDocument(doc);
                                setVerificationStatus('rejected');
                                setViewMode(false);
                              }}
                              disabled={processingDoc === doc.document_id}
                            >
                              <XIcon size={14} />
                              Reject
                            </button> */}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Verification Modal */}
      {selectedDocument && !viewMode && (
        <div style={styles.modal} onClick={() => setSelectedDocument(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {verificationStatus === 'verified' ? 'Verify' : 'Reject'} Document
              </h2>
              <p style={styles.modalSubtitle}>
                Review document for {selectedDocument.first_name} {selectedDocument.last_name}
              </p>
            </div>

            <div style={styles.modalBody}>
              <div style={{ marginBottom: '24px' }}>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Document Type:</span>
                  <span style={styles.infoValue}>{selectedDocument.document_type}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>File Name:</span>
                  <span style={styles.infoValue}>{selectedDocument.original_filename}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Upload Date:</span>
                  <span style={styles.infoValue}>{formatDate(selectedDocument.upload_date)}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Student ID:</span>
                  <span style={styles.infoValue}>{selectedDocument.student_id}</span>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Verification Status</label>
                <select
                  style={styles.select}
                  value={verificationStatus}
                  onChange={(e) => setVerificationStatus(e.target.value)}
                >
                  <option value="verified">Verified - Document is valid</option>
                  {/* <option value="rejected">Rejected - Document is invalid</option> */}
                  <option value="requires_update">Requires Update - Needs resubmission</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Verification Notes {verificationStatus !== 'verified' && '(Required)'}
                </label>
                <textarea
                  style={styles.textarea}
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder={
                    verificationStatus === 'verified' 
                      ? 'Optional: Add any notes about this document...'
                      : 'Please provide a reason for rejection or what needs to be updated...'
                  }
                  required={verificationStatus !== 'verified'}
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={() => {
                  setSelectedDocument(null);
                  setVerificationStatus('');
                  setVerificationNotes('');
                }}
              >
                Cancel
              </button>
              <button
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={() => {
                  if (verificationStatus !== 'verified' && !verificationNotes.trim()) {
                    setError('Please provide verification notes for rejection or update request');
                    return;
                  }
                  handleVerifyDocument(
                    selectedDocument.document_id,
                    verificationStatus,
                    verificationNotes
                  );
                }}
                disabled={processingDoc === selectedDocument.document_id}
              >
                {processingDoc === selectedDocument.document_id ? (
                  <>
                    <LoadingSpinner size={16} />
                    Processing...
                  </>
                ) : (
                  `${verificationStatus === 'verified' ? 'Verify' : verificationStatus === 'rejected' ? 'Reject' : 'Request Update'}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && viewMode && (
        <div style={styles.modal} onClick={() => {
          setSelectedDocument(null);
          setViewMode(false);
          setDocumentUrl('');
        }}>
          <div style={{...styles.modalContent, maxWidth: '90vw', maxHeight: '90vh'}} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>View Document</h2>
              <p style={styles.modalSubtitle}>
                {selectedDocument.document_type} - {selectedDocument.first_name} {selectedDocument.last_name}
              </p>
            </div>

            <div style={styles.modalBody}>
              <div style={{ marginBottom: '16px' }}>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>File Name:</span>
                  <span style={styles.infoValue}>{selectedDocument.original_filename}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Upload Date:</span>
                  <span style={styles.infoValue}>{formatDate(selectedDocument.upload_date)}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Current Status:</span>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: getStatusColor(selectedDocument.verification_status),
                      display: 'inline-flex',
                    }}
                  >
                    {getStatusIcon(selectedDocument.verification_status)}
                    <span style={{ textTransform: 'capitalize' }}>
                      {selectedDocument.verification_status === 'requires_update' ? 'Needs Update' : selectedDocument.verification_status}
                    </span>
                  </span>
                </div>
              </div>

              {/* Document Preview */}
              <div style={{ marginTop: '16px' }}>
                <label style={styles.label}>Document Preview</label>
                {(() => {
                  const filename = selectedDocument.original_filename?.toLowerCase() || '';
                  const isPDF = filename.endsWith('.pdf');
                  const isImage = filename.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/);
                  const isText = filename.match(/\.(txt|log|csv)$/);
                  
                  if (isPDF) {
                    return (
                      <iframe
                        src={documentUrl}
                        style={{
                          width: '100%',
                          height: '600px',
                          border: `1px solid ${colors.lightGreen}`,
                          borderRadius: '6px',
                          backgroundColor: colors.white
                        }}
                        title="Document Preview"
                        onLoad={() => console.log('PDF loaded successfully')}
                        onError={() => console.error('Error loading PDF')}
                      />
                    );
                  } else if (isImage) {
                    return (
                      <div style={{ 
                        width: '100%', 
                        maxHeight: '600px', 
                        overflow: 'auto',
                        border: `1px solid ${colors.lightGreen}`,
                        borderRadius: '6px',
                        backgroundColor: colors.cream,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                      }}>
                        <img
                          src={documentUrl}
                          alt="Document Preview"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = `
                              <div style="padding: 40px; text-align: center; color: ${colors.olive};">
                                <p style="font-size: 18px; margin-bottom: 10px;">Unable to preview image</p>
                                <p style="font-size: 14px;">The image may be corrupted or in an unsupported format.</p>
                              </div>
                            `;
                          }}
                        />
                      </div>
                    );
                  } else if (isText) {
                    return (
                      <div style={{
                        width: '100%',
                        height: '400px',
                        border: `1px solid ${colors.lightGreen}`,
                        borderRadius: '6px',
                        backgroundColor: colors.white,
                        padding: '20px',
                        overflow: 'auto'
                      }}>
                        <iframe
                          src={documentUrl}
                          style={{
                            width: '100%',
                            height: '100%',
                            border: 'none'
                          }}
                          title="Document Preview"
                        />
                      </div>
                    );
                  } else {
                    return (
                      <div style={{
                        padding: '40px',
                        textAlign: 'center',
                        color: colors.olive,
                        border: `1px solid ${colors.lightGreen}`,
                        borderRadius: '6px',
                        backgroundColor: colors.cream
                      }}>
                        <DocumentIcon size={48} />
                        <p style={{ marginTop: '16px', fontSize: '16px', fontWeight: '500' }}>
                          Preview not available for this file type
                        </p>
                        <p style={{ marginTop: '8px', fontSize: '14px' }}>
                          File type: {filename.split('.').pop()?.toUpperCase() || 'Unknown'}
                        </p>
                      </div>
                    );
                  }
                })()}
                
                <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={selectedDocument.original_filename}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      backgroundColor: colors.darkGreen,
                      color: colors.white,
                      fontSize: '14px',
                      textDecoration: 'none',
                      fontWeight: '500',
                      borderRadius: '6px',
                      transition: 'all 0.15s ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = colors.olive;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = colors.darkGreen;
                    }}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Document
                  </a>
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      backgroundColor: colors.white,
                      color: colors.darkGreen,
                      fontSize: '14px',
                      textDecoration: 'none',
                      fontWeight: '500',
                      borderRadius: '6px',
                      border: `1px solid ${colors.darkGreen}`,
                      transition: 'all 0.15s ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = colors.cream;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = colors.white;
                    }}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in New Tab
                  </a>
                </div>
                
                {selectedDocument.verification_notes && (
                  <div style={{ 
                    marginTop: '20px',
                    padding: '16px',
                    backgroundColor: colors.cream,
                    borderRadius: '6px',
                    border: `1px solid ${colors.lightGreen}`
                  }}>
                    <label style={{...styles.label, marginBottom: '8px'}}>Verification Notes</label>
                    <p style={{ fontSize: '14px', color: colors.black, margin: 0 }}>
                      {selectedDocument.verification_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                style={{ ...styles.button, ...styles.closeButton }}
                onClick={() => {
                  setSelectedDocument(null);
                  setViewMode(false);
                  setDocumentUrl('');
                }}
              >
                <XIcon size={16} />
                Close
              </button>
              {selectedDocument.verification_status === 'pending' && (
                <>
                  <button
                    style={{ ...styles.button, ...styles.verifyButton }}
                    onClick={() => {
                      setVerificationStatus('verified');
                      setViewMode(false);
                    }}
                  >
                    <CheckIcon size={16} />
                    Verify Document
                  </button>
                  <button
                    style={{ ...styles.button, ...styles.rejectButton }}
                    onClick={() => {
                      setVerificationStatus('rejected');
                      setViewMode(false);
                    }}
                  >
                    <XIcon size={16} />
                    Reject Document
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSS for animations and responsive design */}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        
        .opacity-25 {
          opacity: 0.25;
        }
        
        .opacity-75 {
          opacity: 0.75;
        }

        /* Responsive table hover effects */
        tbody tr:hover {
          background-color: ${colors.cream} !important;
        }

        /* Mobile responsive adjustments */
        @media (max-width: 768px) {
          .table-responsive {
            font-size: 12px;
          }
          
          .action-buttons {
            flex-direction: column;
            gap: 4px;
          }
          
          .modal-content {
            margin: 16px;
            max-height: calc(100vh - 32px);
          }
          
          .modal-footer {
            flex-direction: column-reverse;
          }
          
          .modal-footer button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .filter-buttons {
            justify-content: center;
            flex-wrap: wrap;
          }
          
          .filter-button {
            flex: 1;
            min-width: 120px;
          }
        }

        /* Button hover effects */
        button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        button:active:not(:disabled) {
          transform: translateY(0);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Input focus effects */
        input:focus, select:focus, textarea:focus {
          border-color: ${colors.darkGreen};
          box-shadow: 0 0 0 2px ${colors.darkGreen}20;
        }

        /* Smooth transitions */
        * {
          transition: all 0.15s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default PendingDocument;