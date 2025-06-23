import { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Eye,
  ChevronUp,
  ChevronDown,
  Users,
  Award,
  TrendingUp,
  UserCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";

function ReferralTracking() {
  const [referrals, setReferrals] = useState([]);
  const [filteredReferrals, setFilteredReferrals] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [nameSort, setNameSort] = useState("none"); // 'asc', 'desc', 'none'
  const [competencyFilter, setCompetencyFilter] = useState("all"); // 'all', 'basic', 'common', 'core'
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Color palette matching your dashboard
  const colors = {
    darkGreen: "#2d4a3d",
    lightGreen: "#7a9b8a",
    dustyRose: "#c19a9a",
    coral: "#d85c5c",
    red: "#d63447",
    cream: "#f5f2e8",
    olive: "#6b7c5c",
    black: "#2c2c2c",
  };

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get token from localStorage (or sessionStorage/context, depending on your app)
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No token found — please log in again.");
      }

      const response = await fetch("http://localhost:3000/api/referrals", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const formattedReferrals = data.map((referral) => ({
        id: referral.id,
        referrerName: referral.referrer_name || referral.referrerName,
        referredName: referral.referred_name || referral.referredName,
        competencyLevel: referral.competency_level || referral.competencyLevel,
        dateReferred: referral.date_referred || referral.dateReferred,
        status: referral.status,
        contactNumber: referral.contact_number || referral.contactNumber,
        email: referral.email,
        course: referral.course,
        referralReward:
          referral.referral_reward || referral.referralReward || 0,
        completionRate:
          referral.completion_rate || referral.completionRate || 0,
      }));

      setReferrals(formattedReferrals);
      setFilteredReferrals(formattedReferrals);
    } catch (err) {
      console.error("Error fetching referrals:", err);
      setError(err.message || "Failed to fetch referrals");
    } finally {
      setLoading(false);
    }
  };
  // Fetch data on component mount
  useEffect(() => {
    fetchReferrals();
  }, []);

  // Refresh data function
  const handleRefresh = () => {
    fetchReferrals();
  };

  // Filter and sort logic
  useEffect(() => {
    let filtered = referrals.filter((referral) => {
      const matchesSearch =
        referral.referredName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        referral.referrerName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCompetency =
        competencyFilter === "all" ||
        referral.competencyLevel === competencyFilter;
      return matchesSearch && matchesCompetency;
    });

    // Sort by name
    if (nameSort === "asc") {
      filtered.sort((a, b) => a.referredName.localeCompare(b.referredName));
    } else if (nameSort === "desc") {
      filtered.sort((a, b) => b.referredName.localeCompare(a.referredName));
    }

    setFilteredReferrals(filtered);
  }, [referrals, searchTerm, nameSort, competencyFilter]);

  const getCompetencyColor = (level) => {
    switch (level) {
      case "basic":
        return colors.coral;
      case "common":
        return colors.lightGreen;
      case "core":
        return colors.darkGreen;
      default:
        return colors.black;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return colors.lightGreen;
      case "completed":
        return colors.darkGreen;
      case "pending":
        return colors.dustyRose;
      case "inactive":
        return colors.coral;
      default:
        return colors.black;
    }
  };

  const handleViewDetails = (referral) => {
    setSelectedReferral(referral);
    setShowDetails(true);
  };

  const styles = {
    container: {
      backgroundColor: "#ffffff",
      borderRadius: "12px",
      padding: "32px",
      border: "1px solid #e2e8f0",
    },
    header: {
      marginBottom: "32px",
    },
    title: {
      fontSize: "24px",
      fontWeight: "bold",
      color: colors.black,
      margin: 0,
      marginBottom: "8px",
    },
    subtitle: {
      fontSize: "16px",
      color: "#64748b",
      margin: 0,
    },
    headerActions: {
      display: "flex",
      gap: "12px",
      marginTop: "16px",
    },
    refreshButton: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 16px",
      border: "1px solid #e2e8f0",
      borderRadius: "6px",
      backgroundColor: "#ffffff",
      cursor: "pointer",
      fontSize: "14px",
      color: colors.darkGreen,
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "16px",
      marginBottom: "32px",
    },
    statCard: {
      backgroundColor: colors.cream,
      borderRadius: "8px",
      padding: "20px",
      border: "1px solid #e2e8f0",
    },
    statIcon: {
      width: "40px",
      height: "40px",
      borderRadius: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: "12px",
    },
    statValue: {
      fontSize: "24px",
      fontWeight: "bold",
      color: colors.black,
      margin: 0,
      marginBottom: "4px",
    },
    statLabel: {
      fontSize: "14px",
      color: "#64748b",
      margin: 0,
    },
    filterSection: {
      display: "flex",
      gap: "16px",
      marginBottom: "24px",
      flexWrap: "wrap",
      alignItems: "center",
    },
    searchContainer: {
      position: "relative",
      flex: "1",
      minWidth: "200px",
    },
    searchInput: {
      width: "90%",
      padding: "12px 16px 12px 30px",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      fontSize: "14px",
      outline: "none",
    },
    searchIcon: {
      position: "absolute",
      left: "12px",
      top: "50%",
      transform: "translateY(-50%)",
      color: "#64748b",
    },
    filterGroup: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    filterLabel: {
      fontSize: "14px",
      fontWeight: "500",
      color: colors.black,
      whiteSpace: "nowrap",
    },
    select: {
      padding: "8px 12px",
      border: "1px solid #e2e8f0",
      borderRadius: "6px",
      fontSize: "14px",
      outline: "none",
      backgroundColor: "#ffffff",
    },
    sortButton: {
      display: "flex",
      alignItems: "center",
      gap: "4px",
      padding: "8px 12px",
      border: "1px solid #e2e8f0",
      borderRadius: "6px",
      backgroundColor: "#ffffff",
      cursor: "pointer",
      fontSize: "14px",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      backgroundColor: "#ffffff",
      borderRadius: "8px",
      overflow: "hidden",
      border: "1px solid #e2e8f0",
    },
    th: {
      backgroundColor: colors.cream,
      padding: "16px",
      textAlign: "left",
      fontSize: "14px",
      fontWeight: "600",
      color: colors.black,
      borderBottom: "1px solid #e2e8f0",
    },
    td: {
      padding: "16px",
      borderBottom: "1px solid #e2e8f0",
      fontSize: "14px",
      color: colors.black,
    },
    badge: {
      display: "inline-block",
      padding: "4px 8px",
      borderRadius: "4px",
      fontSize: "12px",
      fontWeight: "500",
      color: "#ffffff",
      textTransform: "capitalize",
    },
    actionButton: {
      display: "flex",
      alignItems: "center",
      gap: "4px",
      padding: "6px 12px",
      border: "none",
      borderRadius: "4px",
      backgroundColor: colors.darkGreen,
      color: "#ffffff",
      cursor: "pointer",
      fontSize: "12px",
    },
    modal: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    },
    modalContent: {
      backgroundColor: "#ffffff",
      borderRadius: "12px",
      padding: "32px",
      maxWidth: "600px",
      width: "90%",
      maxHeight: "80vh",
      overflowY: "auto",
    },
    modalHeader: {
      marginBottom: "24px",
      paddingBottom: "16px",
      borderBottom: "1px solid #e2e8f0",
    },
    modalTitle: {
      fontSize: "20px",
      fontWeight: "bold",
      color: colors.black,
      margin: 0,
    },
    detailRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 0",
      borderBottom: "1px solid #f1f5f9",
    },
    detailLabel: {
      fontSize: "14px",
      fontWeight: "500",
      color: "#64748b",
    },
    detailValue: {
      fontSize: "14px",
      color: colors.black,
      fontWeight: "500",
    },
    closeButton: {
      position: "absolute",
      top: "16px",
      right: "16px",
      background: "none",
      border: "none",
      fontSize: "24px",
      cursor: "pointer",
      color: "#64748b",
    },
    loadingContainer: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "60px",
      flexDirection: "column",
      gap: "16px",
    },
    errorContainer: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "60px",
      flexDirection: "column",
      gap: "16px",
      color: colors.red,
    },
    errorText: {
      textAlign: "center",
      fontSize: "16px",
      color: colors.red,
    },
    retryButton: {
      padding: "8px 16px",
      backgroundColor: colors.darkGreen,
      color: "#ffffff",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "14px",
    },
  };

  // Calculate stats
  const totalReferrals = referrals.length;
  const activeReferrals = referrals.filter((r) => r.status === "active").length;
  const completedReferrals = referrals.filter(
    (r) => r.status === "completed"
  ).length;
  const totalRewards = referrals.reduce(
    (sum, r) => sum + (r.referralReward || 0),
    0
  );

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <Loader2
            size={32}
            color={colors.darkGreen}
            style={{ animation: "spin 1s linear infinite" }}
          />
          <p style={{ color: "#64748b", margin: 0 }}>Loading referrals...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <AlertCircle size={32} color={colors.red} />
          <p style={styles.errorText}>Error loading referrals: {error}</p>
          <button style={styles.retryButton} onClick={handleRefresh}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>Referral Tracking</h2>
        <p style={styles.subtitle}>
          Monitor and manage student referrals and their progress
        </p>
        <div style={styles.headerActions}>
          <button style={styles.refreshButton} onClick={handleRefresh}>
            <TrendingUp size={16} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div
            style={{
              ...styles.statIcon,
              backgroundColor: colors.darkGreen + "20",
            }}
          >
            <Users size={20} color={colors.darkGreen} />
          </div>
          <div style={styles.statValue}>{totalReferrals}</div>
          <div style={styles.statLabel}>Total Referrals</div>
        </div>
        <div style={styles.statCard}>
          <div
            style={{
              ...styles.statIcon,
              backgroundColor: colors.lightGreen + "20",
            }}
          >
            <UserCheck size={20} color={colors.lightGreen} />
          </div>
          <div style={styles.statValue}>{activeReferrals}</div>
          <div style={styles.statLabel}>Active Referrals</div>
        </div>
        <div style={styles.statCard}>
          <div
            style={{ ...styles.statIcon, backgroundColor: colors.olive + "20" }}
          >
            <Award size={20} color={colors.olive} />
          </div>
          <div style={styles.statValue}>{completedReferrals}</div>
          <div style={styles.statLabel}>Completed</div>
        </div>
        <div style={styles.statCard}>
          <div
            style={{ ...styles.statIcon, backgroundColor: colors.coral + "20" }}
          >
            <TrendingUp size={20} color={colors.coral} />
          </div>
          <div style={styles.statValue}>₱{totalRewards.toLocaleString()}</div>
          <div style={styles.statLabel}>Total Rewards</div>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filterSection}>
        <div style={styles.searchContainer}>
          <Search size={16} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by referrer or referred name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>Sort by Name:</span>
          <button
            style={{
              ...styles.sortButton,
              backgroundColor: nameSort !== "none" ? colors.cream : "#ffffff",
            }}
            onClick={() => {
              if (nameSort === "none" || nameSort === "desc") {
                setNameSort("asc");
              } else {
                setNameSort("desc");
              }
            }}
          >
            Name
            {nameSort === "asc" ? (
              <ChevronUp size={14} />
            ) : nameSort === "desc" ? (
              <ChevronDown size={14} />
            ) : (
              <Filter size={14} />
            )}
          </button>
        </div>

        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>Competency:</span>
          <select
            value={competencyFilter}
            onChange={(e) => setCompetencyFilter(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Levels</option>
            <option value="basic">Basic</option>
            <option value="common">Common</option>
            <option value="core">Core</option>
          </select>
        </div>
      </div>

      {/* Referrals Table */}
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Referrer</th>
            <th style={styles.th}>Referred Student</th>
            <th style={styles.th}>Competency Level</th>
            <th style={styles.th}>Course</th>
            <th style={styles.th}>Date Referred</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Progress</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredReferrals.map((referral) => (
            <tr key={referral.id}>
              <td style={styles.td}>{referral.referrerName}</td>
              <td style={styles.td}>
                <div>
                  <div style={{ fontWeight: "500" }}>
                    {referral.referredName}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {referral.email}
                  </div>
                </div>
              </td>
              <td style={styles.td}>
                <span
                  style={{
                    ...styles.badge,
                    backgroundColor: getCompetencyColor(
                      referral.competencyLevel
                    ),
                  }}
                >
                  {referral.competencyLevel}
                </span>
              </td>
              <td style={styles.td}>{referral.course}</td>
              <td style={styles.td}>
                {new Date(referral.dateReferred).toLocaleDateString()}
              </td>
              <td style={styles.td}>
                <span
                  style={{
                    ...styles.badge,
                    backgroundColor: getStatusColor(referral.status),
                  }}
                >
                  {referral.status}
                </span>
              </td>
              <td style={styles.td}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <div
                    style={{
                      width: "60px",
                      height: "8px",
                      backgroundColor: "#e2e8f0",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${referral.completionRate}%`,
                        height: "100%",
                        backgroundColor: colors.lightGreen,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    {referral.completionRate}%
                  </span>
                </div>
              </td>
              <td style={styles.td}>
                <button
                  style={styles.actionButton}
                  onClick={() => handleViewDetails(referral)}
                >
                  <Eye size={12} />
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filteredReferrals.length === 0 && !loading && (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "#64748b",
          }}
        >
          No referrals found matching your criteria.
        </div>
      )}

      {/* Details Modal */}
      {showDetails && selectedReferral && (
        <div style={styles.modal} onClick={() => setShowDetails(false)}>
          <div
            style={{ ...styles.modalContent, position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={styles.closeButton}
              onClick={() => setShowDetails(false)}
            >
              ×
            </button>

            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Referral Details</h3>
            </div>

            <div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Referrer:</span>
                <span style={styles.detailValue}>
                  {selectedReferral.referrerName}
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Referred Student:</span>
                <span style={styles.detailValue}>
                  {selectedReferral.referredName}
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Email:</span>
                <span style={styles.detailValue}>{selectedReferral.email}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Contact Number:</span>
                <span style={styles.detailValue}>
                  {selectedReferral.contactNumber}
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Course:</span>
                <span style={styles.detailValue}>
                  {selectedReferral.course}
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Competency Level:</span>
                <span
                  style={{
                    ...styles.badge,
                    backgroundColor: getCompetencyColor(
                      selectedReferral.competencyLevel
                    ),
                  }}
                >
                  {selectedReferral.competencyLevel}
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Status:</span>
                <span
                  style={{
                    ...styles.badge,
                    backgroundColor: getStatusColor(selectedReferral.status),
                  }}
                >
                  {selectedReferral.status}
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Date Referred:</span>
                <span style={styles.detailValue}>
                  {new Date(selectedReferral.dateReferred).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Completion Rate:</span>
                <span style={styles.detailValue}>
                  {selectedReferral.completionRate}%
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Referral Reward:</span>
                <span style={styles.detailValue}>
                  ₱{selectedReferral.referralReward.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReferralTracking;
