import { useState, useEffect } from 'react'
import { Search, Filter, Edit2, Check, X, Eye, Calendar, DollarSign, User, Phone, Mail, ChevronDown, ChevronUp, FileText, Download, ChevronLeft, ChevronRight } from 'lucide-react'

const CompletedPayment = () => {
  const [payments, setPayments] = useState([])
  const [filteredPayments, setFilteredPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    name: '',
    sortOrder: 'date_desc',
    dateRange: 'all'
  })
  const [showFilters, setShowFilters] = useState(false)
  const [viewingPayment, setViewingPayment] = useState(null)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

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

  // Fetch completed payments from the backend
  const fetchCompletedPayments = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      // Determine the correct API base URL
      const apiBaseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : window.location.origin

      const apiUrl = `${apiBaseUrl}/api/payments/completed`
      console.log('Fetching from URL:', apiUrl)
      console.log('Using token:', token ? 'Token found' : 'No token')

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)

      // Check if the response is HTML (indicating an error page)
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('text/html')) {
        const htmlContent = await response.text()
        console.error('Received HTML instead of JSON:', htmlContent)
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. This usually means the API endpoint doesn't exist.`)
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error Response:', errorText)
        
        if (response.status === 401) {
          throw new Error('Unauthorized access. Please login again.')
        }
        if (response.status === 404) {
          throw new Error('API endpoint not found. Please ensure the server has the /api/payments/completed endpoint.')
        }
        throw new Error(`API Error (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      
      // Log the received data for debugging
      console.log('Received completed payments data:', data)
      
      // Check if data is an array
      if (!Array.isArray(data)) {
        console.warn('Expected array but received:', typeof data, data)
        throw new Error('Invalid data format received from server')
      }
      
      // Transform the data to match the component's expected structure
      const transformedPayments = data.map(payment => ({
        id: payment.payment_id,
        studentName: `${payment.first_name} ${payment.last_name}`,
        email: payment.email,
        phone: payment.phone || 'N/A',
        course: payment.course_name,
        batch: payment.batch_identifier,
        amount: parseFloat(payment.payment_amount) || 0,
        totalPaid: parseFloat(payment.payment_amount) || 0,
        dueDate: payment.payment_date,
        dateCreated: payment.created_at,
        completedDate: payment.payment_date,
        status: payment.payment_status === 'completed' ? 'completed' : 'confirmed',
        paymentMethod: payment.method_name,
        notes: payment.notes || 'Payment completed successfully',
        referenceNumber: payment.reference_number,
        processingFee: parseFloat(payment.processing_fee) || 0,
        studentId: payment.student_id,
        accountId: payment.account_id,
        offeringId: payment.offering_id,
        receipts: [
          {
            id: `REC${payment.payment_id}`,
            fileName: `payment_receipt_${payment.reference_number || payment.payment_id}.pdf`,
            uploadDate: payment.payment_date,
            amount: parseFloat(payment.payment_amount) || 0,
            description: `Payment via ${payment.method_name}`
          }
        ]
      }))

      console.log('Transformed payments:', transformedPayments)
      setPayments(transformedPayments)
      
    } catch (err) {
      console.error('Error fetching completed payments:', err)
      
      // Try fallback to the existing payments endpoint with status filter
      try {
        console.log('Trying fallback endpoint...')
        const apiBaseUrl = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3000' 
          : window.location.origin
        
        const fallbackUrl = `${apiBaseUrl}/api/payments?status=completed`
        console.log('Fallback URL:', fallbackUrl)
        
        const token = localStorage.getItem('token')
        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json()
          console.log('Fallback successful, received data:', fallbackData)
          
          if (Array.isArray(fallbackData)) {
            const transformedPayments = fallbackData.map(payment => ({
              id: payment.payment_id,
              studentName: `${payment.first_name} ${payment.last_name}`,
              email: payment.email,
              phone: payment.phone || 'N/A',
              course: payment.course_name,
              batch: payment.batch_identifier,
              amount: parseFloat(payment.payment_amount) || 0,
              totalPaid: parseFloat(payment.payment_amount) || 0,
              dueDate: payment.payment_date,
              dateCreated: payment.created_at,
              completedDate: payment.payment_date,
              status: payment.payment_status === 'completed' ? 'completed' : 'confirmed',
              paymentMethod: payment.method_name,
              notes: payment.notes || 'Payment completed successfully',
              referenceNumber: payment.reference_number,
              processingFee: parseFloat(payment.processing_fee) || 0,
              studentId: payment.student_id,
              accountId: payment.account_id,
              offeringId: payment.offering_id,
              receipts: [
                {
                  id: `REC${payment.payment_id}`,
                  fileName: `payment_receipt_${payment.reference_number || payment.payment_id}.pdf`,
                  uploadDate: payment.payment_date,
                  amount: parseFloat(payment.payment_amount) || 0,
                  description: `Payment via ${payment.method_name}`
                }
              ]
            }))
            
            setPayments(transformedPayments)
            setError(null) // Clear the error since fallback worked
            return
          }
        }
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr)
      }
      
      // If both attempts failed, set the original error
      setError(`${err.message}\n\nTroubleshooting:\n1. Make sure your backend server is running\n2. Check if the API endpoint exists\n3. Verify CORS configuration\n4. Check browser console for network errors`)
    } finally {
      setLoading(false)
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

    // Filter by date range
    if (filters.dateRange !== 'all') {
      const now = new Date()
      const filterDate = new Date()
      
      switch (filters.dateRange) {
        case 'week':
          filterDate.setDate(now.getDate() - 7)
          break
        case 'month':
          filterDate.setMonth(now.getMonth() - 1)
          break
        case 'quarter':
          filterDate.setMonth(now.getMonth() - 3)
          break
        default:
          break
      }

      filtered = filtered.filter(payment => 
        new Date(payment.completedDate) >= filterDate
      )
    }

    // Sort by completion date or name
    filtered.sort((a, b) => {
      if (filters.sortOrder === 'date_desc') {
        return new Date(b.completedDate) - new Date(a.completedDate)
      } else if (filters.sortOrder === 'date_asc') {
        return new Date(a.completedDate) - new Date(b.completedDate)
      } else {
        const comparison = a.studentName.localeCompare(b.studentName)
        return filters.sortOrder === 'ascending' ? comparison : -comparison
      }
    })

    setFilteredPayments(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [payments, filters])

  // Fetch data on component mount
  useEffect(() => {
    fetchCompletedPayments()
  }, [])

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }))
  }

  const downloadReceipt = async (receipt, payment) => {
    try {
      // In a real implementation, you would fetch the actual receipt file
      // For now, we'll simulate a download
      const receiptData = {
        paymentId: payment.id,
        studentName: payment.studentName,
        amount: receipt.amount,
        date: receipt.uploadDate,
        method: payment.paymentMethod,
        reference: payment.referenceNumber
      }
      
      const blob = new Blob([JSON.stringify(receiptData, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = receipt.fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
    } catch (error) {
      console.error('Error downloading receipt:', error)
      alert('Failed to download receipt')
    }
  }

  // Pagination calculations
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentPayments = filteredPayments.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    setCurrentPage(page)
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

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = []
    const maxVisiblePages = 5
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      const startPage = Math.max(1, currentPage - 2)
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
      
      if (startPage > 1) {
        pages.push(1)
        if (startPage > 2) pages.push('...')
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i)
      }
      
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pages.push('...')
        pages.push(totalPages)
      }
    }
    
    return pages
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

    refreshButton: {
      backgroundColor: colors.darkGreen,
      color: '#ffffff',
      border: 'none',
      borderRadius: '8px',
      padding: '10px 16px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      marginTop: '10px'
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

    loadingContainer: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '40px',
      textAlign: 'center',
      border: '1px solid #e2e8f0'
    },

    errorContainer: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '40px',
      textAlign: 'center',
      border: '1px solid #e2e8f0',
      color: colors.red
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
      border: '1px solid #e2e8f0',
      marginBottom: '20px'
    },

    tableHeader: {
      backgroundColor: colors.darkGreen,
      color: '#ffffff',
      padding: '16px 20px',
      fontSize: '18px',
      fontWeight: 'bold',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
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
      color: '#ffffff',
      backgroundColor: colors.lightGreen
    },

    actionButton: {
      padding: '8px 18px',
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

    // Pagination styles
    paginationContainer: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #e2e8f0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '16px'
    },

    paginationInfo: {
      fontSize: '14px',
      color: colors.olive
    },

    paginationControls: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },

    paginationButton: {
      padding: '8px 12px',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      backgroundColor: '#ffffff',
      color: colors.black,
      cursor: 'pointer',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },

    paginationButtonActive: {
      backgroundColor: colors.darkGreen,
      color: '#ffffff',
      borderColor: colors.darkGreen
    },

    paginationButtonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed'
    },

    paginationEllipsis: {
      padding: '8px 4px',
      color: colors.olive,
      fontSize: '14px'
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

    receiptSection: {
      backgroundColor: colors.cream,
      borderRadius: '8px',
      padding: '16px',
      marginTop: '16px'
    },

    receiptHeader: {
      fontSize: '16px',
      fontWeight: 'bold',
      color: colors.black,
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },

    receiptItem: {
      backgroundColor: '#ffffff',
      borderRadius: '6px',
      padding: '12px',
      marginBottom: '8px',
      border: '1px solid #e2e8f0'
    },

    receiptName: {
      fontSize: '14px',
      fontWeight: '500',
      color: colors.black,
      marginBottom: '4px'
    },

    receiptDetails: {
      fontSize: '12px',
      color: colors.olive,
      marginBottom: '8px'
    },

    receiptAmount: {
      fontSize: '14px',
      fontWeight: 'bold',
      color: colors.darkGreen,
      marginBottom: '8px'
    },

    downloadButton: {
      backgroundColor: colors.olive,
      color: '#ffffff',
      border: 'none',
      borderRadius: '4px',
      padding: '6px 12px',
      fontSize: '12px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },

    formActions: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
      marginTop: '24px'
    },

    cancelButtonModal: {
      backgroundColor: colors.red,
      color: '#ffffff',
      border: 'none',
      borderRadius: '6px',
      padding: '10px 20px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer'
    },

    balanceSummary: {
      backgroundColor: colors.lightGreen,
      color: '#ffffff',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '16px',
      textAlign: 'center'
    },

    balanceAmount: {
      fontSize: '18px',
      fontWeight: 'bold',
      margin: 0
    },

    balanceLabel: {
      fontSize: '12px',
      margin: 0,
      opacity: 0.9
    }
  }

  // Show loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <p>Loading completed payments...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <p>Error loading payments: {error}</p>
        </div>
      </div>
    )
  }

  const completedCount = payments.length
  const totalCollected = payments.reduce((sum, p) => sum + p.totalPaid, 0)
  const totalReceipts = payments.reduce((sum, p) => sum + p.receipts.length, 0)

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Completed Payments</h1>
        <p style={styles.subtitle}>View and manage all completed student payments and receipts</p>
      </div>

      {/* Statistics Card */}
      <div style={styles.statsCard}>
        <div style={styles.statsGrid}>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{completedCount}</div>
            <div style={styles.statLabel}>Completed Payments</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>₱{totalCollected.toLocaleString()}</div>
            <div style={styles.statLabel}>Total Collected</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{totalReceipts}</div>
            <div style={styles.statLabel}>Total Receipts</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{filteredPayments.length}</div>
            <div style={styles.statLabel}>Filtered Results</div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div style={styles.filterSection}>
        <div style={styles.filterHeader}>
          <h3 style={{ margin: 0, color: colors.black }}>Filter Completed Payments</h3>
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
            <label style={styles.filterLabel}>Filter by Name</label>
            <input
              type="text"
              placeholder="Enter student name..."
              value={filters.name}
              onChange={(e) => handleFilterChange('name', e.target.value)}
              style={styles.filterInput}
            />
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Sort By</label>
            <select
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
              style={styles.filterSelect}
            >
              <option value="ascending">Name (A-Z)</option>
              <option value="descending">Name (Z-A)</option>
              <option value="date_desc">Latest Completed</option>
              <option value="date_asc">Earliest Completed</option>
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
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="quarter">Last 3 Months</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div style={styles.paymentsTable}>
        <div style={styles.tableHeader}>
          <span>
            Completed Payments {filters.name || filters.dateRange !== 'all' ? '(Filtered)' : '(All Records)'}
          </span>
          <span style={{ fontSize: '14px', fontWeight: 'normal' }}>
            Showing {startIndex + 1}-{Math.min(endIndex, filteredPayments.length)} of {filteredPayments.length} results
          </span>
        </div>
        
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.tableHeaderCell}>Payment ID</th>
              <th style={styles.tableHeaderCell}>Student Name</th>
              <th style={styles.tableHeaderCell}>Course</th>
              <th style={styles.tableHeaderCell}>Amount Paid</th>
              <th style={styles.tableHeaderCell}>Completed Date</th>
              <th style={styles.tableHeaderCell}>Payment Method</th>
              <th style={styles.tableHeaderCell}>Status</th>
              <th style={styles.tableHeaderCell}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentPayments.map((payment) => (
              <tr key={payment.id} style={styles.tableRow}>
                <td style={styles.tableCell}>{payment.id}</td>
                <td style={styles.tableCell}>{payment.studentName}</td>
                <td style={styles.tableCell}>{payment.course}</td>
                <td style={styles.tableCell}>₱{payment.totalPaid.toLocaleString()}</td>
                <td style={styles.tableCell}>{new Date(payment.completedDate).toLocaleDateString()}</td>
                <td style={styles.tableCell}>{payment.paymentMethod}</td>
                <td style={styles.tableCell}>
                  <span style={styles.statusBadge}>
                    {payment.status}
                  </span>
                </td>
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
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={styles.paginationContainer}>
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
              <ChevronLeft size={16} />
              Previous
            </button>

            {getPageNumbers().map((page, index) => (
              <span key={index}>
                {page === '...' ? (
                  <span style={styles.paginationEllipsis}>...</span>
                ) : (
                  <button
                    style={{
                      ...styles.paginationButton,
                      ...(currentPage === page ? styles.paginationButtonActive : {})
                    }}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                )}
              </span>
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
              <ChevronRight size={16} />
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
              <strong>Student Name:</strong> {viewingPayment.studentName}
            </div>
            <div style={styles.formGroup}>
              <strong>Student ID:</strong> {viewingPayment.studentId}
            </div>
            <div style={styles.formGroup}>
              <strong>Email:</strong> {viewingPayment.email}
            </div>
            <div style={styles.formGroup}>
              <strong>Phone:</strong> {viewingPayment.phone}
            </div>
            <div style={styles.formGroup}>
              <strong>Course:</strong> {viewingPayment.course}
            </div>
            {viewingPayment.batch && (
              <div style={styles.formGroup}>
                <strong>Batch:</strong> {viewingPayment.batch}
              </div>
            )}
            <div style={styles.formGroup}>
              <strong>Amount Paid:</strong> ₱{viewingPayment.amount.toLocaleString()}
            </div>
            {viewingPayment.processingFee > 0 && (
              <div style={styles.formGroup}>
                <strong>Processing Fee:</strong> ₱{viewingPayment.processingFee.toLocaleString()}
              </div>
            )}
            <div style={styles.formGroup}>
              <strong>Payment Date:</strong> {new Date(viewingPayment.completedDate).toLocaleDateString()}
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
              <strong>Notes:</strong> {viewingPayment.notes}
            </div>

            {/* Total Balance Summary */}
            <div style={styles.balanceSummary}>
              <div style={styles.balanceAmount}>₱{viewingPayment.totalPaid.toLocaleString()}</div>
              <div style={styles.balanceLabel}>Total Amount Paid</div>
            </div>

            {/* Receipts Section */}
            <div style={styles.receiptSection}>
              <div style={styles.receiptHeader}>
                <FileText size={16} />
                Payment Receipt ({viewingPayment.receipts.length})
              </div>
              
              {viewingPayment.receipts.map((receipt) => (
                <div key={receipt.id} style={styles.receiptItem}>
                  <div style={styles.receiptName}>{receipt.fileName}</div>
                  <div style={styles.receiptDetails}>
                    Payment Date: {new Date(receipt.uploadDate).toLocaleDateString()} | {receipt.description}
                  </div>
                  <div style={styles.receiptAmount}>₱{receipt.amount.toLocaleString()}</div>
                  <button
                    style={styles.downloadButton}
                    onClick={() => downloadReceipt(receipt, viewingPayment)}
                  >
                    <Download size={12} />
                    Download Receipt
                  </button>
                </div>
              ))}
            </div>

            <div style={styles.formActions}>
              <button
                style={styles.cancelButtonModal}
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

export default CompletedPayment