import { useState, useEffect, useCallback } from 'react';

const CancelledPayments = () => {
  // State management
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // list, details
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [dateRange, setDateRange] = useState("all");
  const [courseFilter, setCourseFilter] = useState("");

  // Constants
  const ITEMS_PER_PAGE = 15;
  const API_BASE_URL = "http://localhost:3000/api";

  // Modern color scheme (same as Courses.jsx)
  const colors = {
    primary: '#4F46E5',
    primaryDark: '#4338CA',
    primaryLight: '#6366F1',
    secondary: '#10B981',
    secondaryDark: '#059669',
    warning: '#F59E0B',
    danger: '#EF4444',
    success: '#22C55E',
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

  // Icon components (following Courses.jsx pattern)
  const XCircleIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const DownloadIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  const FilterIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
    </svg>
  );

  const EyeIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );

  const ChevronLeftIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );

  const ChevronRightIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

  const AlertTriangleIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  );

  const LoadingSpinner = ({ size = 20 }) => (
    <svg width={size} height={size} className="spinner" viewBox="0 0 24 24">
      <circle className="spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  const BackIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );

  const CheckIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );

  const CurrencyIcon = ({ size = 16 }) => (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  // Styles following Courses.jsx pattern
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
    card: {
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      padding: '24px',
      marginBottom: '24px',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px',
    },
    title: {
      fontSize: '30px',
      fontWeight: 'bold',
      color: colors.gray[900],
    },
    subtitle: {
      color: colors.gray[600],
      fontSize: '16px',
      marginTop: '8px',
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
    button: {
      padding: '10px 16px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.15s ease-in-out',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
    },
    primaryButton: {
      backgroundColor: colors.primary,
      color: '#fff',
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      color: colors.primary,
      border: `1px solid ${colors.primary}`,
    },
    dangerButton: {
      backgroundColor: 'transparent',
      color: colors.danger,
      border: `1px solid ${colors.danger}`,
    },
    successButton: {
      backgroundColor: colors.success,
      color: '#fff',
    },
    statsContainer: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '20px',
      marginBottom: '24px',
    },
    statCard: {
      backgroundColor: '#ffeaa7',
      padding: '20px',
      borderRadius: '8px',
      textAlign: 'center',
      border: `1px solid #fdcb6e`,
    },
    statNumber: {
      fontSize: '32px',
      fontWeight: 'bold',
      color: colors.gray[900],
      marginBottom: '8px',
    },
    statLabel: {
      fontSize: '14px',
      color: colors.gray[600],
      fontWeight: '500',
    },
    filtersContainer: {
      backgroundColor: 'white',
      padding: '20px',
      marginBottom: '20px',
      borderRadius: '8px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    },
    filtersTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: colors.gray[900],
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    filtersRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 200px 200px 200px',
      gap: '20px',
      alignItems: 'end',
      '@media (max-width: 768px)': {
        gridTemplateColumns: '1fr',
        gap: '15px',
      },
    },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
    },
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      color: colors.gray[700],
      marginBottom: '8px',
    },
    input: {
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${colors.gray[300]}`,
      borderRadius: '6px',
      fontSize: '16px',
      outline: 'none',
      transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
    },
    select: {
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${colors.gray[300]}`,
      borderRadius: '6px',
      fontSize: '16px',
      outline: 'none',
      backgroundColor: 'white',
      cursor: 'pointer',
    },
    tableContainer: {
      backgroundColor: 'white',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    },
    tableHeader: {
      background: 'linear-gradient(135deg, #e17055 0%, #d63031 100%)',
      color: 'white',
      padding: '16px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    tableTitle: {
      fontSize: '16px',
      fontWeight: 'bold',
      margin: 0,
    },
    tableInfo: {
      fontSize: '14px',
      opacity: 0.9,
    },
    tableWrapper: {
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      minWidth: '1000px',
    },
    th: {
      textAlign: 'left',
      padding: '12px 16px',
      fontSize: '14px',
      fontWeight: '600',
      borderBottom: `2px solid ${colors.gray[200]}`,
      color: colors.gray[700],
      backgroundColor: '#e17055',
      color: 'white',
      borderRight: '1px solid rgba(255,255,255,0.1)',
    },
    td: {
      padding: '12px 16px',
      fontSize: '14px',
      borderBottom: `1px solid ${colors.gray[100]}`,
      borderRight: `1px solid ${colors.gray[100]}`,
      color: colors.gray[900],
    },
    statusCancelled: {
      color: colors.danger,
      fontWeight: '500',
      backgroundColor: colors.danger + '20',
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      textTransform: 'uppercase',
    },
    rejectionReason: {
      color: '#856404',
      fontSize: '11px',
      fontStyle: 'italic',
      maxWidth: '150px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    noResults: {
      textAlign: 'center',
      padding: '40px',
      color: colors.gray[500],
      fontSize: '14px',
    },
    loading: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px',
    },
    actionButton: {
      background: 'none',
      border: 'none',
      color: '#e17055',
      cursor: 'pointer',
      fontSize: '14px',
      padding: '6px 12px',
      borderRadius: '4px',
      transition: 'background-color 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    },
    pagination: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '10px',
      padding: '20px',
      backgroundColor: 'white',
      borderTop: `1px solid ${colors.gray[200]}`,
    },
    paginationButton: {
      padding: '8px 12px',
      border: `1px solid ${colors.gray[300]}`,
      backgroundColor: 'white',
      cursor: 'pointer',
      borderRadius: '4px',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    },
    paginationButtonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    paginationInfo: {
      fontSize: '14px',
      color: colors.gray[600],
      margin: '0 10px',
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
      padding: '20px',
    },
    modalContent: {
      backgroundColor: '#fff',
      borderRadius: '8px',
      padding: '24px',
      maxWidth: '600px',
      width: '90%',
      maxHeight: '90vh',
      overflowY: 'auto',
    },
    modalTitle: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '24px',
      color: colors.gray[900],
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    modalDetails: {
      display: 'grid',
      gap: '16px',
      fontSize: '16px',
      marginBottom: '32px',
    },
    modalDetailRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '12px 0',
      borderBottom: `1px solid ${colors.gray[200]}`,
    },
    modalLabel: {
      fontWeight: '600',
      color: colors.gray[600],
      minWidth: '140px',
    },
    modalValue: {
      color: colors.gray[900],
      textAlign: 'right',
      flex: 1,
    },
    modalActions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px',
    },
    closeButton: {
      padding: '12px 24px',
      color: colors.gray[600],
      backgroundColor: colors.gray[200],
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
    },
    rejectionDetailsBox: {
      backgroundColor: '#fff3cd',
      border: `1px solid #ffeaa7`,
      borderRadius: '6px',
      padding: '12px',
      marginTop: '8px',
    },
    rejectionTitle: {
      fontWeight: '600',
      color: '#856404',
      marginBottom: '4px',
      fontSize: '14px',
    },
    rejectionText: {
      color: '#856404',
      fontSize: '13px',
      lineHeight: '1.4',
    },
    backButton: {
      padding: '8px 12px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      backgroundColor: colors.gray[100],
      color: colors.gray[700],
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '20px',
    },
  };

  // Helper functions
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  // Clear success and error messages after 5 seconds (following Courses.jsx pattern)
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // API functions
    const fetchCancelledPayments = useCallback(async (filters = {}) => {
      try {
        const queryParams = new URLSearchParams();
        if (filters.student_search)
          queryParams.append("student_search", filters.student_search);
        if (filters.name_sort) queryParams.append("name_sort", filters.name_sort);
        if (filters.date_range)
          queryParams.append("date_range", filters.date_range);
        queryParams.append("status", "failed");

        const response = await fetch(`${API_BASE_URL}/payments?${queryParams}`, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) throw new Error("Failed to fetch cancelled payments");
        const data = await response.json();
        
        // Add debugging
        console.log("API Response:", data);
        console.log("Data type:", typeof data);
        console.log("Is array:", Array.isArray(data));
        
        return data;
      } catch (error) {
        console.error("Error fetching cancelled payments:", error);
        throw error;
      }
    }, []);
  // Fetch payments with filters and pagination
 // Fetch payments with filters and pagination
const fetchPayments = useCallback(async () => {
  try {
    setError(null);
    setLoading(true);
    
    const filters = {
      student_search: searchTerm,
      name_sort: sortBy === "name" ? "ascending" : undefined,
      date_range: dateRange !== "all" ? dateRange : undefined,
    };

    const apiResponse = await fetchCancelledPayments(filters);
    
    // Handle different API response structures
    let data;
    if (Array.isArray(apiResponse)) {
      data = apiResponse;
    } else if (apiResponse && Array.isArray(apiResponse.data)) {
      data = apiResponse.data;
    } else if (apiResponse && Array.isArray(apiResponse.payments)) {
      data = apiResponse.payments;
    } else {
      console.error("Unexpected API response structure:", apiResponse);
      throw new Error("Invalid data format received from API");
    }

    // Filter by course if selected
    let filteredData = data;
    if (courseFilter) {
      filteredData = data.filter(
        (payment) => payment.course_name === courseFilter
      );
    }

    // Ensure filteredData is still an array before sorting
    if (!Array.isArray(filteredData)) {
      console.error("Filtered data is not an array:", filteredData);
      throw new Error("Data filtering resulted in invalid format");
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

    // Apply pagination
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    setPayments(paginatedData);
    setTotalPages(Math.ceil(filteredData.length / ITEMS_PER_PAGE));
  } catch (error) {
    setError("Failed to fetch cancelled payments. Please try again.");
    console.error("Failed to fetch cancelled payments:", error);
  } finally {
    setLoading(false);
  }
}, [searchTerm, sortBy, dateRange, courseFilter, currentPage, fetchCancelledPayments]);


  // Effects
  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Get unique courses for filter
  const uniqueCourses = [
    ...new Set(payments.map((p) => p.course_name).filter(Boolean)),
  ];

  // Helper functions
  const handleExport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Payment ID,Student Name,Course,Amount,Cancelled Date,Payment Method,Reference Number,Rejection Reason,Status\n" +
      payments
        .map(
          (payment) =>
            `${payment.payment_id},"${payment.first_name} ${
              payment.last_name
            }",${payment.course_name},₱${payment.payment_amount},${
              payment.updated_at
            },${payment.method_name},${payment.reference_number || "N/A"},"${
              payment.notes || "No reason specified"
            }",Cancelled`
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cancelled_payments_page_${currentPage}.csv`);
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
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return `₱${(amount || 0).toLocaleString()}`;
  };

  const parseRejectionReason = (notes) => {
    if (!notes) return { reason: "No reason specified", details: "" };

    const colonIndex = notes.indexOf(":");
    if (colonIndex > 0) {
      return {
        reason: notes.substring(0, colonIndex),
        details: notes.substring(colonIndex + 1).trim(),
      };
    }
    return { reason: notes, details: "" };
  };

  // Calculate totals
  const totalAmount = payments.reduce(
    (sum, payment) => sum + (parseInt(payment.payment_amount) || 0),
    0
  );

  // Render payment details modal
  const renderPaymentDetailsModal = () => {
    if (!selectedPayment) return null;

    return (
      <div style={styles.modal} onClick={() => setSelectedPayment(null)}>
        <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <h3 style={styles.modalTitle}>
            <XCircleIcon size={24} />
            Cancelled Payment Details
          </h3>
          <div style={styles.modalDetails}>
            <div style={styles.modalDetailRow}>
              <span style={styles.modalLabel}>Payment ID:</span>
              <span style={styles.modalValue}>
                {selectedPayment.payment_id}
              </span>
            </div>
            <div style={styles.modalDetailRow}>
              <span style={styles.modalLabel}>Student Name:</span>
              <span style={styles.modalValue}>
                {selectedPayment.first_name} {selectedPayment.last_name}
              </span>
            </div>
            <div style={styles.modalDetailRow}>
              <span style={styles.modalLabel}>Student ID:</span>
              <span style={styles.modalValue}>
                {selectedPayment.student_id}
              </span>
            </div>
            <div style={styles.modalDetailRow}>
              <span style={styles.modalLabel}>Course:</span>
              <span style={styles.modalValue}>
                {selectedPayment.course_name}
              </span>
            </div>
            <div style={styles.modalDetailRow}>
              <span style={styles.modalLabel}>Batch:</span>
              <span style={styles.modalValue}>
                {selectedPayment.batch_identifier}
              </span>
            </div>
            <div style={styles.modalDetailRow}>
              <span style={styles.modalLabel}>Amount:</span>
              <span style={styles.modalValue}>
                {formatCurrency(selectedPayment.payment_amount)}
              </span>
            </div>
            <div style={styles.modalDetailRow}>
              <span style={styles.modalLabel}>Payment Method:</span>
              <span style={styles.modalValue}>
                {selectedPayment.method_name}
              </span>
            </div>
            <div style={styles.modalDetailRow}>
              <span style={styles.modalLabel}>Reference Number:</span>
              <span style={styles.modalValue}>
                {selectedPayment.reference_number || "N/A"}
              </span>
            </div>
            <div style={styles.modalDetailRow}>
              <span style={styles.modalLabel}>Processing Fee:</span>
              <span style={styles.modalValue}>
                {formatCurrency(selectedPayment.processing_fee || 0)}
              </span>
            </div>
            <div style={styles.modalDetailRow}>
              <span style={styles.modalLabel}>Payment Date:</span>
              <span style={styles.modalValue}>
                {formatDate(selectedPayment.payment_date)}
              </span>
            </div>
            <div style={styles.modalDetailRow}>
              <span style={styles.modalLabel}>Cancelled Date:</span>
              <span style={styles.modalValue}>
                {formatDate(selectedPayment.updated_at)}
              </span>
            </div>
            <div style={{ ...styles.modalDetailRow, borderBottom: "none" }}>
              <span style={styles.modalLabel}>Rejection Details:</span>
              <span style={styles.modalValue}>
                {selectedPayment.notes ? (
                  <div style={styles.rejectionDetailsBox}>
                    <div style={styles.rejectionTitle}>
                      {parseRejectionReason(selectedPayment.notes).reason}
                    </div>
                    {parseRejectionReason(selectedPayment.notes).details && (
                      <div style={styles.rejectionText}>
                        {parseRejectionReason(selectedPayment.notes).details}
                      </div>
                    )}
                  </div>
                ) : (
                  "No reason specified"
                )}
              </span>
            </div>
          </div>
          <div style={styles.modalActions}>
            <button
              onClick={() => setSelectedPayment(null)}
              style={styles.closeButton}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render main content
  const renderContent = () => {
    if (loading) {
      return (
        <div style={styles.loading}>
          <LoadingSpinner />
          <p style={{ marginTop: '16px', color: colors.gray[600] }}>Loading cancelled payments...</p>
        </div>
      );
    }

    return (
      <>
        {/* Stats Cards */}
        <div style={styles.statsContainer}>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>
              {payments.length}
            </div>
            <div style={styles.statLabel}>
              Cancelled (This Page)
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>
              {formatCurrency(totalAmount)}
            </div>
            <div style={styles.statLabel}>
              Total Amount (This Page)
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{currentPage}</div>
            <div style={styles.statLabel}>Current Page</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{totalPages}</div>
            <div style={styles.statLabel}>Total Pages</div>
          </div>
        </div>

        {/* Filters */}
        <div style={styles.filtersContainer}>
          <h3 style={styles.filtersTitle}>
            <FilterIcon size={20} />
            Filter Cancelled Payments
          </h3>
          <div style={styles.filtersRow}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>
                Search by Name/ID
              </label>
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
                <option value="latest">Latest Cancelled</option>
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
              <label style={styles.label}>
                Course Filter
              </label>
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
        <div style={styles.tableContainer}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>
              Cancelled Payments
            </h3>
            <span style={styles.tableInfo}>
              Page {currentPage} of {totalPages} | Showing {payments.length} of{" "}
              {totalPages * ITEMS_PER_PAGE} results
            </span>
          </div>

          {payments.length === 0 ? (
            <div style={styles.noResults}>
              <XCircleIcon size={48} />
              <p>No cancelled payments found</p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Payment ID</th>
                    <th style={styles.th}>Student Name</th>
                    <th style={styles.th}>Course</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Cancelled Date</th>
                    <th style={styles.th}>Payment Method</th>
                    <th style={styles.th}>Rejection Reason</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const rejectionInfo = parseRejectionReason(payment.notes);
                    return (
                      <tr key={payment.payment_id}>
                        <td style={styles.td}>
                          {payment.payment_id}
                        </td>
                        <td style={styles.td}>
                          {payment.first_name} {payment.last_name}
                        </td>
                        <td style={styles.td}>
                          {payment.course_name}
                        </td>
                        <td style={styles.td}>
                          {formatCurrency(payment.payment_amount)}
                        </td>
                        <td style={styles.td}>
                          {formatDate(payment.updated_at)}
                        </td>
                        <td style={styles.td}>
                          {payment.method_name}
                        </td>
                        <td style={styles.td}>
                          <div
                            style={styles.rejectionReason}
                            title={rejectionInfo.reason}
                          >
                            {rejectionInfo.reason}
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.statusCancelled}>Cancelled</span>
                        </td>
                        <td style={styles.td}>
                          <button
                            onClick={() => setSelectedPayment(payment)}
                            style={{
                              ...styles.actionButton,
                              marginRight: "8px",
                            }}
                            title="View Details"
                          >
                            <EyeIcon size={14} /> View
                          </button>
                          <button
                            onClick={handleExport}
                            style={styles.actionButton}
                            title="Export Data"
                          >
                            <DownloadIcon size={14} /> Export
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={styles.pagination}>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  ...styles.paginationButton,
                  ...(currentPage === 1 ? styles.paginationButtonDisabled : {}),
                }}
              >
                <ChevronLeftIcon size={16} />
                Previous
              </button>

              <span style={styles.paginationInfo}>
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  ...styles.paginationButton,
                  ...(currentPage === totalPages
                    ? styles.paginationButtonDisabled
                    : {}),
                }}
              >
                Next
                <ChevronRightIcon size={16} />
              </button>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div style={styles.container}>
      <style>
        {`
          .spinner {
            animation: spin 1s linear infinite;
          }
          .spinner-circle {
            opacity: 0.25;
          }
          .spinner-path {
            opacity: 0.75;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      <div style={styles.maxWidth}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Cancelled Payments</h1>
            <p style={styles.subtitle}>
              View and manage all cancelled/rejected student payments
            </p>
          </div>
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={handleExport}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryDark}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
          >
            <DownloadIcon />
            Export All
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{ ...styles.alert, ...styles.alertError }}>
            <AlertTriangleIcon />
            <span style={{ marginLeft: '8px' }}>{error}</span>
          </div>
        )}

        {success && (
          <div style={{ ...styles.alert, ...styles.alertSuccess }}>
            <CheckIcon />
            <span style={{ marginLeft: '8px' }}>{success}</span>
          </div>
        )}

        {/* Content */}
        {renderContent()}

        {/* Modal */}
        {renderPaymentDetailsModal()}
      </div>
    </div>
  );
};

export default CancelledPayments;