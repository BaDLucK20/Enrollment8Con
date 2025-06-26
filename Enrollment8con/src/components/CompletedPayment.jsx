import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  Download,
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// API functions
const API_BASE_URL = "http://localhost:3000/api";

const getAuthHeaders = () => {
  const token =
    typeof window !== "undefined" && window.localStorage
      ? window.localStorage.getItem("token")
      : "";
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

    const response = await fetch(
      `${API_BASE_URL}/payments/completed?${queryParams}`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) throw new Error("Failed to fetch completed payments");
    return await response.json();
  } catch (error) {
    console.error("Error fetching completed payments:", error);
    throw error;
  }
};

const ITEMS_PER_PAGE = 15;

// Responsive hook similar to UploadPayment
const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [screenSize, setScreenSize] = useState("lg");

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);

      if (width < 640) {
        setScreenSize("xs");
      } else if (width < 768) {
        setScreenSize("sm");
      } else if (width < 1024) {
        setScreenSize("md");
      } else {
        setScreenSize("lg");
      }
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  return { isMobile, screenSize };
};

const CompletedPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [dateRange, setDateRange] = useState("all");
  const [courseFilter, setCourseFilter] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const { isMobile, screenSize } = useResponsive();

  // Get unique courses for filter
  const uniqueCourses = [
    ...new Set(payments.map((p) => p.course_name).filter(Boolean)),
  ];

  useEffect(() => {
    fetchPayments();
  }, [searchTerm, sortBy, dateRange, courseFilter, currentPage]);

  const fetchPayments = async () => {
    try {
      setError("");
      const filters = {
        student_search: searchTerm,
        name_sort: sortBy === "name" ? "ascending" : undefined,
        date_range: dateRange !== "all" ? dateRange : undefined,
      };

      const data = await fetchCompletedPayments(filters);

      // Filter by course if selected
      let filteredData = data;
      if (courseFilter) {
        filteredData = data.filter(
          (payment) => payment.course_name === courseFilter
        );
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
      setError("Failed to fetch completed payments. Please try again.");
      console.error("Failed to fetch completed payments:", error);
    } finally {
      setLoading(false);
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
            },Completed`
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `completed_payments_page_${currentPage}.csv`);
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
    if (!amount || amount === 0) return "₱0";

    // For very large numbers, use abbreviated format
    if (amount >= 1000000) {
      return `₱${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `₱${(amount / 1000).toFixed(1)}K`;
    }

    return `₱${amount.toLocaleString()}`;
  };

  const totalAmount = payments.reduce(
    (sum, payment) => sum + (parseInt(payment.payment_amount) || 0),
    0
  );

  // Improved responsive styles based on UploadPayment patterns
  const styles = {
    container: {
      width: "100%",
      // Remove background color to let dashboard handle it
    },
    mainContent: {
      padding: isMobile ? "0" : "0",
      width: "100%",
    },
    contentWrapper: {
      maxWidth: "100%",
      margin: "0",
      padding: isMobile ? "1rem" : "1.5rem",
    },
    errorMessage: {
      backgroundColor: "#fef2f2",
      color: "#dc2626",
      padding: isMobile ? "0.75rem" : "1rem",
      borderRadius: "0.5rem",
      marginBottom: "1rem",
      border: "1px solid #fecaca",
      fontSize: isMobile ? "0.875rem" : "1rem",
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: isMobile
        ? screenSize === "xs"
          ? "1fr"
          : "repeat(2, 1fr)"
        : "repeat(auto-fit, minmax(220px, 1fr))", // Increased min width
      gap: isMobile ? "0.75rem" : "1rem",
      marginBottom: "1.5rem",
    },
    statsCard: {
      backgroundColor: "#e0f2fe",
      padding: isMobile ? "0.75rem" : "1.25rem",
      borderRadius: "0.5rem",
      textAlign: "center",
      border: "1px solid #b3e5fc",
      minHeight: isMobile ? "60px" : "80px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      minWidth: 0, // Allow shrinking
      overflow: "hidden", // Prevent overflow
    },
    statsNumber: {
      fontSize: isMobile ? "1.125rem" : "1.875rem", // Slightly smaller to prevent overflow
      fontWeight: "700",
      color: "#1f2937",
      marginBottom: "0.25rem",
      lineHeight: "1.1",
      wordBreak: "break-word", // Break long numbers if needed
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: "100%", // Ensure it doesn't exceed container width
    },
    statsLabel: {
      fontSize: isMobile ? "0.625rem" : "0.75rem",
      color: "#6b7280",
      fontWeight: "500",
      lineHeight: "1.2",
      overflow: "hidden",
      textOverflow: "ellipsis",
      wordBreak: "break-word",
    },
    filtersContainer: {
      backgroundColor: "white",
      padding: isMobile ? "1rem" : "1.25rem",
      marginBottom: "1rem",
      borderRadius: "0.5rem",
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
      border: "1px solid #e5e7eb",
    },
    filtersTitle: {
      fontSize: isMobile ? "1rem" : "1.125rem",
      fontWeight: "600",
      color: "#1f2937",
      marginBottom: "1rem",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    filtersGrid: {
      display: "grid",
      gridTemplateColumns: isMobile
        ? "1fr"
        : screenSize === "md"
        ? "repeat(2, 1fr)"
        : "repeat(4, 1fr)",
      gap: isMobile ? "0.75rem" : "1rem",
    },
    inputGroup: {
      display: "flex",
      flexDirection: "column",
    },
    label: {
      fontSize: isMobile ? "0.8rem" : "0.875rem",
      fontWeight: "500",
      color: "#374151",
      marginBottom: "0.5rem",
    },
    input: {
      padding: isMobile ? "0.6rem" : "0.75rem",
      border: "1px solid #d1d5db",
      borderRadius: "0.375rem",
      fontSize: isMobile ? "0.9rem" : "0.875rem",
      outline: "none",
      transition: "border-color 0.2s",
      width: "100%",
      boxSizing: "border-box",
    },
    select: {
      padding: isMobile ? "0.6rem" : "0.75rem",
      border: "1px solid #d1d5db",
      borderRadius: "0.375rem",
      fontSize: isMobile ? "0.9rem" : "0.875rem",
      outline: "none",
      backgroundColor: "white",
      cursor: "pointer",
      width: "100%",
      boxSizing: "border-box",
    },
    tableContainer: {
      backgroundColor: "white",
      borderRadius: "0.5rem",
      overflow: "hidden",
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
      border: "1px solid #e5e7eb",
    },
    tableHeader: {
      background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
      color: "white",
      padding: isMobile ? "0.75rem" : "1rem 1.25rem",
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      justifyContent: "space-between",
      alignItems: isMobile ? "flex-start" : "center",
      gap: isMobile ? "0.5rem" : "0",
    },
    tableTitle: {
      fontSize: isMobile ? "1rem" : "1.125rem",
      fontWeight: "600",
      margin: 0,
    },
    tableInfo: {
      fontSize: isMobile ? "0.75rem" : "0.875rem",
      opacity: 0.9,
    },
    tableWrapper: {
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      minWidth: isMobile ? "700px" : "900px",
    },
    tableHeaderRow: {
      backgroundColor: "#065f46",
      color: "white",
    },
    th: {
      padding: isMobile ? "0.6rem 0.4rem" : "0.875rem 1rem",
      textAlign: "left",
      fontSize: isMobile ? "0.7rem" : "0.875rem",
      fontWeight: "600",
      borderRight: "1px solid rgba(255,255,255,0.1)",
      whiteSpace: "nowrap",
    },
    td: {
      padding: isMobile ? "0.6rem 0.4rem" : "0.875rem 1rem",
      fontSize: isMobile ? "0.7rem" : "0.875rem",
      borderBottom: "1px solid #f3f4f6",
      borderRight: "1px solid #f3f4f6",
      whiteSpace: "nowrap",
    },
    statusCompleted: {
      color: "#059669",
      fontWeight: "500",
      backgroundColor: "#d1fae5",
      padding: isMobile ? "0.125rem 0.5rem" : "0.25rem 0.75rem",
      borderRadius: "9999px",
      fontSize: isMobile ? "0.625rem" : "0.75rem",
      textTransform: "uppercase",
      display: "inline-block",
    },
    noResults: {
      textAlign: "center",
      padding: isMobile ? "2rem 1rem" : "3rem 1rem",
      color: "#6b7280",
      fontSize: isMobile ? "0.8rem" : "0.875rem",
    },
    loading: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: isMobile ? "2rem" : "3rem",
    },
    spinner: {
      width: isMobile ? "1.5rem" : "2rem",
      height: isMobile ? "1.5rem" : "2rem",
      border: "3px solid #f3f4f6",
      borderTop: "3px solid #059669",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    },
    actionButton: {
      background: "none",
      border: "none",
      color: "#059669",
      cursor: "pointer",
      fontSize: isMobile ? "0.75rem" : "0.875rem",
      padding: isMobile ? "0.25rem 0.5rem" : "0.5rem 0.75rem",
      borderRadius: "0.25rem",
      transition: "background-color 0.2s",
      display: "inline-flex",
      alignItems: "center",
      gap: "0.25rem",
      marginRight: isMobile ? "0.25rem" : "0.5rem",
    },
    pagination: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: isMobile ? "0.25rem" : "0.5rem",
      padding: isMobile ? "0.75rem" : "1rem",
      backgroundColor: "white",
      borderTop: "1px solid #f3f4f6",
      flexWrap: "wrap",
    },
    paginationButton: {
      padding: isMobile ? "0.4rem 0.6rem" : "0.5rem 1rem",
      border: "1px solid #d1d5db",
      backgroundColor: "white",
      cursor: "pointer",
      borderRadius: "0.375rem",
      fontSize: isMobile ? "0.75rem" : "0.875rem",
      display: "flex",
      alignItems: "center",
      gap: "0.25rem",
      transition: "all 0.2s",
    },
    paginationButtonDisabled: {
      opacity: 0.5,
      cursor: "not-allowed",
    },
    paginationInfo: {
      fontSize: isMobile ? "0.75rem" : "0.875rem",
      color: "#6b7280",
      margin: isMobile ? "0 0.25rem" : "0 0.5rem",
      textAlign: "center",
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
      padding: isMobile ? "0.5rem" : "1rem",
    },
    modalContent: {
      backgroundColor: "white",
      borderRadius: "0.75rem",
      padding: isMobile ? "1rem" : "2rem",
      maxWidth: isMobile ? "95vw" : "600px",
      width: "100%",
      maxHeight: isMobile ? "95vh" : "90vh",
      overflowY: "auto",
      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
    },
    modalTitle: {
      fontSize: isMobile ? "1.125rem" : "1.5rem",
      fontWeight: "700",
      marginBottom: "1.5rem",
      color: "#1f2937",
    },
    modalDetails: {
      display: "grid",
      gap: isMobile ? "0.75rem" : "1rem",
      fontSize: isMobile ? "0.875rem" : "1rem",
      marginBottom: "2rem",
    },
    modalDetailRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: isMobile ? "0.5rem 0" : "0.75rem 0",
      borderBottom: "1px solid #f3f4f6",
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "flex-start" : "center",
      gap: isMobile ? "0.25rem" : "0",
    },
    modalLabel: {
      fontWeight: "600",
      color: "#4b5563",
    },
    modalValue: {
      color: "#1f2937",
      textAlign: isMobile ? "left" : "right",
      wordBreak: "break-word",
    },
    modalActions: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "0.75rem",
    },
    closeButton: {
      padding: isMobile ? "0.6rem 1.25rem" : "0.75rem 1.5rem",
      color: "#4b5563",
      backgroundColor: "#f3f4f6",
      borderRadius: "0.5rem",
      border: "none",
      cursor: "pointer",
      fontSize: isMobile ? "0.8rem" : "0.875rem",
      fontWeight: "500",
      transition: "background-color 0.2s",
    },
    iconInline: {
      display: "inline",
      width: isMobile ? "0.875rem" : "1rem",
      height: isMobile ? "0.875rem" : "1rem",
      marginRight: "0.5rem",
      verticalAlign: "middle",
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
      {/* Main Content */}
      <div style={styles.mainContent}>
        <div style={styles.contentWrapper}>
          {/* Error Message */}
          {error && <div style={styles.errorMessage}>{error}</div>}

          {/* Stats Cards */}
          <div style={styles.statsGrid}>
            <div style={styles.statsCard}>
              <div style={styles.statsNumber}>{payments.length}</div>
              <div style={styles.statsLabel}>Completed (This Page)</div>
            </div>
            <div style={styles.statsCard}>
              <div
                style={styles.statsNumber}
                title={`₱${totalAmount.toLocaleString()}`} // Show full amount on hover
              >
                {formatCurrency(totalAmount)}
              </div>
              <div style={styles.statsLabel}>Total Collected (This Page)</div>
            </div>
            <div style={styles.statsCard}>
              <div style={styles.statsNumber}>{currentPage}</div>
              <div style={styles.statsLabel}>Current Page</div>
            </div>
            <div style={styles.statsCard}>
              <div style={styles.statsNumber}>{totalPages}</div>
              <div style={styles.statsLabel}>Total Pages</div>
            </div>
          </div>

          {/* Filters */}
          <div style={styles.filtersContainer}>
            <h3 style={styles.filtersTitle}>
              <Filter style={styles.iconInline} />
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
                  onFocus={(e) => {
                    e.target.style.borderColor = "#10b981";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(16, 185, 129, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#d1d5db";
                    e.target.style.boxShadow = "none";
                  }}
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
                  onFocus={(e) => {
                    e.target.style.borderColor = "#10b981";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(16, 185, 129, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#d1d5db";
                    e.target.style.boxShadow = "none";
                  }}
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
                  onFocus={(e) => {
                    e.target.style.borderColor = "#10b981";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(16, 185, 129, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#d1d5db";
                    e.target.style.boxShadow = "none";
                  }}
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
                  onFocus={(e) => {
                    e.target.style.borderColor = "#10b981";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(16, 185, 129, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#d1d5db";
                    e.target.style.boxShadow = "none";
                  }}
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
              <h3 style={styles.tableTitle}>Completed Payments</h3>
              <span style={styles.tableInfo}>
                Page {currentPage} of {totalPages} | Showing {payments.length}{" "}
                of {totalPages * ITEMS_PER_PAGE} results
              </span>
            </div>

            {payments.length === 0 ? (
              <div style={styles.noResults}>
                <CheckCircle size={isMobile ? 36 : 48} color="#ccc" />
                <p>No completed payments found</p>
              </div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>Payment ID</th>
                      <th style={styles.th}>Student Name</th>
                      <th style={styles.th}>Course</th>
                      <th style={styles.th}>Amount Paid</th>
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
                        <td style={styles.td}>{payment.method_name}</td>
                        <td style={styles.td}>
                          <span style={styles.statusCompleted}>Completed</span>
                        </td>
                        <td style={styles.td}>
                          <button
                            onClick={() => setSelectedPayment(payment)}
                            style={styles.actionButton}
                            title="View Details"
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = "#f0fdf4";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = "transparent";
                            }}
                          >
                            <Eye size={isMobile ? 12 : 14} />
                            {!isMobile && "View"}
                          </button>
                          <button
                            onClick={handleExport}
                            style={styles.actionButton}
                            title="Export Data"
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = "#f0fdf4";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = "transparent";
                            }}
                          >
                            <Download size={isMobile ? 12 : 14} />
                            {!isMobile && "Export"}
                          </button>
                        </td>
                      </tr>
                    ))}
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
                    ...(currentPage === 1
                      ? styles.paginationButtonDisabled
                      : {}),
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== 1) {
                      e.target.style.backgroundColor = "#f9fafb";
                      e.target.style.borderColor = "#059669";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== 1) {
                      e.target.style.backgroundColor = "white";
                      e.target.style.borderColor = "#d1d5db";
                    }
                  }}
                >
                  <ChevronLeft size={16} />
                  {!isMobile && "Previous"}
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
                  onMouseEnter={(e) => {
                    if (currentPage !== totalPages) {
                      e.target.style.backgroundColor = "#f9fafb";
                      e.target.style.borderColor = "#059669";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== totalPages) {
                      e.target.style.backgroundColor = "white";
                      e.target.style.borderColor = "#d1d5db";
                    }
                  }}
                >
                  {!isMobile && "Next"}
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Payment Details Modal */}
          {selectedPayment && (
            <div style={styles.modal}>
              <div style={styles.modalContent}>
                <h3 style={styles.modalTitle}>Payment Details</h3>
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
                  <div
                    style={{
                      ...styles.modalDetailRow,
                      borderBottom: "none",
                    }}
                  >
                    <span style={styles.modalLabel}>Completed Date:</span>
                    <span style={styles.modalValue}>
                      {formatDate(selectedPayment.updated_at)}
                    </span>
                  </div>
                </div>
                <div style={styles.modalActions}>
                  <button
                    onClick={() => setSelectedPayment(null)}
                    style={styles.closeButton}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#e5e7eb";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "#f3f4f6";
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompletedPayments;
