import React, { useState, useEffect } from "react";
import { Check, X, Eye, Clock, Filter, ChevronDown } from "lucide-react";

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
    maxWidth: "500px",
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
};

// Mock API functions
const getPendingPaymentsAPI = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: "PAY-001",
          enrolleeName: "John Doe",
          enrolleeId: "STU-2024-001",
          paymentType: "Tuition",
          tuitionFee: 25000,
          paymentMethod: "Bank Transfer",
          uploadDate: "2024-01-15",
          status: "pending",
          dueDate: "2024-01-25",
          course: "Computer Science",
        },
        {
          id: "PAY-002",
          enrolleeName: "Jane Smith",
          enrolleeId: "STU-2024-002",
          paymentType: "Registration",
          tuitionFee: 5000,
          paymentMethod: "Credit Card",
          uploadDate: "2024-01-16",
          status: "pending",
          dueDate: "2024-01-26",
          course: "Business Administration",
        },
        {
          id: "PAY-005",
          enrolleeName: "Alex Johnson",
          enrolleeId: "STU-2024-005",
          paymentType: "Laboratory Fee",
          tuitionFee: 3000,
          paymentMethod: "Online Payment",
          uploadDate: "2024-01-17",
          status: "pending",
          dueDate: "2024-01-27",
          course: "Engineering",
        },
        {
          id: "PAY-006",
          enrolleeName: "Sarah Williams",
          enrolleeId: "STU-2024-006",
          paymentType: "Tuition",
          tuitionFee: 28000,
          paymentMethod: "Bank Transfer",
          uploadDate: "2024-01-18",
          status: "pending",
          dueDate: "2024-01-28",
          course: "Medical Technology",
        },
        {
          id: "PAY-007",
          enrolleeName: "Michael Brown",
          enrolleeId: "STU-2024-007",
          paymentType: "Miscellaneous",
          tuitionFee: 2500,
          paymentMethod: "Cash",
          uploadDate: "2024-01-19",
          status: "pending",
          dueDate: "2024-01-29",
          course: "Information Technology",
        },
      ]);
    }, 500);
  });
};

const processPaymentAPI = async (paymentId, action) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: `Payment ${action} successfully`,
      });
    }, 1000);
  });
};

const PendingPayments = ({ onPaymentProcessed }) => {
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // Filter states
  const [nameFilter, setNameFilter] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [dateRange, setDateRange] = useState("all");

  useEffect(() => {
    fetchPendingPayments();

    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Filter and sort payments whenever filters change
  useEffect(() => {
    let filtered = [...payments];

    // Filter by name
    if (nameFilter.trim()) {
      filtered = filtered.filter((payment) =>
        payment.enrolleeName.toLowerCase().includes(nameFilter.toLowerCase())
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
        const paymentDate = new Date(payment.uploadDate);
        return paymentDate >= filterDate;
      });
    }

    // Sort payments
    switch (sortBy) {
      case "latest":
        filtered.sort(
          (a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)
        );
        break;
      case "oldest":
        filtered.sort(
          (a, b) => new Date(a.uploadDate) - new Date(b.uploadDate)
        );
        break;
      case "amount-high":
        filtered.sort((a, b) => b.tuitionFee - a.tuitionFee);
        break;
      case "amount-low":
        filtered.sort((a, b) => a.tuitionFee - b.tuitionFee);
        break;
      case "due-date":
        filtered.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        break;
      default:
        break;
    }

    setFilteredPayments(filtered);
  }, [payments, nameFilter, sortBy, dateRange]);

  const fetchPendingPayments = async () => {
    try {
      const data = await getPendingPaymentsAPI();
      setPayments(data);
    } catch (error) {
      console.error("Failed to fetch pending payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentAction = async (paymentId, action) => {
    setProcessing(paymentId);
    try {
      const result = await processPaymentAPI(paymentId, action);
      if (result.success) {
        setPayments((prev) => prev.filter((p) => p.id !== paymentId));
        setSelectedPayment(null);
        onPaymentProcessed && onPaymentProcessed(paymentId, action);
      }
    } catch (error) {
      console.error("Payment processing failed:", error);
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
    (sum, payment) => sum + payment.tuitionFee,
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
    return `₱${amount.toLocaleString()}`;
  };

  // Mobile Card Component
  const MobilePaymentCard = ({ payment }) => (
    <div style={styles.mobileCard}>
      <div style={styles.mobileCardHeader}>
        <div>
          <div style={styles.mobileCardTitle}>{payment.enrolleeName}</div>
          <div style={styles.mobileCardSubtitle}>{payment.id}</div>
        </div>
        <div style={{ ...styles.statusBadge, ...styles.statusPending }}>
          {payment.status}
        </div>
      </div>

      <div style={styles.mobileCardDetails}>
        <div style={styles.mobileCardRow}>
          <span style={styles.mobileCardLabel}>Course</span>
          <span style={styles.mobileCardValue}>{payment.course}</span>
        </div>
        <div style={styles.mobileCardRow}>
          <span style={styles.mobileCardLabel}>Amount</span>
          <span style={styles.mobileCardValue}>
            {formatCurrency(payment.tuitionFee)}
          </span>
        </div>
        <div style={styles.mobileCardRow}>
          <span style={styles.mobileCardLabel}>Due Date</span>
          <span style={styles.mobileCardValue}>
            {formatDate(payment.dueDate)}
          </span>
        </div>
        <div style={styles.mobileCardRow}>
          <span style={styles.mobileCardLabel}>Upload Date</span>
          <span style={styles.mobileCardValue}>
            {formatDate(payment.uploadDate)}
          </span>
        </div>
      </div>

      <div style={styles.actionButtons}>
        <button
          style={getButtonStyle(
            styles.iconButton,
            { backgroundColor: "#2c5282" },
            `view-${payment.id}`
          )}
          onMouseEnter={() => setHoveredButton(`view-${payment.id}`)}
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
            `approve-${payment.id}`,
            processing === payment.id
          )}
          onMouseEnter={() => setHoveredButton(`approve-${payment.id}`)}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={() => handlePaymentAction(payment.id, "approved")}
          disabled={processing === payment.id}
          title="Approve Payment"
        >
          <Check style={styles.icon} />
        </button>
        <button
          style={getButtonStyle(
            { ...styles.iconButton, ...styles.rejectButton },
            { backgroundColor: "#c53030" },
            `reject-${payment.id}`,
            processing === payment.id
          )}
          onMouseEnter={() => setHoveredButton(`reject-${payment.id}`)}
          onMouseLeave={() => setHoveredButton(null)}
          onClick={() => handlePaymentAction(payment.id, "rejected")}
          disabled={processing === payment.id}
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
            <label style={styles.filterLabel}>Filter by Name</label>
            <input
              type="text"
              placeholder="Enter student name..."
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
              <option value="latest">Latest Uploaded</option>
              <option value="oldest">Oldest First</option>
              <option value="amount-high">Amount (High to Low)</option>
              <option value="amount-low">Amount (Low to High)</option>
              <option value="due-date">Due Date</option>
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
              <MobilePaymentCard key={payment.id} payment={payment} />
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
                  <th style={styles.tableHeaderCell}>Due Date</th>
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
                    key={payment.id}
                    style={{
                      ...styles.tableRow,
                      ...(hoveredRow === payment.id
                        ? styles.tableRowHover
                        : {}),
                    }}
                    onMouseEnter={() => setHoveredRow(payment.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td style={styles.tableCell}>{payment.id}</td>
                    <td style={styles.tableCell}>{payment.enrolleeName}</td>
                    <td style={styles.tableCell}>{payment.course}</td>
                    <td style={styles.tableCell}>
                      {formatCurrency(payment.tuitionFee)}
                    </td>
                    <td style={styles.tableCell}>
                      {formatDate(payment.dueDate)}
                    </td>
                    <td style={styles.tableCell}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          ...styles.statusPending,
                        }}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td style={{ ...styles.tableCell, borderRight: "none" }}>
                      <div style={styles.actionButtons}>
                        <button
                          style={getButtonStyle(
                            { ...styles.iconButton, ...styles.viewButton },
                            { backgroundColor: "#2c5282" },
                            `view-${payment.id}`
                          )}
                          onMouseEnter={() =>
                            setHoveredButton(`view-${payment.id}`)
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
                            `approve-${payment.id}`,
                            processing === payment.id
                          )}
                          onMouseEnter={() =>
                            setHoveredButton(`approve-${payment.id}`)
                          }
                          onMouseLeave={() => setHoveredButton(null)}
                          onClick={() =>
                            handlePaymentAction(payment.id, "approved")
                          }
                          disabled={processing === payment.id}
                          title="Approve Payment"
                        >
                          <Check style={styles.icon} />
                        </button>
                        <button
                          style={getButtonStyle(
                            { ...styles.iconButton, ...styles.rejectButton },
                            { backgroundColor: "#c53030" },
                            `reject-${payment.id}`,
                            processing === payment.id
                          )}
                          onMouseEnter={() =>
                            setHoveredButton(`reject-${payment.id}`)
                          }
                          onMouseLeave={() => setHoveredButton(null)}
                          onClick={() =>
                            handlePaymentAction(payment.id, "rejected")
                          }
                          disabled={processing === payment.id}
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
                  {selectedPayment.id}
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
                  {selectedPayment.enrolleeName}
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
                  {selectedPayment.enrolleeId}
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
                  {selectedPayment.course}
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
                  Payment Type:
                </span>
                <span
                  style={styles.modalValue}
                  className="pending-payments-modal-value"
                >
                  {selectedPayment.paymentType}
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
                  ₱{selectedPayment.tuitionFee.toLocaleString()}
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
                  {selectedPayment.paymentMethod}
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
                  Upload Date:
                </span>
                <span
                  style={styles.modalValue}
                  className="pending-payments-modal-value"
                >
                  {selectedPayment.uploadDate}
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
                  Due Date:
                </span>
                <span
                  style={styles.modalValue}
                  className="pending-payments-modal-value"
                >
                  {selectedPayment.dueDate}
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
                  handlePaymentAction(selectedPayment.id, "approve")
                }
                style={getButtonStyle(
                  styles.approveActionButton,
                  styles.approveActionButtonHover,
                  "approve-modal"
                )}
                className="pending-payments-modal-button"
                onMouseEnter={() => setHoveredButton("approve-modal")}
                onMouseLeave={() => setHoveredButton(null)}
              >
                Approve
              </button>
              <button
                onClick={() =>
                  handlePaymentAction(selectedPayment.id, "reject")
                }
                style={getButtonStyle(
                  styles.rejectActionButton,
                  styles.rejectActionButtonHover,
                  "reject-modal"
                )}
                className="pending-payments-modal-button"
                onMouseEnter={() => setHoveredButton("reject-modal")}
                onMouseLeave={() => setHoveredButton(null)}
              >
                Reject
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
