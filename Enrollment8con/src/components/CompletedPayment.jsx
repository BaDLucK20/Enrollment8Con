import React, { useState, useEffect } from "react";
import { CheckCircle, Download, Search, Filter } from "lucide-react";

// Mock API function
const getCompletedPaymentsAPI = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: "PAY-003",
          enrolleeName: "Mike Johnson",
          enrolleeId: "STU-2024-003",
          paymentType: "Tuition",
          tuitionFee: 25000,
          paymentMethod: "Bank Transfer",
          uploadDate: "2024-01-10",
          completedDate: "2024-01-12",
          status: "completed",
        },
        {
          id: "PAY-006",
          enrolleeName: "Emily Davis",
          enrolleeId: "STU-2024-006",
          paymentType: "Registration",
          tuitionFee: 5000,
          paymentMethod: "Credit Card",
          uploadDate: "2024-01-08",
          completedDate: "2024-01-09",
          status: "completed",
        },
        {
          id: "PAY-007",
          enrolleeName: "Robert Wilson",
          enrolleeId: "STU-2024-007",
          paymentType: "Laboratory Fee",
          tuitionFee: 3000,
          paymentMethod: "Online Payment",
          uploadDate: "2024-01-05",
          completedDate: "2024-01-06",
          status: "completed",
        },
        {
          id: "PAY-008",
          enrolleeName: "Lisa Chen",
          enrolleeId: "STU-2024-008",
          paymentType: "Miscellaneous",
          tuitionFee: 1500,
          paymentMethod: "Cash",
          uploadDate: "2024-01-03",
          completedDate: "2024-01-04",
          status: "completed",
        },
      ]);
    }, 500);
  });
};

const styles = {
  container: {
    backgroundColor: "#f5f5f5",
    minHeight: "100vh",
    padding: "10px",
    "@media (min-width: 768px)": {
      padding: "20px",
    },
  },
  header: {
    backgroundColor: "white",
    padding: "15px",
    marginBottom: "15px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    "@media (min-width: 768px)": {
      padding: "20px",
      marginBottom: "20px",
    },
  },
  title: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#333",
    marginBottom: "8px",
    "@media (min-width: 768px)": {
      fontSize: "24px",
    },
  },
  subtitle: {
    fontSize: "12px",
    color: "#666",
    marginBottom: "0",
    "@media (min-width: 768px)": {
      fontSize: "14px",
    },
  },
  statsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "10px",
    marginBottom: "15px",
    "@media (min-width: 768px)": {
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "20px",
      marginBottom: "20px",
    },
  },
  statCard: {
    backgroundColor: "#e8f4f8",
    padding: "15px",
    borderRadius: "8px",
    textAlign: "center",
    border: "1px solid #d1ecf1",
    "@media (min-width: 768px)": {
      padding: "20px",
    },
  },
  statNumber: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#333",
    marginBottom: "6px",
    "@media (min-width: 768px)": {
      fontSize: "32px",
      marginBottom: "8px",
    },
  },
  statLabel: {
    fontSize: "12px",
    color: "#666",
    fontWeight: "500",
    "@media (min-width: 768px)": {
      fontSize: "14px",
    },
  },
  filtersContainer: {
    backgroundColor: "white",
    padding: "15px",
    marginBottom: "15px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    "@media (min-width: 768px)": {
      padding: "20px",
      marginBottom: "20px",
    },
  },
  filtersTitle: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#333",
    marginBottom: "15px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    "@media (min-width: 768px)": {
      fontSize: "18px",
      marginBottom: "20px",
      gap: "10px",
    },
  },
  filtersRow: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "15px",
    "@media (min-width: 768px)": {
      gridTemplateColumns: "1fr 200px 200px",
      gap: "20px",
      alignItems: "end",
    },
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: "12px",
    fontWeight: "500",
    color: "#333",
    marginBottom: "6px",
    "@media (min-width: 768px)": {
      fontSize: "14px",
      marginBottom: "8px",
    },
  },
  input: {
    padding: "10px 12px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
  },
  select: {
    padding: "10px 12px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "14px",
    outline: "none",
    backgroundColor: "white",
    cursor: "pointer",
  },
  hideFiltersBtn: {
    backgroundColor: "#5a6c57",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: "4px",
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  tableContainer: {
    backgroundColor: "white",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  tableHeader: {
    background: "linear-gradient(135deg, #375e4b 0%, #6d8f81 100%)",
    color: "white",
    padding: "12px 15px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    "@media (min-width: 768px)": {
      padding: "16px 20px",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "0",
    },
  },
  tableTitle: {
    fontSize: "14px",
    fontWeight: "bold",
    margin: 0,
    "@media (min-width: 768px)": {
      fontSize: "16px",
    },
  },
  tableInfo: {
    fontSize: "12px",
    opacity: 0.9,
    "@media (min-width: 768px)": {
      fontSize: "14px",
    },
  },
  tableWrapper: {
    overflowX: "auto",
    "-webkit-overflow-scrolling": "touch",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "800px", // Ensures table doesn't get too cramped on mobile
  },
  tableHeaderRow: {
    backgroundColor: "#375e4b",
    color: "white",
  },
  th: {
    padding: "10px 8px",
    textAlign: "left",
    fontSize: "12px",
    fontWeight: "600",
    borderRight: "1px solid rgba(255,255,255,0.1)",
    whiteSpace: "nowrap",
    "@media (min-width: 768px)": {
      padding: "12px 16px",
      fontSize: "14px",
    },
  },
  td: {
    padding: "10px 8px",
    fontSize: "12px",
    borderBottom: "1px solid #eee",
    borderRight: "1px solid #eee",
    whiteSpace: "nowrap",
    "@media (min-width: 768px)": {
      padding: "12px 16px",
      fontSize: "14px",
    },
  },
  statusCompleted: {
    color: "#28a745",
    fontWeight: "500",
  },
  noResults: {
    textAlign: "center",
    padding: "30px 15px",
    color: "#666",
    fontSize: "12px",
    "@media (min-width: 768px)": {
      padding: "40px",
      fontSize: "14px",
    },
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "30px",
    "@media (min-width: 768px)": {
      padding: "40px",
    },
  },
  spinner: {
    width: "28px",
    height: "28px",
    border: "3px solid #f3f3f3",
    borderTop: "3px solid #5a6c57",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    "@media (min-width: 768px)": {
      width: "32px",
      height: "32px",
    },
  },
  exportButton: {
    background: "none",
    border: "none",
    color: "#5a6c57",
    cursor: "pointer",
    fontSize: "12px",
    textDecoration: "underline",
    padding: "4px",
    "@media (min-width: 768px)": {
      fontSize: "14px",
    },
  },
};

// CSS-in-JS media query helper
const useMediaQuery = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);

    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  return { isMobile };
};

const CompletedPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [sortBy, setSortBy] = useState("Latest Completed");
  const [dateRange, setDateRange] = useState("All Time");
  const { isMobile } = useMediaQuery();

  useEffect(() => {
    fetchCompletedPayments();
  }, []);

  const fetchCompletedPayments = async () => {
    try {
      const data = await getCompletedPaymentsAPI();
      setPayments(data);
    } catch (error) {
      console.error("Failed to fetch completed payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.enrolleeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.enrolleeId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterType === "" || payment.paymentType === filterType;

    return matchesSearch && matchesFilter;
  });

  const handleExport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Payment ID,Student Name,Course,Amount Paid,Completed Date,Payment Method,Status\n" +
      filteredPayments
        .map(
          (payment) =>
            `${payment.id},${payment.enrolleeName},${payment.paymentType},₱${payment.tuitionFee},${payment.completedDate},${payment.paymentMethod},Completed`
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "completed_payments.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalAmount = filteredPayments.reduce(
    (sum, payment) => sum + payment.tuitionFee,
    0
  );

  // Apply responsive styles based on screen size
  const getResponsiveStyle = (baseStyle) => {
    if (isMobile) {
      return {
        ...baseStyle,
        ...(baseStyle["@media (min-width: 768px)"] ? {} : baseStyle),
      };
    }
    return {
      ...baseStyle,
      ...(baseStyle["@media (min-width: 768px)"] || {}),
    };
  };

  if (loading) {
    return (
      <div style={getResponsiveStyle(styles.container)}>
        <div style={getResponsiveStyle(styles.loading)}>
          <div style={getResponsiveStyle(styles.spinner)}></div>
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
    <div style={getResponsiveStyle(styles.container)}>
      {/* Header */}
      <div style={getResponsiveStyle(styles.header)}>
        <h1 style={getResponsiveStyle(styles.title)}>Completed Payments</h1>
        <p style={getResponsiveStyle(styles.subtitle)}>
          View and manage all completed student payments and receipts
        </p>
      </div>

      {/* Stats Cards */}
      {/* <div style={getResponsiveStyle(styles.statsContainer)}>
        <div style={getResponsiveStyle(styles.statCard)}>
          <div style={getResponsiveStyle(styles.statNumber)}>
            {filteredPayments.length}
          </div>
          <div style={getResponsiveStyle(styles.statLabel)}>
            Completed Payments
          </div>
        </div>
        <div style={getResponsiveStyle(styles.statCard)}>
          <div style={getResponsiveStyle(styles.statNumber)}>
            ₱{totalAmount.toLocaleString()}
          </div>
          <div style={getResponsiveStyle(styles.statLabel)}>
            Total Collected
          </div>
        </div>
        <div style={getResponsiveStyle(styles.statCard)}>
          <div style={getResponsiveStyle(styles.statNumber)}>
            {filteredPayments.length}
          </div>
          <div style={getResponsiveStyle(styles.statLabel)}>Total Receipts</div>
        </div>
        <div style={getResponsiveStyle(styles.statCard)}>
          <div style={getResponsiveStyle(styles.statNumber)}>
            {filteredPayments.length}
          </div>
          <div style={getResponsiveStyle(styles.statLabel)}>
            Filtered Results
          </div>
        </div>
      </div> */}

      {/* Filters */}
      <div style={getResponsiveStyle(styles.filtersContainer)}>
        <h3 style={getResponsiveStyle(styles.filtersTitle)}>
          <Filter size={isMobile ? 16 : 20} />
          Filter Completed Payments
        </h3>
        <div style={getResponsiveStyle(styles.filtersRow)}>
          <div style={styles.inputGroup}>
            <label style={getResponsiveStyle(styles.label)}>
              Filter by Name
            </label>
            <input
              type="text"
              placeholder="Enter student name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={getResponsiveStyle(styles.label)}>Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={styles.select}
            >
              <option value="Latest Completed">Latest Completed</option>
              <option value="Oldest First">Oldest First</option>
              <option value="Amount High to Low">Amount High to Low</option>
              <option value="Amount Low to High">Amount Low to High</option>
            </select>
          </div>
          <div style={styles.inputGroup}>
            <label style={getResponsiveStyle(styles.label)}>Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              style={styles.select}
            >
              <option value="All Time">All Time</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="Last 90 Days">Last 90 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableContainer}>
        <div style={getResponsiveStyle(styles.tableHeader)}>
          <h3 style={getResponsiveStyle(styles.tableTitle)}>
            Completed Payments (All Records)
          </h3>
          <span style={getResponsiveStyle(styles.tableInfo)}>
            Showing 1-{filteredPayments.length} of {filteredPayments.length}{" "}
            results
          </span>
        </div>

        {filteredPayments.length === 0 ? (
          <div style={getResponsiveStyle(styles.noResults)}>
            <CheckCircle size={isMobile ? 36 : 48} color="#ccc" />
            <p>No completed payments found</p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={getResponsiveStyle(styles.th)}>Payment ID</th>
                  <th style={getResponsiveStyle(styles.th)}>Student Name</th>
                  <th style={getResponsiveStyle(styles.th)}>Course</th>
                  <th style={getResponsiveStyle(styles.th)}>Amount Paid</th>
                  <th style={getResponsiveStyle(styles.th)}>Completed Date</th>
                  <th style={getResponsiveStyle(styles.th)}>Payment Method</th>
                  <th style={getResponsiveStyle(styles.th)}>Status</th>
                  <th style={getResponsiveStyle(styles.th)}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td style={getResponsiveStyle(styles.td)}>{payment.id}</td>
                    <td style={getResponsiveStyle(styles.td)}>
                      {payment.enrolleeName}
                    </td>
                    <td style={getResponsiveStyle(styles.td)}>
                      {payment.paymentType}
                    </td>
                    <td style={getResponsiveStyle(styles.td)}>
                      ₱{payment.tuitionFee.toLocaleString()}
                    </td>
                    <td style={getResponsiveStyle(styles.td)}>
                      {payment.completedDate}
                    </td>
                    <td style={getResponsiveStyle(styles.td)}>
                      {payment.paymentMethod}
                    </td>
                    <td
                      style={{
                        ...getResponsiveStyle(styles.td),
                        ...styles.statusCompleted,
                      }}
                    >
                      Completed
                    </td>
                    <td style={getResponsiveStyle(styles.td)}>
                      <button
                        onClick={handleExport}
                        style={getResponsiveStyle(styles.exportButton)}
                      >
                        Export
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

export default CompletedPayments;
