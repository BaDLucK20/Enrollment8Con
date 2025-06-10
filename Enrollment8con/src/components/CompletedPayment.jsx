import { useState, useEffect } from 'react'
import { Search, Filter, Edit2, Check, X, Eye, Calendar, DollarSign, User, Phone, Mail, ChevronDown, ChevronUp, FileText, Download, ChevronLeft, ChevronRight } from 'lucide-react'

const CompletedPayment = () => {
  const [payments, setPayments] = useState([
    {
      id: 'PAY001',
      studentName: 'Maria Santos',
      email: 'maria.santos@email.com',
      phone: '+63 912 345 6789',
      course: 'Basic',
      amount: 15000,
      totalPaid: 15000,
      dueDate: '2025-06-15',
      dateCreated: '2025-05-20',
      completedDate: '2025-06-14',
      status: 'completed',
      paymentMethod: 'Bank Transfer',
      notes: 'Payment completed successfully',
      receipts: [
        {
          id: 'REC001',
          fileName: 'bank_transfer_receipt_001.pdf',
          uploadDate: '2025-06-14',
          amount: 15000,
          description: 'Full payment via BPI bank transfer'
        }
      ]
    },
    {
      id: 'PAY002',
      studentName: 'Juan Dela Cruz',
      email: 'juan.delacruz@email.com',
      phone: '+63 917 234 5678',
      course: 'Basic',
      amount: 25000,
      totalPaid: 25000,
      dueDate: '2025-06-20',
      dateCreated: '2025-05-18',
      completedDate: '2025-06-19',
      status: 'completed',
      paymentMethod: 'GCash',
      notes: 'Payment completed in installments',
      receipts: [
        {
          id: 'REC002',
          fileName: 'gcash_receipt_001.jpg',
          uploadDate: '2025-06-05',
          amount: 12500,
          description: 'First installment via GCash'
        },
        {
          id: 'REC003',
          fileName: 'gcash_receipt_002.jpg',
          uploadDate: '2025-06-19',
          amount: 12500,
          description: 'Final installment via GCash'
        }
      ]
    },
    {
      id: 'PAY003',
      studentName: 'Ana Rodriguez',
      email: 'ana.rodriguez@email.com',
      phone: '+63 923 456 7890',
      course: 'Basic',
      amount: 18000,
      totalPaid: 18000,
      dueDate: '2025-06-12',
      dateCreated: '2025-05-22',
      completedDate: '2025-06-11',
      status: 'completed',
      paymentMethod: 'Credit Card',
      notes: 'Payment completed via credit card',
      receipts: [
        {
          id: 'REC004',
          fileName: 'credit_card_receipt.pdf',
          uploadDate: '2025-06-11',
          amount: 18000,
          description: 'Full payment via Visa credit card'
        }
      ]
    },
    {
      id: 'PAY004',
      studentName: 'Carlos Mendoza',
      email: 'carlos.mendoza@email.com',
      phone: '+63 918 765 4321',
      course: 'Basic',
      amount: 22000,
      totalPaid: 22000,
      dueDate: '2025-06-18',
      dateCreated: '2025-05-25',
      completedDate: '2025-06-17',
      status: 'completed',
      paymentMethod: 'PayMaya',
      notes: 'Payment completed with bonus discount applied',
      receipts: [
        {
          id: 'REC005',
          fileName: 'paymaya_receipt_001.png',
          uploadDate: '2025-06-10',
          amount: 11000,
          description: 'Partial payment via PayMaya'
        },
        {
          id: 'REC006',
          fileName: 'paymaya_receipt_002.png',
          uploadDate: '2025-06-17',
          amount: 11000,
          description: 'Final payment via PayMaya'
        }
      ]
    },
    {
      id: 'PAY005',
      studentName: 'Isabella Garcia',
      email: 'isabella.garcia@email.com',
      phone: '+63 919 876 5432',
      course: 'Basic',
      amount: 12000,
      totalPaid: 12000,
      dueDate: '2025-06-25',
      dateCreated: '2025-05-28',
      completedDate: '2025-06-24',
      status: 'completed',
      paymentMethod: 'Bank Transfer',
      notes: 'Scholarship student - partial payment completed',
      receipts: [
        {
          id: 'REC007',
          fileName: 'scholarship_payment_receipt.pdf',
          uploadDate: '2025-06-24',
          amount: 12000,
          description: 'Scholarship portion payment via bank transfer'
        }
      ]
    },
    // Adding more sample data to better demonstrate pagination
    {
      id: 'PAY006',
      studentName: 'Michael Torres',
      email: 'michael.torres@email.com',
      phone: '+63 920 123 4567',
      course: 'Basic',
      amount: 20000,
      totalPaid: 20000,
      dueDate: '2025-06-30',
      dateCreated: '2025-05-30',
      completedDate: '2025-06-29',
      status: 'completed',
      paymentMethod: 'Bank Transfer',
      notes: 'Early payment with discount',
      receipts: [
        {
          id: 'REC008',
          fileName: 'bank_receipt_torres.pdf',
          uploadDate: '2025-06-29',
          amount: 20000,
          description: 'Full payment via Metrobank'
        }
      ]
    },
    {
      id: 'PAY007',
      studentName: 'Sofia Reyes',
      email: 'sofia.reyes@email.com',
      phone: '+63 921 234 5678',
      course: 'Basic',
      amount: 16000,
      totalPaid: 16000,
      dueDate: '2025-07-05',
      dateCreated: '2025-06-01',
      completedDate: '2025-07-04',
      status: 'completed',
      paymentMethod: 'GCash',
      notes: 'Payment completed on time',
      receipts: [
        {
          id: 'REC009',
          fileName: 'gcash_sofia.jpg',
          uploadDate: '2025-07-04',
          amount: 16000,
          description: 'Full payment via GCash'
        }
      ]
    },
    {
      id: 'PAY008',
      studentName: 'David Lopez',
      email: 'david.lopez@email.com',
      phone: '+63 922 345 6789',
      course: 'Basic',
      amount: 24000,
      totalPaid: 24000,
      dueDate: '2025-07-10',
      dateCreated: '2025-06-05',
      completedDate: '2025-07-09',
      status: 'completed',
      paymentMethod: 'Credit Card',
      notes: 'Payment via Mastercard',
      receipts: [
        {
          id: 'REC010',
          fileName: 'mastercard_david.pdf',
          uploadDate: '2025-07-09',
          amount: 24000,
          description: 'Full payment via Mastercard'
        }
      ]
    },
    {
      id: 'PAY009',
      studentName: 'Elena Flores',
      email: 'elena.flores@email.com',
      phone: '+63 923 456 7891',
      course: 'Basic',
      amount: 19000,
      totalPaid: 19000,
      dueDate: '2025-07-15',
      dateCreated: '2025-06-10',
      completedDate: '2025-07-14',
      status: 'completed',
      paymentMethod: 'PayMaya',
      notes: 'Payment completed with promo',
      receipts: [
        {
          id: 'REC011',
          fileName: 'paymaya_elena.png',
          uploadDate: '2025-07-14',
          amount: 19000,
          description: 'Full payment via PayMaya'
        }
      ]
    },
    {
      id: 'PAY010',
      studentName: 'Roberto Cruz',
      email: 'roberto.cruz@email.com',
      phone: '+63 924 567 8901',
      course: 'Basic',
      amount: 21000,
      totalPaid: 21000,
      dueDate: '2025-07-20',
      dateCreated: '2025-06-15',
      completedDate: '2025-07-19',
      status: 'completed',
      paymentMethod: 'Bank Transfer',
      notes: 'Payment completed successfully',
      receipts: [
        {
          id: 'REC012',
          fileName: 'bdo_roberto.pdf',
          uploadDate: '2025-07-19',
          amount: 21000,
          description: 'Full payment via BDO'
        }
      ]
    },
    {
      id: 'PAY011',
      studentName: 'Carmen Valdez',
      email: 'carmen.valdez@email.com',
      phone: '+63 925 678 9012',
      course: 'Basic',
      amount: 17000,
      totalPaid: 17000,
      dueDate: '2025-07-25',
      dateCreated: '2025-06-20',
      completedDate: '2025-07-24',
      status: 'completed',
      paymentMethod: 'GCash',
      notes: 'Regular payment',
      receipts: [
        {
          id: 'REC013',
          fileName: 'gcash_carmen.jpg',
          uploadDate: '2025-07-24',
          amount: 17000,
          description: 'Full payment via GCash'
        }
      ]
    },
    {
      id: 'PAY012',
      studentName: 'Antonio Silva',
      email: 'antonio.silva@email.com',
      phone: '+63 926 789 0123',
      course: 'Basic',
      amount: 23000,
      totalPaid: 23000,
      dueDate: '2025-07-30',
      dateCreated: '2025-06-25',
      completedDate: '2025-07-29',
      status: 'completed',
      paymentMethod: 'Credit Card',
      notes: 'Payment via Visa',
      receipts: [
        {
          id: 'REC014',
          fileName: 'visa_antonio.pdf',
          uploadDate: '2025-07-29',
          amount: 23000,
          description: 'Full payment via Visa'
        }
      ]
    }
  ])

  const [filteredPayments, setFilteredPayments] = useState(payments)
  const [filters, setFilters] = useState({
    name: '',
    sortOrder: 'ascending',
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

  // Apply filters
  useEffect(() => {
    let filtered = [...payments]

    // Filter by name
    if (filters.name) {
      filtered = filtered.filter(payment => 
        payment.studentName.toLowerCase().includes(filters.name.toLowerCase())
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

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }))
  }

  const downloadReceipt = (receipt) => {
    // Simulate receipt download
    alert(`Downloading receipt: ${receipt.fileName}`)
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
              <th style={styles.tableHeaderCell}>Student ID</th>
              <th style={styles.tableHeaderCell}>Student Name</th>
              <th style={styles.tableHeaderCell}>Course</th>
              <th style={styles.tableHeaderCell}>Amount Paid</th>
              <th style={styles.tableHeaderCell}>Completed Date</th>
              <th style={styles.tableHeaderCell}>Receipts</th>
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
                <td style={styles.tableCell}>{payment.completedDate}</td>
                <td style={styles.tableCell}>{payment.receipts.length} receipt{payment.receipts.length !== 1 ? 's' : ''}</td>
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

      {/* View Payment Details Modal */}
      {viewingPayment && (
        <div style={styles.modal} onClick={() => setViewingPayment(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalHeader}>Payment Details - {viewingPayment.id}</h2>
            
            <div style={styles.formGroup}>
              <strong>Student Name:</strong> {viewingPayment.studentName}
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
            <div style={styles.formGroup}>
              <strong>Original Amount:</strong> ₱{viewingPayment.amount.toLocaleString()}
            </div>
            <div style={styles.formGroup}>
              <strong>Due Date:</strong> {viewingPayment.dueDate}
            </div>
            <div style={styles.formGroup}>
              <strong>Completed Date:</strong> {viewingPayment.completedDate}
            </div>
            <div style={styles.formGroup}>
              <strong>Payment Method:</strong> {viewingPayment.paymentMethod}
            </div>
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
                Submitted Receipts ({viewingPayment.receipts.length})
              </div>
              
              {viewingPayment.receipts.map((receipt) => (
                <div key={receipt.id} style={styles.receiptItem}>
                  <div style={styles.receiptName}>{receipt.fileName}</div>
                  <div style={styles.receiptDetails}>
                    Uploaded: {receipt.uploadDate} | {receipt.description}
                  </div>
                  <div style={styles.receiptAmount}>₱{receipt.amount.toLocaleString()}</div>
                  <button
                    style={styles.downloadButton}
                    onClick={() => downloadReceipt(receipt)}
                  >
                    <Download size={12} />
                    Download
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