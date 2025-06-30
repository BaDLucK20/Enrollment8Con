import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  Download,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

// API functions
const API_BASE_URL = "http://localhost:3000/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const fetchCompletedPayments = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    if (filters.student_search)
      queryParams.append("student_search", filters.student_search);
    if (filters.name_sort) queryParams.append("name_sort", filters.name_sort);
    if (filters.date_range)
      queryParams.append("date_range", filters.date_range);

    console.log('🔍 Fetching completed payments...');
    console.log('Filters:', filters);
    console.log('Query URL:', `${API_BASE_URL}/payments/completed?${queryParams}`);

    const response = await fetch(
      `${API_BASE_URL}/payments/completed?${queryParams}`,
      {
        headers: getAuthHeaders(),
      }
    );

    console.log('📡 API Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ Completed payments received:', data.length, 'payments');
    if (data.length > 0) {
      console.log('📋 Sample payments:', data.slice(0, 3).map(p => ({
        id: p.payment_id,
        status: p.payment_status,
        student: `${p.first_name} ${p.last_name}`,
        updated: p.updated_at
      })));
    }
    
    return data;
  } catch (error) {
    console.error("❌ Error fetching completed payments:", error);
    throw error;
  }
};

const ITEMS_PER_PAGE = 15;

const CompletedPayments = () => {
  const [payments, setPayments] = useState([]);
  const [allPayments, setAllPayments] = useState([]); // Store all payments for filtering
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [dateRange, setDateRange] = useState("all");
  const [courseFilter, setCourseFilter] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [debugInfo, setDebugInfo] = useState(null);

  // Get unique courses for filter
  const uniqueCourses = [
    ...new Set(allPayments.map((p) => p.course_name).filter(Boolean)),
  ];

  // Fetch payments from API
  const fetchPayments = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError("");
      } else {
        setRefreshing(true);
      }
      
      console.log('🚀 Starting fetchPayments...');

      const filters = {
        student_search: searchTerm,
        name_sort: sortBy === "name" ? "ascending" : undefined,
        date_range: dateRange !== "all" ? dateRange : undefined,
      };

      const data = await fetchCompletedPayments(filters);
      
      // Store all payments for client-side filtering
      setAllPayments(data);
      
      // Apply client-side filtering and sorting
      applyFiltersAndPagination(data);
      
      setLastRefresh(new Date());
      
      if (!silent) {
        console.log('✅ Payments loaded successfully');
      }

    } catch (error) {
      console.error("❌ Failed to fetch completed payments:", error);
      setError(`Failed to fetch completed payments: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Apply filters and pagination to the data
  const applyFiltersAndPagination = (data) => {
    let filteredData = [...data];

    console.log('🔄 Applying filters to', filteredData.length, 'payments');

    // Filter by course if selected
    if (courseFilter) {
      filteredData = filteredData.filter(
        (payment) => payment.course_name === courseFilter
      );
      console.log('📚 After course filter:', filteredData.length, 'payments');
    }

    // Sort data
    switch (sortBy) {
      case "latest":
        filteredData.sort(
          (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
        );
        break;
      case "oldest":
        filteredData.sort(
          (a, b) => new Date(a.updated_at) - new Date(b.updated_at)
        );
        break;
      case "amount-high":
        filteredData.sort((a, b) => b.payment_amount - a.payment_amount);
        break;
      case "amount-low":
        filteredData.sort((a, b) => a.payment_amount - b.payment_amount);
        break;
      case "name":
        filteredData.sort((a, b) =>
          `${a.first_name} ${a.last_name}`.localeCompare(
            `${b.first_name} ${b.last_name}`
          )
        );
        break;
    }

    console.log('📊 After sorting:', filteredData.length, 'payments');

    // Apply pagination
    const totalPagesCalc = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    setTotalPages(totalPagesCalc);
    
    // Reset to page 1 if current page is beyond available pages
    const pageToUse = currentPage > totalPagesCalc ? 1 : currentPage;
    if (pageToUse !== currentPage) {
      setCurrentPage(pageToUse);
    }

    const startIndex = (pageToUse - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    console.log('📄 Pagination: page', pageToUse, 'showing', paginatedData.length, 'of', filteredData.length, 'total');

    setPayments(paginatedData);
  };

  // Initial load
  useEffect(() => {
    console.log('🎬 Component mounted - initial load');
    fetchPayments();
  }, []);

  // Re-apply filters when filter values change
  useEffect(() => {
    if (allPayments.length > 0) {
      console.log('🔄 Filters changed - reapplying filters');
      applyFiltersAndPagination(allPayments);
    }
  }, [searchTerm, sortBy, dateRange, courseFilter, currentPage, allPayments]);

  // Listen for payment status changes
  useEffect(() => {
    const handlePaymentStatusChange = (e) => {
      console.log('📢 Payment status change event received:', e.detail);
      if (e.detail?.action === 'approved') {
        console.log('💰 Payment approved - refreshing in 2 seconds...');
        setTimeout(() => {
          fetchPayments(true);
        }, 2000);
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === 'payment_status_updated') {
        console.log('🔄 Payment status updated - refreshing...');
        setTimeout(() => {
          fetchPayments(true);
        }, 1000);
      }
    };

    window.addEventListener('paymentStatusChanged', handlePaymentStatusChange);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('paymentStatusChanged', handlePaymentStatusChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Debug function to check API directly
  const checkDebugInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/debug/completed-payments`, {
        headers: getAuthHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        setDebugInfo(data);
        console.log('🔍 Debug info:', data);
      }
    } catch (error) {
      console.error('Debug check failed:', error);
    }
  };

  const handleExport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Payment ID,Student Name,Course,Amount Paid,Completed Date,Payment Method,Reference Number,Status\n" +
      payments
        .map(
          (payment) =>
            `${payment.payment_id},"${payment.first_name} ${
              payment.last_name
            }",${payment.course_name},₱${payment.payment_amount},${
              payment.updated_at
            },${payment.method_name},${
              payment.reference_number || "N/A"
            },${payment.payment_status}`
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `completed_payments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return "₱0";
    return `₱${parseInt(amount).toLocaleString()}`;
  };

  const totalAmount = payments.reduce(
    (sum, payment) => sum + (parseInt(payment.payment_amount) || 0),
    0
  );

  // Styles
  const styles = {
    container: {
      padding: "1.5rem",
      maxWidth: "1200px",
      margin: "0 auto",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "2rem",
      flexWrap: "wrap",
      gap: "1rem",
    },
    title: {
      fontSize: "2rem",
      fontWeight: "bold",
      color: "#1f2937",
    },
    subtitle: {
      color: "#6b7280",
      fontSize: "1rem",
      marginTop: "0.5rem",
    },
    lastRefresh: {
      color: "#9ca3af",
      fontSize: "0.75rem",
      fontStyle: "italic",
      marginTop: "0.25rem",
    },
    actions: {
      display: "flex",
      gap: "0.75rem",
      alignItems: "center",
    },
    button: {
      padding: "0.75rem 1rem",
      borderRadius: "0.5rem",
      border: "none",
      cursor: "pointer",
      fontSize: "0.875rem",
      fontWeight: "500",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      transition: "all 0.2s",
    },
    refreshButton: {
      backgroundColor: "#10b981",
      color: "white",
    },
    exportButton: {
      backgroundColor: "#3b82f6",
      color: "white",
    },
    debugButton: {
      backgroundColor: "#f59e0b",
      color: "white",
    },
    errorAlert: {
      backgroundColor: "#fef2f2",
      border: "1px solid #fecaca",
      color: "#dc2626",
      padding: "1rem",
      borderRadius: "0.5rem",
      marginBottom: "1rem",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    debugAlert: {
      backgroundColor: "#fffbeb",
      border: "1px solid #fed7aa",
      color: "#92400e",
      padding: "1rem",
      borderRadius: "0.5rem",
      marginBottom: "1rem",
      fontSize: "0.875rem",
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "1rem",
      marginBottom: "2rem",
    },
    statCard: {
      backgroundColor: "#e0f2fe",
      padding: "1.5rem",
      borderRadius: "0.5rem",
      textAlign: "center",
      border: "1px solid #b3e5fc",
    },
    statNumber: {
      fontSize: "2rem",
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: "0.5rem",
    },
    statLabel: {
      fontSize: "0.875rem",
      color: "#6b7280",
      fontWeight: "500",
    },
    filtersCard: {
      backgroundColor: "white",
      padding: "1.5rem",
      borderRadius: "0.5rem",
      marginBottom: "1.5rem",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    },
    filtersTitle: {
      fontSize: "1.125rem",
      fontWeight: "600",
      marginBottom: "1rem",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    filtersGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
      gap: "1rem",
    },
    inputGroup: {
      display: "flex",
      flexDirection: "column",
    },
    label: {
      fontSize: "0.875rem",
      fontWeight: "500",
      color: "#374151",
      marginBottom: "0.5rem",
    },
    input: {
      padding: "0.75rem",
      border: "1px solid #d1d5db",
      borderRadius: "0.375rem",
      fontSize: "0.875rem",
    },
    select: {
      padding: "0.75rem",
      border: "1px solid #d1d5db",
      borderRadius: "0.375rem",
      fontSize: "0.875rem",
      backgroundColor: "white",
    },
    tableCard: {
      backgroundColor: "white",
      borderRadius: "0.5rem",
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    },
    tableHeader: {
      background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
      color: "white",
      padding: "1rem 1.5rem",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    tableTitle: {
      fontSize: "1.125rem",
      fontWeight: "600",
    },
    tableInfo: {
      fontSize: "0.875rem",
      opacity: 0.9,
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
    },
    th: {
      padding: "1rem",
      textAlign: "left",
      fontSize: "0.875rem",
      fontWeight: "600",
      backgroundColor: "#065f46",
      color: "white",
      borderRight: "1px solid rgba(255,255,255,0.1)",
    },
    td: {
      padding: "1rem",
      fontSize: "0.875rem",
      borderBottom: "1px solid #f3f4f6",
      borderRight: "1px solid #f3f4f6",
    },
    statusBadge: {
      padding: "0.25rem 0.75rem",
      borderRadius: "9999px",
      fontSize: "0.75rem",
      fontWeight: "500",
      textTransform: "uppercase",
      backgroundColor: "#d1fae5",
      color: "#059669",
    },
    actionButton: {
      padding: "0.5rem",
      backgroundColor: "transparent",
      border: "none",
      color: "#059669",
      cursor: "pointer",
      borderRadius: "0.25rem",
      display: "flex",
      alignItems: "center",
      gap: "0.25rem",
      fontSize: "0.875rem",
    },
    noResults: {
      textAlign: "center",
      padding: "3rem",
      color: "#6b7280",
    },
    loading: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "3rem",
    },
    spinner: {
      width: "2rem",
      height: "2rem",
      border: "3px solid #f3f4f6",
      borderTop: "3px solid #059669",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    },
    pagination: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: "0.5rem",
      padding: "1rem",
      backgroundColor: "white",
      borderTop: "1px solid #f3f4f6",
    },
    paginationButton: {
      padding: "0.5rem 1rem",
      border: "1px solid #d1d5db",
      backgroundColor: "white",
      cursor: "pointer",
      borderRadius: "0.375rem",
      fontSize: "0.875rem",
      display: "flex",
      alignItems: "center",
      gap: "0.25rem",
    },
    paginationInfo: {
      fontSize: "0.875rem",
      color: "#6b7280",
      margin: "0 1rem",
    },
    modal: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 50,
      padding: "1rem",
    },
    modalContent: {
      backgroundColor: "white",
      borderRadius: "0.75rem",
      padding: "2rem",
      maxWidth: "600px",
      width: "100%",
      maxHeight: "90vh",
      overflowY: "auto",
    },
    modalTitle: {
      fontSize: "1.5rem",
      fontWeight: "bold",
      marginBottom: "1.5rem",
    },
    modalDetails: {
      display: "grid",
      gap: "1rem",
      marginBottom: "2rem",
    },
    modalRow: {
      display: "flex",
      justifyContent: "space-between",
      padding: "0.75rem 0",
      borderBottom: "1px solid #f3f4f6",
    },
    modalLabel: {
      fontWeight: "600",
      color: "#4b5563",
    },
    modalValue: {
      color: "#1f2937",
    },
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
        </div>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Completed Payments</h1>
          <p style={styles.subtitle}>
            View and manage all successfully completed student payments
          </p>
          <p style={styles.lastRefresh}>
            Last updated: {formatDate(lastRefresh)}
          </p>
        </div>
        <div style={styles.actions}>
          <button
            onClick={handleExport}
            style={{ ...styles.button, ...styles.exportButton }}
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={styles.errorAlert}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Debug Info */}
      {debugInfo && (
        <div style={styles.debugAlert}>
          <strong>Debug Info:</strong> Found {debugInfo.totalCompleted} completed payments in database.
          Status counts: {debugInfo.statusCounts.map(s => `${s.payment_status}: ${s.count}`).join(', ')}
        </div>
      )}

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{payments.length}</div>
          <div style={styles.statLabel}>Showing This Page</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{allPayments.length}</div>
          <div style={styles.statLabel}>Total Completed</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{formatCurrency(totalAmount)}</div>
          <div style={styles.statLabel}>Page Total</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{totalPages}</div>
          <div style={styles.statLabel}>Total Pages</div>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filtersCard}>
        <h3 style={styles.filtersTitle}>
          <Filter size={20} />
          Filter Completed Payments
        </h3>
        <div style={styles.filtersGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Search by Name/ID</label>
            <input
              type="text"
              placeholder="Enter student name or ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={styles.input}
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
              style={styles.select}
            >
              <option value="latest">Latest Completed</option>
              <option value="oldest">Oldest First</option>
              <option value="amount-high">Amount High to Low</option>
              <option value="amount-low">Amount Low to High</option>
              <option value="name">Student Name</option>
            </select>
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setCurrentPage(1);
              }}
              style={styles.select}
            >
              <option value="all">All Time</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 90 Days</option>
            </select>
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Course Filter</label>
            <select
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={styles.select}
            >
              <option value="">All Courses</option>
              {uniqueCourses.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h3 style={styles.tableTitle}>Completed Payments</h3>
          <span style={styles.tableInfo}>
            Page {currentPage} of {totalPages} | Showing {payments.length} of {allPayments.length} total
          </span>
        </div>

        {payments.length === 0 ? (
          <div style={styles.noResults}>
            <CheckCircle size={48} color="#ccc" />
            <p>No completed payments found</p>
            {allPayments.length === 0 && (
              <p>
                <button onClick={checkDebugInfo} style={{...styles.button, ...styles.debugButton}}>
                  Check Database Status
                </button>
              </p>
            )}
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Payment ID</th>
                    <th style={styles.th}>Student Name</th>
                    <th style={styles.th}>Course</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Completed Date</th>
                    <th style={styles.th}>Payment Method</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.payment_id}>
                      <td style={styles.td}>{payment.payment_id}</td>
                      <td style={styles.td}>
                        {payment.first_name} {payment.last_name}
                      </td>
                      <td style={styles.td}>{payment.course_name}</td>
                      <td style={styles.td}>
                        {formatCurrency(payment.payment_amount)}
                      </td>
                      <td style={styles.td}>
                        {formatDate(payment.updated_at)}
                      </td>
                      <td style={styles.td}>{payment.method_name || 'N/A'}</td>
                      <td style={styles.td}>
                        <span style={styles.statusBadge}>
                          {payment.payment_status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button
                          onClick={() => setSelectedPayment(payment)}
                          style={styles.actionButton}
                          title="View Details"
                        >
                          <Eye size={14} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={styles.pagination}>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={styles.paginationButton}
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <span style={styles.paginationInfo}>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={styles.paginationButton}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment Details Modal */}
      {selectedPayment && (
        <div style={styles.modal} onClick={() => setSelectedPayment(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Payment Details</h3>
            <div style={styles.modalDetails}>
              <div style={styles.modalRow}>
                <span style={styles.modalLabel}>Payment ID:</span>
                <span style={styles.modalValue}>{selectedPayment.payment_id}</span>
              </div>
              <div style={styles.modalRow}>
                <span style={styles.modalLabel}>Student Name:</span>
                <span style={styles.modalValue}>
                  {selectedPayment.first_name} {selectedPayment.last_name}
                </span>
              </div>
              <div style={styles.modalRow}>
                <span style={styles.modalLabel}>Student ID:</span>
                <span style={styles.modalValue}>{selectedPayment.student_id}</span>
              </div>
              <div style={styles.modalRow}>
                <span style={styles.modalLabel}>Course:</span>
                <span style={styles.modalValue}>{selectedPayment.course_name}</span>
              </div>
              <div style={styles.modalRow}>
                <span style={styles.modalLabel}>Amount:</span>
                <span style={styles.modalValue}>
                  {formatCurrency(selectedPayment.payment_amount)}
                </span>
              </div>
              <div style={styles.modalRow}>
                <span style={styles.modalLabel}>Payment Method:</span>
                <span style={styles.modalValue}>{selectedPayment.method_name || 'N/A'}</span>
              </div>
              <div style={styles.modalRow}>
                <span style={styles.modalLabel}>Reference Number:</span>
                <span style={styles.modalValue}>
                  {selectedPayment.reference_number || "N/A"}
                </span>
              </div>
              <div style={styles.modalRow}>
                <span style={styles.modalLabel}>Completed Date:</span>
                <span style={styles.modalValue}>
                  {formatDate(selectedPayment.updated_at)}
                </span>
              </div>
              <div style={styles.modalRow}>
                <span style={styles.modalLabel}>Status:</span>
                <span style={styles.modalValue}>{selectedPayment.payment_status}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <button
                onClick={() => setSelectedPayment(null)}
                style={{...styles.button, backgroundColor: '#6b7280', color: 'white'}}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompletedPayments;