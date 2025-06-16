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
    info: '#3B82F6',
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
    // Construct the document URL based on the file path
    const baseUrl = window.location.origin;
    const documentPath = document.file_path || `uploads/documents/${document.stored_filename}`;
    setDocumentUrl(`${baseUrl}/${documentPath}`);
    setViewMode(true);
    setSelectedDocument(document);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified':
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'rejected':
        return colors.danger;
      case 'requires_update':
        return colors.info;
      default:
        return colors.gray[400];
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'verified':
        return <CheckIcon />;
      case 'rejected':
        return <XIcon />;
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
    header: {
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      padding: '24px',
      marginBottom: '24px',
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
    controls: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px',
      marginBottom: '24px',
    },
    filterGroup: {
      display: 'flex',
      backgroundColor: '#fff',
      borderRadius: '6px',
      border: `1px solid ${colors.gray[300]}`,
      overflow: 'hidden',
    },
    filterButton: {
      padding: '8px 16px',
      border: 'none',
      backgroundColor: 'transparent',
      color: colors.gray[600],
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 0.15s ease-in-out',
    },
    filterButtonActive: {
      backgroundColor: colors.primary,
      color: '#fff',
    },
    searchInput: {
      flex: 1,
      minWidth: '300px',
      padding: '8px 16px',
      border: `1px solid ${colors.gray[300]}`,
      borderRadius: '6px',
      fontSize: '14px',
      outline: 'none',
    },
    refreshButton: {
      padding: '8px 16px',
      border: `1px solid ${colors.gray[300]}`,
      borderRadius: '6px',
      backgroundColor: '#fff',
      color: colors.gray[700],
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      fontWeight: '500',
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
    table: {
      backgroundColor: '#fff',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    },
    tableWrapper: {
      overflowX: 'auto',
    },
    tableEl: {
      width: '100%',
      borderCollapse: 'collapse',
    },
    th: {
      padding: '12px 16px',
      textAlign: 'left',
      fontSize: '12px',
      fontWeight: '500',
      color: colors.gray[600],
      backgroundColor: colors.gray[50],
      borderBottom: `1px solid ${colors.gray[200]}`,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
    td: {
      padding: '16px',
      fontSize: '14px',
      color: colors.gray[900],
      borderBottom: `1px solid ${colors.gray[200]}`,
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
    actionButton: {
      padding: '6px 12px',
      border: 'none',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.15s ease-in-out',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    },
    viewButton: {
      backgroundColor: colors.gray[100],
      color: colors.gray[700],
    },
    verifyButton: {
      backgroundColor: colors.success,
      color: '#fff',
    },
    rejectButton: {
      backgroundColor: colors.danger,
      color: '#fff',
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
      maxWidth: '600px',
      width: '90%',
      maxHeight: '90vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
    modalHeader: {
      padding: '24px 24px 16px',
      borderBottom: `1px solid ${colors.gray[200]}`,
    },
    modalTitle: {
      fontSize: '20px',
      fontWeight: '600',
      color: colors.gray[900],
      marginBottom: '8px',
    },
    modalBody: {
      padding: '24px',
      flex: 1,
      overflow: 'auto',
    },
    modalFooter: {
      padding: '16px 24px',
      borderTop: `1px solid ${colors.gray[200]}`,
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
    },
    formGroup: {
      marginBottom: '16px',
    },
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      color: colors.gray[700],
      marginBottom: '8px',
    },
    select: {
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${colors.gray[300]}`,
      borderRadius: '6px',
      fontSize: '14px',
      outline: 'none',
    },
    textarea: {
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${colors.gray[300]}`,
      borderRadius: '6px',
      fontSize: '14px',
      minHeight: '100px',
      resize: 'vertical',
      outline: 'none',
    },
    button: {
      padding: '8px 16px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.15s ease-in-out',
    },
    primaryButton: {
      backgroundColor: colors.primary,
      color: '#fff',
    },
    secondaryButton: {
      backgroundColor: colors.gray[200],
      color: colors.gray[700],
    },
    documentViewer: {
      width: '100%',
      height: '400px',
      border: `1px solid ${colors.gray[300]}`,
      borderRadius: '6px',
      backgroundColor: colors.gray[50],
    },
    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: `1px solid ${colors.gray[100]}`,
    },
    infoLabel: {
      fontSize: '14px',
      color: colors.gray[600],
    },
    infoValue: {
      fontSize: '14px',
      color: colors.gray[900],
      fontWeight: '500',
    },
    emptyState: {
      textAlign: 'center',
      padding: '64px 24px',
      color: colors.gray[500],
    },
    loadingContainer: {
      textAlign: 'center',
      padding: '64px',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.maxWidth}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>Document Verification</h1>
          <p style={styles.subtitle}>Review and verify student documents for TESDA requirements</p>
        </div>

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

        {/* Controls */}
        <div style={styles.controls}>
          <div style={styles.filterGroup}>
            {['all', 'pending', 'verified', 'rejected'].map((status) => (
              <button
                key={status}
                style={{
                  ...styles.filterButton,
                  ...(filter === status ? styles.filterButtonActive : {})
                }}
                onClick={() => setFilter(status)}
              >
                {status === 'requires_update' ? 'Needs Update' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          <input
            type="text"
            style={styles.searchInput}
            placeholder="Search by student name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button
            style={styles.refreshButton}
            onClick={fetchDocuments}
            disabled={loading}
          >
            <RefreshIcon />
            Refresh
          </button>
        </div>

        {/* Documents Table */}
        <div style={styles.table}>
          <div style={styles.tableWrapper}>
            {loading ? (
              <div style={styles.loadingContainer}>
                <LoadingSpinner size={32} />
                <p style={{ marginTop: '16px', color: colors.gray[600] }}>Loading documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div style={styles.emptyState}>
                <DocumentIcon size={48} />
                <p style={{ marginTop: '16px', fontSize: '18px', fontWeight: '500' }}>No documents found</p>
                <p style={{ marginTop: '8px', fontSize: '14px', color: colors.gray[400] }}>
                  Try adjusting your filters or search criteria
                </p>
              </div>
            ) : (
              <table style={styles.tableEl}>
                <thead>
                  <tr>
                    <th style={styles.th}>Student</th>
                    <th style={styles.th}>Document Type</th>
                    <th style={styles.th}>Upload Date</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Verified By</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.document_id}>
                      <td style={styles.td}>
                        <div>
                          <p style={{ fontWeight: '500' }}>{doc.first_name} {doc.last_name}</p>
                          <p style={{ fontSize: '12px', color: colors.gray[500] }}>ID: {doc.student_id}</p>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <p>{doc.document_type}</p>
                        {doc.is_required && (
                          <span style={{ fontSize: '12px', color: colors.danger }}>Required</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <p style={{ fontSize: '14px' }}>{formatDate(doc.upload_date)}</p>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            backgroundColor: `${getStatusColor(doc.verification_status)}20`,
                            color: getStatusColor(doc.verification_status),
                          }}
                        >
                          {getStatusIcon(doc.verification_status)}
                          <span style={{ textTransform: 'capitalize' }}>
                            {doc.verification_status === 'requires_update' ? 'Needs Update' : doc.verification_status}
                          </span>
                        </span>
                      </td>
                      <td style={styles.td}>
                        {doc.verified_by_first_name ? (
                          <div>
                            <p style={{ fontSize: '14px' }}>
                              {doc.verified_by_first_name} {doc.verified_by_last_name}
                            </p>
                            {doc.verified_date && (
                              <p style={{ fontSize: '12px', color: colors.gray[500] }}>
                                {formatDate(doc.verified_date)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: colors.gray[400] }}>-</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: '8px' }}>
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
                              <button
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
                              </button>
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
                <p style={{ fontSize: '14px', color: colors.gray[600] }}>
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
                    <option value="rejected">Rejected - Document is invalid</option>
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
                      <span style={{ marginLeft: '8px' }}>Processing...</span>
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
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>View Document</h2>
                <p style={{ fontSize: '14px', color: colors.gray[600] }}>
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
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: `${getStatusColor(selectedDocument.verification_status)}20`,
                      color: getStatusColor(selectedDocument.verification_status),
                      display: 'inline-flex',
                    }}>
                      {getStatusIcon(selectedDocument.verification_status)}
                      <span style={{ textTransform: 'capitalize' }}>
                        {selectedDocument.verification_status}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Document Preview */}
                <div style={{ marginTop: '16px' }}>
                  <label style={styles.label}>Document Preview</label>
                  {selectedDocument.original_filename?.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={documentUrl}
                      style={styles.documentViewer}
                      title="Document Preview"
                    />
                  ) : (
                    <img
                      src={documentUrl}
                      alt="Document Preview"
                      style={{
                        ...styles.documentViewer,
                        objectFit: 'contain',
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.insertAdjacentHTML('afterend', 
                          '<div style="padding: 20px; text-align: center; color: #6B7280;">Unable to preview document. Click the link below to download.</div>'
                        );
                      }}
                    />
                  )}
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      marginTop: '12px',
                      color: colors.primary,
                      fontSize: '14px',
                      textDecoration: 'none',
                    }}
                  >
                    Open document in new tab →
                  </a>
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  style={{ ...styles.button, ...styles.secondaryButton }}
                  onClick={() => {
                    setSelectedDocument(null);
                    setViewMode(false);
                    setDocumentUrl('');
                  }}
                >
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
                      <span style={{ marginLeft: '8px' }}>Verify Document</span>
                    </button>
                    <button
                      style={{ ...styles.button, ...styles.rejectButton }}
                      onClick={() => {
                        setVerificationStatus('rejected');
                        setViewMode(false);
                      }}
                    >
                      <XIcon size={16} />
                      <span style={{ marginLeft: '8px' }}>Reject Document</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inline styles for animations */}
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
      `}</style>
    </div>
  );
};

export default PendingDocument