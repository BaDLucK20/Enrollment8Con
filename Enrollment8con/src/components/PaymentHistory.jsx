import { useState, useEffect } from 'react'
import { Search, Filter, Eye, Calendar, DollarSign, User, Phone, Mail, ChevronDown, ChevronUp, FileText, Download, X, AlertCircle } from 'lucide-react'

const PaymentHistory = () => {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filteredPayments, setFilteredPayments] = useState([])
  const [filters, setFilters] = useState({
    name: '',
    sortOrder: 'ascending',
    paymentStatus: 'all',
    dateRange: 'all'
  })
  const [showFilters, setShowFilters] = useState(false)
  const [viewingPayment, setViewingPayment] = useState(null)
  const [viewingReceipts, setViewingReceipts] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [entriesPerPage] = useState(10)

  // Color palette from the dashboard
  const colors = {
    darkGreen: '#2d4a3d',
    lightGreen: '#7a9b8a', 
    dustyRose: '#c19a9a',
    coral: '#d85c5c',
    red: '#d63447',
    cream: '#f5f2e8',
    olive: '#6b7c5c',
    black: '#2c2c2c'
  }

  // Fetch payments from server
  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch('http://localhost:3000/api/payments', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch payments')
      }

      const data = await response.json()
      
      // Transform the data to match the component's expected format
      const transformedPayments = data.map(payment => ({
        id: payment.payment_id,
        studentId: payment.student_id,
        studentName: `${payment.first_name} ${payment.last_name}`,
        course: payment.course_name,
        batch: payment.batch_identifier,
        amount: parseFloat(payment.payment_amount),
        processingFee: parseFloat(payment.processing_fee || 0),
        totalDue: parseFloat(payment.total_due),
        balance: parseFloat(payment.balance),
        paymentDate: payment.payment_date,
        status: payment.payment_status,
        paymentMethod: payment.method_name,
        referenceNumber: payment.reference_number,
        // Note: The current schema doesn't have receipts, but we'll add placeholder
        receipts: []
      }))

      setPayments(transformedPayments)
      setFilteredPayments(transformedPayments)
    } catch (err) {
      console.error('Error fetching payments:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch student payment history (for a specific student)
  const fetchStudentPayments = async (studentId) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:3000/api/students/${studentId}/payments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch student payments')
      }

      const data = await response.json()
      return data
    } catch (err) {
      console.error('Error fetching student payments:', err)
      return []
    }
  }

  // Apply filters
  useEffect(() => {
    let filtered = [...payments]

    // Filter by name
    if (filters.name) {
      filtered = filtered.filter(payment => 
        payment.studentName.toLowerCase().includes(filters.name.toLowerCase()) ||
        payment.studentId.toLowerCase().includes(filters.name.toLowerCase())
      )
    }

    // Filter by payment status
    if (filters.paymentStatus !== 'all') {
      filtered = filtered.filter(payment => payment.status === filters.paymentStatus)
    }

    // Filter by date range
    if (filters.dateRange !== 'all') {
      const now = new Date()
      const filterDate = new Date()
      
      switch(filters.dateRange) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0)
          filtered = filtered.filter(payment => 
            new Date(payment.paymentDate) >= filterDate
          )
          break
        case 'week':
          filterDate.setDate(now.getDate() - 7)
          filtered = filtered.filter(payment => 
            new Date(payment.paymentDate) >= filterDate
          )
          break
        case 'month':
          filterDate.setMonth(now.getMonth() - 1)
          filtered = filtered.filter(payment => 
            new Date(payment.paymentDate) >= filterDate
          )
          break
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1)
          filtered = filtered.filter(payment => 
            new Date(payment.paymentDate) >= filterDate
          )
          break
      }
    }

    // Sort by name or date
    filtered.sort((a, b) => {
      if (filters.sortBy === 'date') {
        const comparison = new Date(b.paymentDate) - new Date(a.paymentDate)
        return filters.sortOrder === 'ascending' ? -comparison : comparison
      } else {
        const comparison = a.studentName.localeCompare(b.studentName)
        return filters.sortOrder === 'ascending' ? comparison : -comparison
      }
    })

    setFilteredPayments(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [payments, filters])

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }))
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return colors.lightGreen
      case 'pending': return colors.coral
      case 'failed': return colors.red
      case 'refunded': return colors.dustyRose
      default: return colors.olive
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'confirmed': return 'Completed'
      case 'pending': return 'Pending'
      case 'failed': return 'Failed'
      case 'refunded': return 'Refunded'
      default: return status
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Calculate statistics
  const completedCount = payments.filter(p => p.status === 'confirmed').length
  const pendingCount = payments.filter(p => p.status === 'pending').length
  const failedCount = payments.filter(p => p.status === 'failed').length
  const totalCompletedAmount = payments
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + p.amount, 0)

  // Pagination calculations
  const totalPages = Math.ceil(filteredPayments.length / entriesPerPage)
  const startIndex = (currentPage - 1) * entriesPerPage
  const endIndex = startIndex + entriesPerPage
  const paginatedPayments = filteredPayments.slice(startIndex, endIndex)

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const getPageNumbers = () => {
    const pageNumbers = []
    const maxVisiblePages = 5
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i)
      }
    } else {
      const startPage = Math.max(1, currentPage - 2)
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
      
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i)
      }
    }
    
    return pageNumbers
  }

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

    filterSection: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '24px',
      border: '1px solid #e2e8f0'
    },

    filterHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: showFilters ? '20px' : '0'
    },

    filterToggle: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      backgroundColor: colors.darkGreen,
      color: '#ffffff',
      border: 'none',
      borderRadius: '8px',
      padding: '10px 16px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500'
    },

    filterControls: {
      display: showFilters ? 'grid' : 'none',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '16px'
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

    filterInput: {
      padding: '10px 12px',
      border: `1px solid ${colors.lightGreen}`,
      borderRadius: '6px',
      fontSize: '14px'
    },

    filterSelect: {
      padding: '10px 12px',
      border: `1px solid ${colors.lightGreen}`,
      borderRadius: '6px',
      fontSize: '14px',
      backgroundColor: '#ffffff'
    },

    statsCard: {
      backgroundColor: '#ffffff',
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

    paymentsTable: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #e2e8f0'
    },

    tableHeader: {
      backgroundColor: colors.darkGreen,
      color: '#ffffff',
      padding: '16px 20px',
      fontSize: '18px',
      fontWeight: 'bold'
    },

    table: {
      width: '100%',
      borderCollapse: 'collapse'
    },

    tableHeaderRow: {
      backgroundColor: colors.lightGreen,
      color: '#ffffff'
    },

    tableHeaderCell: {
      padding: '12px 16px',
      textAlign: 'left',
      fontSize: '14px',
      fontWeight: '600'
    },

    tableRow: {
      borderBottom: '1px solid #e2e8f0'
    },

    tableCell: {
      padding: '12px 16px',
      fontSize: '14px',
      color: colors.black
    },

    statusBadge: {
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '500',
      textTransform: 'uppercase',
      color: '#ffffff'
    },

    actionButton: {
      padding: '8px 14px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: '500',
      cursor: 'pointer',
      margin: '0 2px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px'
    },

    viewButton: {
      backgroundColor: colors.dustyRose,
      color: '#ffffff'
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
      zIndex: 1000
    },

    modalContent: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '24px',
      width: '90%',
      maxWidth: '600px',
      maxHeight: '80vh',
      overflowY: 'auto'
    },

    modalHeader: {
      fontSize: '20px',
      fontWeight: 'bold',
      color: colors.black,
      marginBottom: '20px'
    },

    formGroup: {
      marginBottom: '16px'
    },

    formActions: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
      marginTop: '24px'
    },

    closeButton: {
      backgroundColor: colors.red,
      color: '#ffffff',
      border: 'none',
      borderRadius: '6px',
      padding: '10px 20px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer'
    },

    loadingContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '400px',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      marginTop: '24px'
    },

    errorContainer: {
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

    pagination: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '20px',
      marginTop: '24px',
      border: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    },

    paginationInfo: {
      fontSize: '14px',
      color: colors.black
    },

    paginationControls: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },

    paginationButton: {
      padding: '8px 12px',
      border: `1px solid ${colors.lightGreen}`,
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      backgroundColor: '#ffffff',
      color: colors.black
    },

    paginationButtonActive: {
      backgroundColor: colors.darkGreen,
      color: '#ffffff',
      border: `1px solid ${colors.darkGreen}`
    },

    paginationButtonDisabled: {
      backgroundColor: '#f5f5f5',
      color: '#999',
      cursor: 'not-allowed',
      border: '1px solid #ddd'
    },

    noData: {
      textAlign: 'center',
      padding: '40px',
      color: colors.olive,
      fontSize: '16px'
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Payment History</h1>
          <p style={styles.subtitle}>Loading payment records...</p>
        </div>
        <div style={styles.loadingContainer}>
          <div>Loading...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Payment History</h1>
          <p style={styles.subtitle}>Error loading payment records</p>
        </div>
        <div style={styles.errorContainer}>
          <AlertCircle size={24} color={colors.red} />
          <p style={styles.errorText}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Payment History</h1>
        <p style={styles.subtitle}>View all payment transactions and their details</p>
      </div>

      {/* Statistics Card */}
      <div style={styles.statsCard}>
        <div style={styles.statsGrid}>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{completedCount}</div>
            <div style={styles.statLabel}>Confirmed Payments</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{pendingCount}</div>
            <div style={styles.statLabel}>Pending Payments</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{failedCount}</div>
            <div style={styles.statLabel}>Failed Payments</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>₱{totalCompletedAmount.toLocaleString()}</div>
            <div style={styles.statLabel}>Total Confirmed Amount</div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div style={styles.filterSection}>
        <div style={styles.filterHeader}>
          <h3 style={{ margin: 0, color: colors.black }}>Filter Payment History</h3>
          <button
            style={styles.filterToggle}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <div style={styles.filterControls}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Search by Name or ID</label>
            <input
              type="text"
              placeholder="Enter student name or ID..."
              value={filters.name}
              onChange={(e) => handleFilterChange('name', e.target.value)}
              style={styles.filterInput}
            />
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Sort Order</label>
            <select
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
              style={styles.filterSelect}
            >
              <option value="ascending">Ascending</option>
              <option value="descending">Descending</option>
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Payment Status</label>
            <select
              value={filters.paymentStatus}
              onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
              style={styles.filterSelect}
            >
              <option value="all">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              style={styles.filterSelect}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div style={styles.paymentsTable}>
        <div style={styles.tableHeader}>
          Payment History {filters.name || filters.paymentStatus !== 'all' ? '(Filtered)' : '(All Records)'}
        </div>
        
        {paginatedPayments.length === 0 ? (
          <div style={styles.noData}>
            No payment records found matching your criteria.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.tableHeaderCell}>Payment ID</th>
                <th style={styles.tableHeaderCell}>Student Name</th>
                <th style={styles.tableHeaderCell}>Course/Batch</th>
                <th style={styles.tableHeaderCell}>Amount</th>
                <th style={styles.tableHeaderCell}>Payment Date</th>
                <th style={styles.tableHeaderCell}>Status</th>
                <th style={styles.tableHeaderCell}>Method</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPayments.map((payment) => (
                <tr key={payment.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>{payment.id}</td>
                  <td style={styles.tableCell}>
                    <div>{payment.studentName}</div>
                    <div style={{ fontSize: '12px', color: colors.olive }}>
                      {payment.studentId}
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    <div>{payment.course}</div>
                    <div style={{ fontSize: '12px', color: colors.olive }}>
                      {payment.batch}
                    </div>
                  </td>
                  <td style={styles.tableCell}>₱{payment.amount.toLocaleString()}</td>
                  <td style={styles.tableCell}>{formatDate(payment.paymentDate)}</td>
                  <td style={styles.tableCell}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: getStatusColor(payment.status)
                      }}
                    >
                      {getStatusText(payment.status)}
                    </span>
                  </td>
                  <td style={styles.tableCell}>{payment.paymentMethod}</td>
                  <td style={styles.tableCell}>
                    <button
                      style={{...styles.actionButton, ...styles.viewButton}}
                      onClick={() => setViewingPayment(payment)}
                    >
                      <Eye size={14} />
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {filteredPayments.length > entriesPerPage && (
        <div style={styles.pagination}>
          <div style={styles.paginationInfo}>
            Showing {startIndex + 1} to {Math.min(endIndex, filteredPayments.length)} of {filteredPayments.length} entries
          </div>
          
          <div style={styles.paginationControls}>
            <button
              style={{
                ...styles.paginationButton,
                ...(currentPage === 1 ? styles.paginationButtonDisabled : {})
              }}
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            
            {getPageNumbers().map((pageNumber) => (
              <button
                key={pageNumber}
                style={{
                  ...styles.paginationButton,
                  ...(currentPage === pageNumber ? styles.paginationButtonActive : {})
                }}
                onClick={() => handlePageChange(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            
            <button
              style={{
                ...styles.paginationButton,
                ...(currentPage === totalPages ? styles.paginationButtonDisabled : {})
              }}
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* View Payment Details Modal */}
      {viewingPayment && (
        <div style={styles.modal} onClick={() => setViewingPayment(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalHeader}>Payment Details - {viewingPayment.id}</h2>
            
            <div style={styles.formGroup}>
              <strong>Payment ID:</strong> {viewingPayment.id}
            </div>
            <div style={styles.formGroup}>
              <strong>Student ID:</strong> {viewingPayment.studentId}
            </div>
            <div style={styles.formGroup}>
              <strong>Student Name:</strong> {viewingPayment.studentName}
            </div>
            <div style={styles.formGroup}>
              <strong>Course:</strong> {viewingPayment.course}
            </div>
            <div style={styles.formGroup}>
              <strong>Batch:</strong> {viewingPayment.batch}
            </div>
            <div style={styles.formGroup}>
              <strong>Payment Amount:</strong> ₱{viewingPayment.amount.toLocaleString()}
            </div>
            {viewingPayment.processingFee > 0 && (
              <div style={styles.formGroup}>
                <strong>Processing Fee:</strong> ₱{viewingPayment.processingFee.toLocaleString()}
              </div>
            )}
            <div style={styles.formGroup}>
              <strong>Total Due:</strong> ₱{viewingPayment.totalDue.toLocaleString()}
            </div>
            <div style={styles.formGroup}>
              <strong>Remaining Balance:</strong> ₱{viewingPayment.balance.toLocaleString()}
            </div>
            <div style={styles.formGroup}>
              <strong>Payment Date:</strong> {formatDateTime(viewingPayment.paymentDate)}
            </div>
            <div style={styles.formGroup}>
              <strong>Payment Method:</strong> {viewingPayment.paymentMethod}
            </div>
            {viewingPayment.referenceNumber && (
              <div style={styles.formGroup}>
                <strong>Reference Number:</strong> {viewingPayment.referenceNumber}
              </div>
            )}
            <div style={styles.formGroup}>
              <strong>Status:</strong> 
              <span
                style={{
                  ...styles.statusBadge,
                  backgroundColor: getStatusColor(viewingPayment.status),
                  marginLeft: '8px'
                }}
              >
                {getStatusText(viewingPayment.status)}
              </span>
            </div>

            <div style={styles.formActions}>
              <button
                style={styles.closeButton}
                onClick={() => setViewingPayment(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentHistory