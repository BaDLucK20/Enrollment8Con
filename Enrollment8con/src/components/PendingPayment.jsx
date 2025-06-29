import React, { useState, useEffect } from "react";
import {
  Check,
  X,
  Eye,
  Clock,
  Filter,
  ChevronDown,
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

const fetchPendingPayments = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    if (filters.student_search)
      queryParams.append("student_search", filters.student_search);
    if (filters.name_sort) queryParams.append("name_sort", filters.name_sort);

    const response = await fetch(
      `${API_BASE_URL}/payments/pending?${queryParams}`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) throw new Error("Failed to fetch pending payments");
    return await response.json();
  } catch (error) {
    console.error("Error fetching pending payments:", error);
    throw error;
  }
};

const updatePaymentStatus = async (
  paymentId,
  status,
  notes = "",
  rejectionReason = ""
) => {
  try {
    const formattedNotes = rejectionReason
      ? `${rejectionReason}: ${notes}`
      : notes;

    console.log('Sending payment update request:', {
      paymentId,
      status,
      notes: formattedNotes
    });

    // Try main endpoint first
    let response = await fetch(
      `${API_BASE_URL}/payments/${paymentId}/status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          status,
          notes: formattedNotes,
        }),
      }
    );

    // If main endpoint fails, try backup endpoint
    if (!response.ok) {
      console.log('Main endpoint failed, trying backup endpoint...');
      
      response = await fetch(
        `${API_BASE_URL}/payments/${paymentId}/status-simple`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            status,
            notes: formattedNotes,
          }),
        }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorText;
      } catch {
        errorMessage = errorText;
      }

      throw new Error(
        `Failed to update payment status (HTTP ${response.status}): ${errorMessage}`
      );
    }

    const result = await response.json();
    console.log('Payment update successful:', result);
    return result;

  } catch (error) {
    console.error("Error updating payment status:", error);
    throw error;
  }
};

// Enhanced responsive styles object
const styles = {
  mainContainer: {
    backgroundColor: "#f5f5f0",
    minHeight: "100vh",
    padding: "24px",
  },
  headerCard: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "32px",
    marginBottom: "24px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  },
  headerTitle: {
    fontSize: "32px",
    fontWeight: "bold",
    color: "#2d3748",
    marginBottom: "8px",
  },
  headerSubtitle: {
    fontSize: "16px",
    color: "#718096",
  },
  statsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "24px",
    marginBottom: "24px",
  },
  statCard: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  },
  statNumber: {
    fontSize: "36px",
    fontWeight: "bold",
    color: "#2d3748",
    marginBottom: "8px",
  },
  statLabel: {
    fontSize: "14px",
    color: "#718096",
  },
  filterSection: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "24px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  },
  filterTitle: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#2d3748",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "20px",
    alignItems: "end",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  filterLabel: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#4a5568",
    marginBottom: "4px",
  },
  filterInput: {
    padding: "12px 16px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
    width: "100%",
  },
  filterSelect: {
    padding: "12px 16px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none",
    backgroundColor: "white",
    cursor: "pointer",
    transition: "border-color 0.2s",
    width: "100%",
  },
  tableContainer: {
    backgroundColor: "white",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  },
  tableHeader: {
    backgroundColor: "#4a5568",
    color: "white",
    padding: "20px 24px",
    fontSize: "18px",
    fontWeight: "bold",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHead: {
    background: "linear-gradient(135deg, #375e4b 0%, #6d8f81 100%)",
    color: "white",
  },
  tableHeaderCell: {
    padding: "16px 20px",
    textAlign: "left",
    fontSize: "14px",
    fontWeight: "600",
    borderRight: "1px solid rgba(255, 255, 255, 0.2)",
  },
  tableBody: {
    backgroundColor: "white",
  },
  tableRow: {
    borderBottom: "1px solid #e2e8f0",
    transition: "background-color 0.2s",
  },
  tableRowHover: {
    backgroundColor: "#f7fafc",
  },
  tableCell: {
    padding: "16px 20px",
    fontSize: "14px",
    color: "#2d3748",
    borderRight: "1px solid #e2e8f0",
  },
  actionButtons: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  iconButton: {
    padding: "8px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  viewButton: {
    backgroundColor: "#3182ce",
    color: "white",
  },
  approveButton: {
    backgroundColor: "#38a169",
    color: "white",
  },
  rejectButton: {
    backgroundColor: "#e53e3e",
    color: "white",
  },
  disabledButton: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  icon: {
    width: "16px",
    height: "16px",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    backgroundColor: "white",
  },
  emptyIcon: {
    margin: "0 auto 16px auto",
    height: "64px",
    width: "64px",
    color: "#a0aec0",
  },
  emptyText: {
    color: "#718096",
    fontSize: "16px",
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "200px",
    backgroundColor: "white",
  },
  spinner: {
    animation: "spin 1s linear infinite",
    borderRadius: "50%",
    height: "40px",
    width: "40px",
    borderWidth: "4px",
    borderStyle: "solid",
    borderColor: "transparent",
    borderTopColor: "#4a5568",
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
    padding: "20px",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "32px",
    maxWidth: "600px",
    width: "100%",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
  },
  modalTitle: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "24px",
    color: "#2d3748",
  },
  modalDetails: {
    display: "grid",
    gap: "16px",
    fontSize: "16px",
    marginBottom: "32px",
  },
  modalDetailRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  modalLabel: {
    fontWeight: "600",
    color: "#4a5568",
  },
  modalValue: {
    color: "#2d3748",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    flexWrap: "wrap",
  },
  closeButton: {
    padding: "12px 24px",
    color: "#4a5568",
    backgroundColor: "#e2e8f0",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "background-color 0.2s",
  },
  approveActionButton: {
    padding: "12px 24px",
    backgroundColor: "#38a169",
    color: "white",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "background-color 0.2s",
  },
  rejectActionButton: {
    padding: "12px 24px",
    backgroundColor: "#e53e3e",
    color: "white",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "background-color 0.2s",
  },
  rejectModal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    padding: "20px",
  },
  rejectModalContent: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "32px",
    maxWidth: "500px",
    width: "100%",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
  },
  textArea: {
    width: "100%",
    padding: "12px 16px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none",
    resize: "vertical",
    minHeight: "100px",
    marginTop: "8px",
  },
  mobileCard: {
    backgroundColor: "white",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "12px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  mobileCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  mobileCardTitle: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#2d3748",
  },
  mobileCardSubtitle: {
    fontSize: "14px",
    color: "#718096",
  },
  mobileCardDetails: {
    display: "grid",
    gap: "8px",
    marginBottom: "16px",
  },
  mobileCardRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mobileCardLabel: {
    fontSize: "12px",
    color: "#718096",
    fontWeight: "500",
  },
  mobileCardValue: {
    fontSize: "14px",
    color: "#2d3748",
    fontWeight: "500",
  },
  statusBadge: {
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "500",
    textTransform: "uppercase",
  },
  statusPending: {
    backgroundColor: "#fed7d7",
    color: "#c53030",
  },
  errorMessage: {
    backgroundColor: "#fed7d7",
    color: "#c53030",
    padding: "12px 16px",
    borderRadius: "8px",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  successMessage: {
    backgroundColor: "#c6f6d5",
    color: "#22543d",
    padding: "12px 16px",
    borderRadius: "8px",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
};

const REJECTION_REASONS = [
  "Invalid payment proof",
  "Insufficient amount",
  "Expired payment deadline",
  "Invalid bank reference",
  "Duplicate payment",
  "Wrong account details",
  "Payment method not accepted",
  "Student account suspended",
  "Other (please specify)",
];

const PendingPayments = ({ onPaymentProcessed }) => {
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Rejection modal states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [paymentToReject, setPaymentToReject] = useState(null);

  // Filter states
  const [nameFilter, setNameFilter] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [dateRange, setDateRange] = useState("all");

  useEffect(() => {
    fetchPayments();

    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Clear success and error messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Filter and sort payments whenever filters change
  useEffect(() => {
    let filtered = [...payments];

    // Filter by name
    if (nameFilter.trim()) {
      filtered = filtered.filter(
        (payment) =>
          `${payment.first_name} ${payment.last_name}`
            .toLowerCase()
            .includes(nameFilter.toLowerCase()) ||
          payment.student_id.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    // Filter by date range
    if (dateRange !== "all") {
      const today = new Date();
      const filterDate = new Date();

      switch (dateRange) {
        case "week":
          filterDate.setDate(today.getDate() - 7);
          break;
        case "month":
          filterDate.setMonth(today.getMonth() - 1);
          break;
        case "quarter":
          filterDate.setMonth(today.getMonth() - 3);
          break;
      }

      filtered = filtered.filter((payment) => {
        const paymentDate = new Date(payment.payment_date);
        return paymentDate >= filterDate;
      });
    }

    // Sort payments
    switch (sortBy) {
      case "latest":
        filtered.sort(
          (a, b) => new Date(b.payment_date) - new Date(a.payment_date)
        );
        break;
      case "oldest":
        filtered.sort(
          (a, b) => new Date(a.payment_date) - new Date(b.payment_date)
        );
        break;
      case "amount-high":
        filtered.sort((a, b) => b.payment_amount - a.payment_amount);
        break;
      case "amount-low":
        filtered.sort((a, b) => a.payment_amount - b.payment_amount);
        break;
      case "name":
        filtered.sort((a, b) =>
          `${a.first_name} ${a.last_name}`.localeCompare(
            `${b.first_name} ${b.last_name}`
          )
        );
        break;
      default:
        break;
    }

    setFilteredPayments(filtered);
  }, [payments, nameFilter, sortBy, dateRange]);

  const fetchPayments = async () => {
    try {
      setError("");
      const data = await fetchPendingPayments({
        student_search: nameFilter,
        name_sort: sortBy === "name" ? "ascending" : undefined,
      });
      setPayments(data);
    } catch (error) {
      setError("Failed to fetch pending payments. Please try again.");
      console.error("Failed to fetch pending payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentAction = async (paymentId, action) => {
    if (action === "failed") {
      setPaymentToReject(paymentId);
      setShowRejectModal(true);
      return;
    }

    setProcessing(paymentId);
    setError("");
    setSuccess("");

    try {
      // Map frontend actions to backend statuses
      let status;
      if (action === "approved") {
        status = "completed"; // Use 'completed' instead of 'confirmed'
      } else {
        status = action;
      }

      console.log('Processing payment action:', { paymentId, action, status });

      await updatePaymentStatus(paymentId, status);

      // Remove payment from the pending list
      setPayments((prev) => prev.filter((p) => p.payment_id !== paymentId));
      setSelectedPayment(null);
      
      // Show success message
      const actionText = action === "approved" ? "approved" : action;
      setSuccess(`Payment ${paymentId} has been ${actionText} successfully!`);

      // Call callback if provided
      if (onPaymentProcessed) {
        onPaymentProcessed(paymentId, action);
      }

    } catch (error) {
      console.error(`Error ${action}ing payment:`, error);
      setError(`Failed to ${action} payment. Please try again.`);
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectionReason) {
      setError("Please select a rejection reason.");
      return;
    }

    setProcessing(paymentToReject);
    setError("");
    setSuccess("");

    try {
      console.log('Rejecting payment:', { 
        paymentId: paymentToReject, 
        reason: rejectionReason, 
        notes: rejectionNotes 
      });

      await updatePaymentStatus(
        paymentToReject,
        "failed",
        rejectionNotes,
        rejectionReason
      );

      // Remove payment from the pending list
      setPayments((prev) =>
        prev.filter((p) => p.payment_id !== paymentToReject)
      );
      
      // Close modals and reset state
      setShowRejectModal(false);
      setSelectedPayment(null);
      setPaymentToReject(null);
      setRejectionReason("");
      setRejectionNotes("");
      
      // Show success message
      setSuccess(`Payment ${paymentToReject} has been rejected successfully!`);

      // Call callback if provided
      if (onPaymentProcessed) {
        onPaymentProcessed(paymentToReject, "failed");
      }

    } catch (error) {
      console.error("Error rejecting payment:", error);
      setError("Failed to reject payment. Please try again.");
    } finally {
      setProcessing(null);
    }
  };

  const getButtonStyle = (
    baseStyle,
    hoverStyle,
    buttonId,
    isDisabled = false
  ) => {
    if (isDisabled) {
      return { ...baseStyle, ...styles.disabledButton };
    }
    return hoveredButton === buttonId
      ? { ...baseStyle, ...hoverStyle }
      : baseStyle;
  };

  const totalPendingAmount = payments.reduce(
    (sum, payment) => sum + (parseInt(payment.payment_amount) || 0),
    0
  );

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

  // Mobile Card Component
  const MobilePaymentCard = ({ payment }) => (
    <div style={styles.mobileCard}>
      <div style={styles.mobileCardHeader}>
        <div>
          <div style={styles.mobileCardTitle}>
            {payment.first_name} {payment.last_name}
          </div>
          <div style={styles.mobileCardSubtitle}>{payment.payment_id}</div>
        </div>
        <div style={{ ...styles.statusBadge, ...styles.statusPending }}>
          {payment.payment_status}
        </div>
      </div>

      <div style={styles.mobileCardDetails}>
        <div style={styles.mobileCardRow}>
          <span style={styles.mobileCardLabel}>Course</span>
          <span style={styles.mobileCardValue}>{payment.course_name}</span>
        </div>
        <div style={styles.mobileCardRow}>
          <span style={styles.mobileCardLabel}>Amount</span>
          <span style={styles.mobileCardValue}>
            {formatCurrency(payment.payment_amount)}
          </span>
        </div>
        <div style={styles.mobileCardRow}>
          <span style={styles.mobileCardLabel}>Method</span>
          <span style={styles.mobileCardValue}>{payment.method_name}</span>
        </div>
        <div style={styles.mobileCardRow}>
          <span style={styles.mobileCardLabel}>Date</span>
          <span style={styles.mobileCardValue}>
            {formatDate(payment.payment_date)}
          </span>
        </div>
      </div>

      <div style={styles.actionButtons}>
        <button
          style={getButtonStyle(
            styles.iconButton,
            { backgroundColor: "#2c5282" },
            `view-${payment.payment_id}`
          )}
          onMouseEnter={() => setHoveredButton(`view-${payment.payment_id}`)}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={() => setSelectedPayment(payment)}
          title="View Details"
        >
          <Eye style={styles.icon} />
        </button>
        <button
          style={getButtonStyle(
            { ...styles.iconButton, ...styles.approveButton },
            { backgroundColor: "#2f855a" },
            `approve-${payment.payment_id}`,
            processing === payment.payment_id
          )}
          onMouseEnter={() => setHoveredButton(`approve-${payment.payment_id}`)}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={() => handlePaymentAction(payment.payment_id, "approved")}
          disabled={processing === payment.payment_id}
          title="Approve Payment"
        >
          <Check style={styles.icon} />
        </button>
        <button
          style={getButtonStyle(
            { ...styles.iconButton, ...styles.rejectButton },
            { backgroundColor: "#c53030" },
            `reject-${payment.payment_id}`,
            processing === payment.payment_id
          )}
          onMouseEnter={() => setHoveredButton(`reject-${payment.payment_id}`)}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={() => handlePaymentAction(payment.payment_id, "failed")}
          disabled={processing === payment.payment_id}
          title="Reject Payment"
        >
          <X style={styles.icon} />
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={styles.mainContainer}>
        <div style={styles.headerCard}>
          <h1 style={styles.headerTitle}>Pending Payments</h1>
          <p style={styles.headerSubtitle}>
            Manage and track all pending student payments
          </p>
        </div>
        <div style={styles.tableContainer}>
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
          </div>
        </div>
        <style>
          {`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  return (
    <div style={styles.mainContainer}>
      {/* Header */}
      <div style={styles.headerCard}>
        <h1 style={styles.headerTitle}>Pending Payments</h1>
        <p style={styles.headerSubtitle}>
          Manage and track all pending student payments
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div style={styles.errorMessage}>
          <AlertCircle style={styles.icon} />
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div style={styles.successMessage}>
          <Check style={styles.icon} />
          {success}
        </div>
      )}

      {/* Stats Cards */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{payments.length}</div>
          <div style={styles.statLabel}>Total Pending</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>
            {formatCurrency(totalPendingAmount)}
          </div>
          <div style={styles.statLabel}>Total Pending Amount</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{filteredPayments.length}</div>
          <div style={styles.statLabel}>Filtered Results</div>
        </div>
      </div>

      {/* Filter Section */}
      <div style={styles.filterSection}>
        <div style={styles.filterTitle}>
          <Filter style={styles.icon} />
          Filter Pending Payments
        </div>
        <div style={styles.filterGrid}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Filter by Name/ID</label>
            <input
              type="text"
              placeholder="Enter student name or ID..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              style={styles.filterInput}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="latest">Latest Submitted</option>
              <option value="oldest">Oldest First</option>
              <option value="amount-high">Amount (High to Low)</option>
              <option value="amount-low">Amount (Low to High)</option>
              <option value="name">Student Name</option>
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
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

      {/* Payment Table/Cards */}
      <div style={styles.tableContainer}>
        <div style={styles.tableHeader}>
          Payment Tracker (Filtered: {filteredPayments.length})
        </div>

        {filteredPayments.length === 0 ? (
          <div style={styles.emptyState}>
            <Clock style={styles.emptyIcon} />
            <p style={styles.emptyText}>
              {nameFilter || dateRange !== "all"
                ? "No payments match your filters"
                : "No pending payments found"}
            </p>
          </div>
        ) : isMobile ? (
          <div style={{ padding: "16px" }}>
            {filteredPayments.map((payment) => (
              <MobilePaymentCard key={payment.payment_id} payment={payment} />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead style={styles.tableHead}>
                <tr>
                  <th style={styles.tableHeaderCell}>Payment ID</th>
                  <th style={styles.tableHeaderCell}>Student Name</th>
                  <th style={styles.tableHeaderCell}>Course</th>
                  <th style={styles.tableHeaderCell}>Amount</th>
                  <th style={styles.tableHeaderCell}>Method</th>
                  <th style={styles.tableHeaderCell}>Date</th>
                  <th style={styles.tableHeaderCell}>Status</th>
                  <th
                    style={{ ...styles.tableHeaderCell, borderRight: "none" }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody style={styles.tableBody}>
                {filteredPayments.map((payment) => (
                  <tr
                    key={payment.payment_id}
                    style={{
                      ...styles.tableRow,
                      ...(hoveredRow === payment.payment_id
                        ? styles.tableRowHover
                        : {}),
                    }}
                    onMouseEnter={() => setHoveredRow(payment.payment_id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td style={styles.tableCell}>{payment.payment_id}</td>
                    <td style={styles.tableCell}>
                      {payment.first_name} {payment.last_name}
                    </td>
                    <td style={styles.tableCell}>{payment.course_name}</td>
                    <td style={styles.tableCell}>
                      {formatCurrency(payment.payment_amount)}
                    </td>
                    <td style={styles.tableCell}>{payment.method_name}</td>
                    <td style={styles.tableCell}>
                      {formatDate(payment.payment_date)}
                    </td>
                    <td style={styles.tableCell}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          ...styles.statusPending,
                        }}
                      >
                        {payment.payment_status}
                      </span>
                    </td>
                    <td style={{ ...styles.tableCell, borderRight: "none" }}>
                      <div style={styles.actionButtons}>
                        <button
                          style={getButtonStyle(
                            { ...styles.iconButton, ...styles.viewButton },
                            { backgroundColor: "#2c5282" },
                            `view-${payment.payment_id}`
                          )}
                          onMouseEnter={() =>
                            setHoveredButton(`view-${payment.payment_id}`)
                          }
                          onMouseLeave={() => setHoveredButton(null)}
                          onClick={() => setSelectedPayment(payment)}
                          title="View Details"
                        >
                          <Eye style={styles.icon} />
                        </button>
                        <button
                          style={getButtonStyle(
                            { ...styles.iconButton, ...styles.approveButton },
                            { backgroundColor: "#2f855a" },
                            `approve-${payment.payment_id}`,
                            processing === payment.payment_id
                          )}
                          onMouseEnter={() =>
                            setHoveredButton(`approve-${payment.payment_id}`)
                          }
                          onMouseLeave={() => setHoveredButton(null)}
                          onClick={() =>
                            handlePaymentAction(payment.payment_id, "approved")
                          }
                          disabled={processing === payment.payment_id}
                          title="Approve Payment"
                        >
                          <Check style={styles.icon} />
                        </button>
                        <button
                          style={getButtonStyle(
                            { ...styles.iconButton, ...styles.rejectButton },
                            { backgroundColor: "#c53030" },
                            `reject-${payment.payment_id}`,
                            processing === payment.payment_id
                          )}
                          onMouseEnter={() =>
                            setHoveredButton(`reject-${payment.payment_id}`)
                          }
                          onMouseLeave={() => setHoveredButton(null)}
                          onClick={() =>
                            handlePaymentAction(payment.payment_id, "failed")
                          }
                          disabled={processing === payment.payment_id}
                          title="Reject Payment"
                        >
                          <X style={styles.icon} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Details Modal */}
      {selectedPayment && (
        <div style={styles.modal} className="pending-payments-modal">
          <div
            style={styles.modalContent}
            className="pending-payments-modal-content"
          >
            <h3 style={styles.modalTitle}>Payment Details</h3>
            <div
              style={styles.modalDetails}
              className="pending-payments-modal-details"
            >
              <div
                style={styles.modalDetailRow}
                className="pending-payments-modal-row"
              >
                <span
                  style={styles.modalLabel}
                  className="pending-payments-modal-label"
                >
                  Payment ID:
                </span>
                <span
                  style={styles.modalValue}
                  className="pending-payments-modal-value"
                >
                  {selectedPayment.payment_id}
                </span>
              </div>
              <div
                style={styles.modalDetailRow}
                className="pending-payments-modal-row"
              >
                <span
                  style={styles.modalLabel}
                  className="pending-payments-modal-label"
                >
                  Student Name:
                </span>
                <span
                  style={styles.modalValue}
                  className="pending-payments-modal-value"
                >
                  {selectedPayment.first_name} {selectedPayment.last_name}
                </span>
              </div>
              <div
                style={styles.modalDetailRow}
                className="pending-payments-modal-row"
              >
                <span
                  style={styles.modalLabel}
                  className="pending-payments-modal-label"
                >
                  Student ID:
                </span>
                <span
                  style={styles.modalValue}
                  className="pending-payments-modal-value"
                >
                  {selectedPayment.student_id}
                </span>
              </div>
              <div
                style={styles.modalDetailRow}
                className="pending-payments-modal-row"
              >
                <span
                  style={styles.modalLabel}
                  className="pending-payments-modal-label"
                >
                  Course:
                </span>
                <span
                  style={styles.modalValue}
                  className="pending-payments-modal-value"
                >
                  {selectedPayment.course_name}
                </span>
              </div>
              <div
                style={styles.modalDetailRow}
                className="pending-payments-modal-row"
              >
                <span
                  style={styles.modalLabel}
                  className="pending-payments-modal-label"
                >
                  Batch:
                </span>
                <span
                  style={styles.modalValue}
                  className="pending-payments-modal-value"
                >
                  {selectedPayment.batch_identifier}
                </span>
              </div>
              <div
                style={styles.modalDetailRow}
                className="pending-payments-modal-row"
              >
                <span
                  style={styles.modalLabel}
                  className="pending-payments-modal-label"
                >
                  Amount:
                </span>
                <span
                  style={styles.modalValue}
                  className="pending-payments-modal-value"
                >
                  {formatCurrency(selectedPayment.payment_amount)}
                </span>
              </div>
              <div
                style={styles.modalDetailRow}
                className="pending-payments-modal-row"
              >
                <span
                  style={styles.modalLabel}
                  className="pending-payments-modal-label"
                >
                  Payment Method:
                </span>
                <span
                  style={styles.modalValue}
                  className="pending-payments-modal-value"
                >
                  {selectedPayment.method_name}
                </span>
              </div>
              <div
                style={styles.modalDetailRow}
                className="pending-payments-modal-row"
              >
                <span
                  style={styles.modalLabel}
                  className="pending-payments-modal-label"
                >
                  Reference Number:
                </span>
                <span
                  style={styles.modalValue}
                  className="pending-payments-modal-value"
                >
                  {selectedPayment.reference_number || "N/A"}
                </span>
              </div>
              <div
                style={styles.modalDetailRow}
                className="pending-payments-modal-row"
              >
                <span
                  style={styles.modalLabel}
                  className="pending-payments-modal-label"
                >
                  Current Balance:
                </span>
                <span
                  style={styles.modalValue}
                  className="pending-payments-modal-value"
                >
                  {formatCurrency(selectedPayment.balance)}
                </span>
              </div>
              <div
                style={{ ...styles.modalDetailRow, borderBottom: "none" }}
                className="pending-payments-modal-row"
              >
                <span
                  style={styles.modalLabel}
                  className="pending-payments-modal-label"
                >
                  Payment Date:
                </span>
                <span
                  style={styles.modalValue}
                  className="pending-payments-modal-value"
                >
                  {formatDate(selectedPayment.payment_date)}
                </span>
              </div>
            </div>
            <div
              style={styles.modalActions}
              className="pending-payments-modal-actions"
            >
              <button
                onClick={() => setSelectedPayment(null)}
                style={getButtonStyle(
                  styles.closeButton,
                  styles.closeButtonHover,
                  "close-modal"
                )}
                className="pending-payments-modal-button"
                onMouseEnter={() => setHoveredButton("close-modal")}
                onMouseLeave={() => setHoveredButton(null)}
              >
                Close
              </button>
              <button
                onClick={() =>
                  handlePaymentAction(selectedPayment.payment_id, "approved")
                }
                style={getButtonStyle(
                  styles.approveActionButton,
                  styles.approveActionButtonHover,
                  "approve-modal"
                )}
                className="pending-payments-modal-button"
                onMouseEnter={() => setHoveredButton("approve-modal")}
                onMouseLeave={() => setHoveredButton(null)}
                disabled={processing === selectedPayment.payment_id}
              >
                {processing === selectedPayment.payment_id
                  ? "Processing..."
                  : "Approve"}
              </button>
              <button
                onClick={() =>
                  handlePaymentAction(selectedPayment.payment_id, "failed")
                }
                style={getButtonStyle(
                  styles.rejectActionButton,
                  styles.rejectActionButtonHover,
                  "reject-modal"
                )}
                className="pending-payments-modal-button"
                onMouseEnter={() => setHoveredButton("reject-modal")}
                onMouseLeave={() => setHoveredButton(null)}
                disabled={processing === selectedPayment.payment_id}
              >
                {processing === selectedPayment.payment_id
                  ? "Processing..."
                  : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div style={styles.rejectModal}>
          <div style={styles.rejectModalContent}>
            <h3 style={styles.modalTitle}>Reject Payment</h3>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Rejection Reason *</label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">Select a reason...</option>
                {REJECTION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Additional Notes</label>
              <textarea
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Enter additional details (optional)..."
                style={styles.textArea}
              />
            </div>
            <div style={styles.modalActions}>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setPaymentToReject(null);
                  setRejectionReason("");
                  setRejectionNotes("");
                }}
                style={styles.closeButton}
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                style={styles.rejectActionButton}
                disabled={!rejectionReason || processing === paymentToReject}
              >
                {processing === paymentToReject
                  ? "Processing..."
                  : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
         @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @media (max-width: 480px) {
            .stats-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default PendingPayments;