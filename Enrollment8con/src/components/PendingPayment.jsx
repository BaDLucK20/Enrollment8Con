import { useState, useEffect } from 'react'
import { Search, Filter, Edit2, Check, X, Eye, Calendar, DollarSign, User, Phone, Mail, ChevronDown, ChevronUp } from 'lucide-react'

const PendingPayment = () => {
  const [payments, setPayments] = useState([
    {
      id: 'PAY001',
      studentName: 'Maria Santos',
      email: 'maria.santos@email.com',
      phone: '+63 912 345 6789',
      course: 'Basic',
      amount: 15000,
      dueDate: '2025-06-15',
      dateCreated: '2025-05-20',
      status: 'pending',
      paymentMethod: 'Bank Transfer',
      notes: 'Waiting for bank confirmation'
    },
    {
      id: 'PAY002',
      studentName: 'Juan Dela Cruz',
      email: 'juan.delacruz@email.com',
      phone: '+63 917 234 5678',
      course: 'Basic',
      amount: 25000,
      dueDate: '2025-06-20',
      dateCreated: '2025-05-18',
      status: 'pending',
      paymentMethod: 'GCash',
      notes: 'Student requested payment plan'
    },
    {
      id: 'PAY003',
      studentName: 'Ana Rodriguez',
      email: 'ana.rodriguez@email.com',
      phone: '+63 923 456 7890',
      course: 'Basic',
      amount: 18000,
      dueDate: '2025-06-12',
      dateCreated: '2025-05-22',
      status: 'pending',
      paymentMethod: 'Credit Card',
      notes: 'Payment verification in progress'
    },
    {
      id: 'PAY004',
      studentName: 'Carlos Mendoza',
      email: 'carlos.mendoza@email.com',
      phone: '+63 918 765 4321',
      course: 'Basic',
      amount: 22000,
      dueDate: '2025-06-18',
      dateCreated: '2025-05-25',
      status: 'pending',
      paymentMethod: 'PayMaya',
      notes: 'Partial payment received'
    },
    {
      id: 'PAY005',
      studentName: 'Isabella Garcia',
      email: 'isabella.garcia@email.com',
      phone: '+63 919 876 5432',
      course: 'Basic',
      amount: 12000,
      dueDate: '2025-06-25',
      dateCreated: '2025-05-28',
      status: 'pending',
      paymentMethod: 'Bank Transfer',
      notes: 'Awaiting scholarship verification'
    }
  ])

  const [filteredPayments, setFilteredPayments] = useState(payments)
  const [filters, setFilters] = useState({
    name: '',
    sortOrder: 'ascending',
    paymentStatus: 'all'
  })
  const [showFilters, setShowFilters] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [viewingPayment, setViewingPayment] = useState(null)
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

  // Apply filters based on flowchart logic
  useEffect(() => {
    let filtered = [...payments]

    // Filter by name
    if (filters.name) {
      filtered = filtered.filter(payment => 
        payment.studentName.toLowerCase().includes(filters.name.toLowerCase())
      )
    }

    // Filter by payment status
    if (filters.paymentStatus !== 'all') {
      filtered = filtered.filter(payment => payment.status === filters.paymentStatus)
    }

    // Sort by name
    filtered.sort((a, b) => {
      const comparison = a.studentName.localeCompare(b.studentName)
      return filters.sortOrder === 'ascending' ? comparison : -comparison
    })

    setFilteredPayments(filtered)
    setCurrentPage(1)
  }, [payments, filters])

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }))
  }

  const updatePaymentStatus = (paymentId, newStatus) => {
    setPayments(prev => prev.map(payment => 
      payment.id === paymentId 
        ? { ...payment, status: newStatus, updatedDate: new Date().toISOString().split('T')[0] }
        : payment
    ))
  }

  const updatePaymentDetails = (paymentId, updatedData) => {
    setPayments(prev => prev.map(payment => 
      payment.id === paymentId 
        ? { ...payment, ...updatedData, updatedDate: new Date().toISOString().split('T')[0] }
        : payment
    ))
    setEditingPayment(null)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return colors.coral
      case 'completed': return colors.lightGreen
      case 'cancelled': return colors.red
      default: return colors.olive
    }
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

    completeButton: {
      backgroundColor: colors.lightGreen,
      color: '#ffffff'
    },

    cancelButton: {
      backgroundColor: colors.red,
      color: '#ffffff'
    },

    editButton: {
      backgroundColor: colors.olive,
      color: '#ffffff'
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
      maxWidth: '500px',
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

    formLabel: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      color: colors.black,
      marginBottom: '6px'
    },

    formInput: {
      width: '100%',
      padding: '10px 12px',
      border: `1px solid ${colors.lightGreen}`,
      borderRadius: '6px',
      fontSize: '14px',
      boxSizing: 'border-box'
    },

    formActions: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
      marginTop: '24px'
    },

    saveButton: {
      backgroundColor: colors.darkGreen,
      color: '#ffffff',
      border: 'none',
      borderRadius: '6px',
      padding: '10px 20px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer'
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
    }
  }

  const pendingCount = payments.filter(p => p.status === 'pending').length
  const totalAmount = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0)

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

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Pending Payments</h1>
        <p style={styles.subtitle}>Manage and track all pending student payments</p>
      </div>

      {/* Statistics Card */}
      <div style={styles.statsCard}>
        <div style={styles.statsGrid}>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{pendingCount}</div>
            <div style={styles.statLabel}>Pending Payments</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>₱{totalAmount.toLocaleString()}</div>
            <div style={styles.statLabel}>Total Pending Amount</div>
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
          <h3 style={{ margin: 0, color: colors.black }}>Filter Payments</h3>
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
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div style={styles.paymentsTable}>
        <div style={styles.tableHeader}>
          Payment Tracker {filters.name || filters.paymentStatus !== 'all' ? '(Filtered)' : '(Unfiltered)'}
        </div>
        
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.tableHeaderCell}>Student ID</th>
              <th style={styles.tableHeaderCell}>Student Name</th>
              <th style={styles.tableHeaderCell}>Course</th>
              <th style={styles.tableHeaderCell}>Amount</th>
              <th style={styles.tableHeaderCell}>Due Date</th>
              <th style={styles.tableHeaderCell}>Status</th>
              <th style={styles.tableHeaderCell}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((payment) => (
              <tr key={payment.id} style={styles.tableRow}>
                <td style={styles.tableCell}>{payment.id}</td>
                <td style={styles.tableCell}>{payment.studentName}</td>
                <td style={styles.tableCell}>{payment.course}</td>
                <td style={styles.tableCell}>₱{payment.amount.toLocaleString()}</td>
                <td style={styles.tableCell}>{payment.dueDate}</td>
                <td style={styles.tableCell}>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: getStatusColor(payment.status)
                    }}
                  >
                    {payment.status}
                  </span>
                </td>
                <td style={styles.tableCell}>
                  <button
                    style={{...styles.actionButton, ...styles.viewButton}}
                    onClick={() => setViewingPayment(payment)}
                  >
                    <Eye size={14} />
                    View
                  </button>
                  <button
                    style={{...styles.actionButton, ...styles.editButton}}
                    onClick={() => setEditingPayment(payment)}
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                  {payment.status === 'pending' && (
                    <>
                      <button
                        style={{...styles.actionButton, ...styles.completeButton}}
                        onClick={() => updatePaymentStatus(payment.id, 'completed')}
                      >
                        <Check size={14} />
                        Complete
                      </button>
                      <button
                        style={{...styles.actionButton, ...styles.cancelButton}}
                        onClick={() => updatePaymentStatus(payment.id, 'cancelled')}
                      >
                        <X size={14} />
                        Cancel
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

      {/* View Payment Modal */}
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
              <strong>Amount:</strong> ₱{viewingPayment.amount.toLocaleString()}
            </div>
            <div style={styles.formGroup}>
              <strong>Due Date:</strong> {viewingPayment.dueDate}
            </div>
            <div style={styles.formGroup}>
              <strong>Payment Method:</strong> {viewingPayment.paymentMethod}
            </div>
            <div style={styles.formGroup}>
              <strong>Status:</strong> 
              <span
                style={{
                  ...styles.statusBadge,
                  backgroundColor: getStatusColor(viewingPayment.status),
                  marginLeft: '8px'
                }}
              >
                {viewingPayment.status}
              </span>
            </div>
            <div style={styles.formGroup}>
              <strong>Notes:</strong> {viewingPayment.notes}
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

      {/* Edit Payment Modal */}
      {editingPayment && (
        <div style={styles.modal} onClick={() => setEditingPayment(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalHeader}>Edit Payment - {editingPayment.id}</h2>
            
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.target)
              const updatedData = {
                studentName: formData.get('studentName'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                course: formData.get('course'),
                amount: parseInt(formData.get('amount')),
                dueDate: formData.get('dueDate'),
                paymentMethod: formData.get('paymentMethod'),
                notes: formData.get('notes')
              }
              updatePaymentDetails(editingPayment.id, updatedData)
            }}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Student Name</label>
                <input
                  type="text"
                  name="studentName"
                  defaultValue={editingPayment.studentName}
                  style={styles.formInput}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Email</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={editingPayment.email}
                  style={styles.formInput}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Phone</label>
                <input
                  type="text"
                  name="phone"
                  defaultValue={editingPayment.phone}
                  style={styles.formInput}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Course</label>
                <input
                  type="text"
                  name="course"
                  defaultValue={editingPayment.course}
                  style={styles.formInput}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Amount</label>
                <input
                  type="number"
                  name="amount"
                  defaultValue={editingPayment.amount}
                  style={styles.formInput}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Due Date</label>
                <input
                  type="date"
                  name="dueDate"
                  defaultValue={editingPayment.dueDate}
                  style={styles.formInput}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Payment Method</label>
                <select
                  name="paymentMethod"
                  defaultValue={editingPayment.paymentMethod}
                  style={styles.formInput}
                  required
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="GCash">GCash</option>
                  <option value="PayMaya">PayMaya</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Notes</label>
                <textarea
                  name="notes"
                  defaultValue={editingPayment.notes}
                  style={{...styles.formInput, height: '80px', resize: 'vertical'}}
                  rows="3"
                />
              </div>

              <div style={styles.formActions}>
                <button type="submit" style={styles.saveButton}>
                  Save Changes
                </button>
                <button
                  type="button"
                  style={styles.cancelButtonModal}
                  onClick={() => setEditingPayment(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default PendingPayment