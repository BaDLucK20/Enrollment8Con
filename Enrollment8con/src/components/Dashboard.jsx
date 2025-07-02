import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Users,
  FileText,
  Award,
  GraduationCap,
  DollarSign,
  UserCheck,
  FolderOpen,
  BarChart3,
  Home,
  Settings,
  Book,
  LogOut,
  User,
  Lock,
  Database,
  TrendingUp,
  Calculator,
  Target,
  Menu,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import PendingPayment from "./PendingPayment";
import CompletedPayment from "./CompletedPayment";
import PaymentHistory from "./PaymentHistory";
import StudentForm from "./AddStudent";
import StaffForm from "./AddStaff";
import DisplayAccount from "./DisplayAccount";
import AddDocument from "./AddDocument";
import PendingDocument from "./PendingDocument";
import Courses from "./Courses";
import ReferralTracking from "./ReferralTracking";
import { useNavigate } from "react-router-dom";
import UploadPayments from "./UploadPayment";
import CancelledPayments from "./CancelledPayment";
import { useDashboardData } from "../hooks/useDashboardData";
import Batch from "./Batch"

// API configuration
const API_BASE_URL = "http://localhost:3000/api";

// API helper function
const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem("token");
  const defaultHeaders = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { ...defaultHeaders, ...options.headers },
      ...options,
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/";
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    throw error;
  }
};

function UniversalDashboard() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [expandedNodes, setExpandedNodes] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar state
  const [userRole, setUserRole] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const {
    dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
    refreshData,
  } = useDashboardData();

  // Initialize user data and fetch dashboard metrics
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/");
          return;
        }

        // Decode JWT token to get user info
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setUserRole(payload.role || "student");
          setUserInfo(payload);
        } catch (tokenError) {
          console.error("Invalid token format:", tokenError);
          localStorage.removeItem("token");
          navigate("/");
          return;
        }
      } catch (error) {
        console.error("Dashboard initialization error:", error);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [userRole, navigate]);

  // Time update effect and responsive handler
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const handleResize = () => {
      const width = window.innerWidth;
      setIsDesktop(width >= 1024);
      setIsMobile(width < 768);

      // Auto-close sidebar on desktop
      if (width >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Color palette from branding image
  const colors = {
    darkGreen: "#2d4a3d",
    lightGreen: "#7a9b8a",
    dustyRose: "#c19a9a",
    coral: "#d85c5c",
    red: "#d63447",
    cream: "#f5f2e8",
    olive: "#6b7c5c",
    black: "#2c2c2c",
    blue: "#4a90e2",
    purple: "#9b59b6",
  };

  // Function to check if user has required role
  const hasRequiredRole = (requiredRoles) => {
    if (!requiredRoles || requiredRoles.length === 0) return true;
    return requiredRoles.includes(userRole);
  };

  // Flowchart navigation items
  const flowchartItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: Home,
      color: colors.darkGreen,
      hasChildren: false,
    },
    {
      id: "payment-tracker",
      label: "Payment Tracker",
      icon: DollarSign,
      color: colors.coral,
      roles: ["admin", "staff"],
      hasChildren: true,
      children: [
        { id: "UploadPayments", label: "Upload Payments" },
        { id: "PendingPayments", label: "Pending Payments" },
        { id: "CompletedPayments", label: "Completed Payments" },
        { id: "CancelledPayment", label: "Cancelled Payments" },
      ],
    },
    {
      id: "courses",
      label: "Courses",
      icon: Award,
      color: colors.blue,
      roles: ["admin", "staff"],
    },
    {
      id: "competency-assessment",
      label: "Competency & Assessment",
      icon: Award,
      color: colors.red,
      roles: ["admin", "staff"],
      hasChildren: true
    },
    {
      id: "referral-tracking",
      label: "Referral",
      icon: Users,
      color: colors.olive,
    },
    {
      id: "account-management",
      label: "Account Management",
      icon: UserCheck,
      color: colors.coral,
      roles: ["admin"],
      hasChildren: true,
      children: [
        { id: "add-new-Staff", label: "Add New Staff" },
        { id: "add-new-Student", label: "Add New Student" },
        { id: "BatchStudent", label: "Batch" },
        { id: "DisplayAccount", label: "Manage Accounts" },
      ],
    },
    {
      id: "document-tracker",
      label: "Document Tracker",
      icon: FileText,
      color: colors.red,
      roles: ["admin", "staff"],
      hasChildren: true,
      children: [
        { id: "add-documents", label: "Documents" },
        { id: "pending-documents", label: "Pending Document" },
      ],
    },
  ];

  // Filter navigation items based on user role
  const filteredFlowchartItems = flowchartItems.filter((item) =>
    hasRequiredRole(item.roles)
  );

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");

      if (token) {
        await apiCall("/auth/logout", {
          method: "POST",
        });
      }

      // Clear token and reset UI
      localStorage.removeItem("token");
      navigate("/");
      setActiveSection("dashboard");
      setExpandedNodes({});
      setUserRole("");
      setUserInfo(null);
    } catch (error) {
      console.error("Logout failed:", error);
      // Still redirect even if logout API fails
      localStorage.removeItem("token");
      navigate("/");
    }
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const handleSectionClick = (sectionId) => {
    // Check if user has permission to access this section
    const clickedItem = flowchartItems.find(
      (item) =>
        item.id === sectionId ||
        (item.children && item.children.some((child) => child.id === sectionId))
    );

    if (
      clickedItem &&
      clickedItem.roles &&
      !hasRequiredRole(clickedItem.roles)
    ) {
      setError("You do not have permission to access this section.");
      return;
    }

    setActiveSection(sectionId);
    setError(null); // Clear any previous errors

    // Close mobile sidebar when navigating
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const styles = {
    // Dashboard Styles
    container: {
      display: "flex",
      height: "100vh",
      backgroundColor: colors.cream,
      fontFamily: "Arial, Helvetica, sans-serif",
      overflow: "hidden",
      position: "relative",
      width: "100%",
      maxWidth: "100vw", // Prevent container from exceeding viewport
    },

    // Mobile Menu Button
    mobileMenuButton: {
      display: isMobile ? "block" : "none",
      position: "fixed",
      top: "1rem",
      left: "1rem",
      zIndex: 1001,
      backgroundColor: colors.darkGreen,
      color: "white",
      border: "none",
      borderRadius: "8px",
      padding: "0.75rem",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
    },

    // Mobile Overlay
    mobileOverlay: {
      display: isMobile && sidebarOpen ? "block" : "none",
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      zIndex: 999,
    },

    // Navigation Panel
    navigationPanel: {
      width: "320px", // Fixed width always
      backgroundColor: colors.darkGreen,
      color: "#ffffff",
      overflowY: "auto",
      position: isMobile ? "fixed" : "relative",
      height: "100vh",
      top: 0,
      left: isMobile ? (sidebarOpen ? "0" : "-320px") : "0",
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      transition: "left 0.3s ease-in-out",
      flexShrink: 0, // Prevent shrinking
    },

    navHeader: {
      padding: "10px 20px", // Consistent padding
      borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
      backgroundColor: colors.lightGreen,
      display: "flex",
      justifyContent: isMobile ? "space-between" : "center",
      alignItems: "center",
    },

    // Close button for mobile
    navCloseButton: {
      display: isMobile ? "block" : "none",
      backgroundColor: "transparent",
      border: "none",
      color: "white",
      cursor: "pointer",
      padding: "0.5rem",
      borderRadius: "4px",
    },

    navContent: {
      padding: "16px 0",
      flex: 1,
    },

    navItem: {
      display: "block",
      width: "100%",
      border: "none",
      backgroundColor: "transparent",
      color: "#ffffff",
      padding: "12px 20px", // Consistent padding
      textAlign: "left",
      cursor: "pointer",
      transition: "all 0.2s ease",
      fontSize: "14px", // Consistent font size
    },

    navItemContent: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },

    navItemLeft: {
      display: "flex",
      alignItems: "center",
      gap: "12px", // Consistent gap
    },

    navItemIcon: {
      width: "20px", // Consistent size
      height: "20px",
      borderRadius: "4px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },

    navItemActive: {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      borderLeft: "4px solid " + colors.red,
    },

    subNavList: {
      backgroundColor: "rgba(0, 0, 0, 0.2)",
      borderTop: "1px solid rgba(255, 255, 255, 0.1)",
    },

    subNavItem: {
      display: "block",
      width: "100%",
      border: "none",
      backgroundColor: "transparent",
      color: "rgba(255, 255, 255, 0.8)",
      padding: "8px 20px 8px 56px", // Consistent padding
      textAlign: "left",
      cursor: "pointer",
      transition: "all 0.2s ease",
      fontSize: "13px", // Consistent font size
    },

    // Logout Button
    logoutContainer: {
      padding: "16px 20px", // Consistent padding
      borderTop: "1px solid rgba(255, 255, 255, 0.1)",
      marginTop: "auto",
    },

    logoutButton: {
      display: "flex",
      alignItems: "center",
      gap: "12px", // Consistent gap
      width: "100%",
      border: "none",
      backgroundColor: "transparent",
      color: "#ffffff",
      padding: "12px 0", // Consistent padding
      cursor: "pointer",
      transition: "all 0.2s ease",
      fontSize: "14px", // Consistent font size
    },

    logoutIcon: {
      width: "20px", // Consistent size
      height: "20px",
      borderRadius: "4px",
      backgroundColor: colors.red,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },

    // Main Content Area
    mainContent: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#ffffff",
      marginLeft: isMobile ? "0" : "0",
      width: isMobile ? "100%" : "calc(100% - 320px)", // Properly calculate width
      maxWidth: isMobile ? "100%" : "calc(100% - 320px)",
      overflowX: "hidden", // Prevent horizontal scroll
      position: "relative",
    },

    header: {
      backgroundColor: "#ffffff",
      padding: isMobile ? "4rem 1rem 1rem 1rem" : "20px 32px",
      borderBottom: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
      width: "100%",
      boxSizing: "border-box",
    },

    headerTitle: {
      fontSize: isMobile ? "1.5rem" : "28px",
      fontWeight: "bold",
      color: colors.black,
      margin: 0,
      marginBottom: "4px",
    },

    headerSubtitle: {
      fontSize: isMobile ? "12px" : "14px",
      color: colors.lightGreen,
      margin: 0,
    },

    dashboardContent: {
      flex: 1,
      padding: isMobile ? "1rem" : "32px",
      overflowY: "auto",
      overflowX: "hidden", // Prevent horizontal scroll
      backgroundColor: colors.cream,
      width: "100%",
      boxSizing: "border-box",
    },

    // Loading and Error States
    loadingContainer: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "200px",
      fontSize: isMobile ? "14px" : "16px",
      color: colors.lightGreen,
    },

    errorContainer: {
      backgroundColor: "#fee",
      border: "1px solid #fcc",
      borderRadius: "8px",
      padding: isMobile ? "12px" : "16px",
      marginBottom: "20px",
      color: colors.red,
      fontSize: isMobile ? "14px" : "16px",
    },

    welcomeCard: {
      background: `linear-gradient(135deg, ${colors.darkGreen} 0%, ${colors.lightGreen} 100%)`,
      borderRadius: isMobile ? "12px" : "16px",
      padding: isMobile ? "1.5rem" : "32px",
      color: "#ffffff",
      marginBottom: isMobile ? "1.5rem" : "32px",
    },

    welcomeTitle: {
      fontSize: isMobile ? "1.5rem" : "28px",
      fontWeight: "bold",
      margin: 0,
      marginBottom: "8px",
    },

    welcomeText: {
      fontSize: isMobile ? "14px" : "16px",
      opacity: 0.9,
      margin: 0,
      marginBottom: "24px",
    },

    welcomeStats: {
      display: "grid",
      gridTemplateColumns: isMobile
        ? "repeat(2, 1fr)"
        : "repeat(auto-fit, minmax(150px, 1fr))",
      gap: isMobile ? "1rem" : "32px",
    },

    welcomeStat: {
      display: "flex",
      flexDirection: "column",
      textAlign: isMobile ? "center" : "left",
    },

    statValue: {
      fontSize: isMobile ? "1.25rem" : "24px",
      fontWeight: "bold",
      margin: 0,
    },

    statLabel: {
      fontSize: isMobile ? "10px" : "12px",
      opacity: 0.8,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      margin: 0,
    },

    statsGrid: {
      display: "grid",
      gridTemplateColumns: isMobile
        ? "1fr"
        : "repeat(auto-fit, minmax(280px, 1fr))",
      gap: isMobile ? "1rem" : "24px",
      marginBottom: isMobile ? "1.5rem" : "32px",
    },

    statCard: {
      backgroundColor: "#ffffff",
      borderRadius: isMobile ? "8px" : "12px",
      padding: isMobile ? "1rem" : "24px",
      border: "1px solid #e2e8f0",
      transition: "transform 0.2s ease, box-shadow 0.2s ease",
      cursor: "pointer",
    },

    statCardHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: isMobile ? "12px" : "16px",
    },

    statCardTitle: {
      fontSize: isMobile ? "12px" : "14px",
      fontWeight: "500",
      color: "#64748b",
      margin: 0,
    },

    statCardIcon: {
      width: isMobile ? "32px" : "40px",
      height: isMobile ? "32px" : "40px",
      borderRadius: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },

    statCardValue: {
      fontSize: isMobile ? "1.5rem" : "32px",
      fontWeight: "bold",
      color: colors.black,
      margin: 0,
      marginBottom: "8px",
    },

    statCardChange: {
      fontSize: isMobile ? "12px" : "14px",
      fontWeight: "500",
      color: colors.lightGreen,
    },

    // Content for different sections
    sectionContent: {
      backgroundColor: "#ffffff",
      borderRadius: isMobile ? "8px" : "12px",
      padding: isMobile ? "1.5rem" : "32px",
      border: "1px solid #e2e8f0",
    },

    sectionTitle: {
      fontSize: isMobile ? "1.25rem" : "24px",
      fontWeight: "bold",
      color: colors.black,
      margin: 0,
      marginBottom: "16px",
    },

    sectionDescription: {
      fontSize: isMobile ? "14px" : "16px",
      color: "#64748b",
      lineHeight: "1.6",
      margin: 0,
    },
  };

  const getActiveContent = () => {
    if (loading) {
      return (
        <div style={styles.loadingContainer}>
          <div>Loading dashboard data...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div style={styles.errorContainer}>
          <strong>Error:</strong> {error}
        </div>
      );
    }

    const activeItem = flowchartItems.find((item) => item.id === activeSection);

    // Check if user has permission to view this content
    if (activeItem && activeItem.roles && !hasRequiredRole(activeItem.roles)) {
      return (
        <div style={styles.sectionContent}>
          <h2 style={styles.sectionTitle}>Access Denied</h2>
          <p style={styles.sectionDescription}>
            You do not have the required permissions to access this section.
          </p>
        </div>
      );
    }

    switch (activeSection) {
      case "dashboard":
        if (dashboardLoading) {
          return (
            <div style={styles.loadingContainer}>
              <div>Loading dashboard data...</div>
            </div>
          );
        }

        if (dashboardError) {
          return (
            <div style={styles.errorContainer}>
              <strong>Error:</strong> {dashboardError}
              <button
                onClick={refreshData}
                style={{
                  marginLeft: "10px",
                  padding: "5px 10px",
                  backgroundColor: colors.darkGreen,
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          );
        }

        if (!dashboardData) {
          return (
            <div style={styles.loadingContainer}>
              <div>No dashboard data available</div>
            </div>
          );
        }

        return (
          <div
            style={{
              minHeight: "100vh",
              backgroundColor: colors.cream,
              padding: isMobile ? "1rem" : "2rem",
              fontFamily: "Arial, Helvetica, sans-serif",
            }}
          >
            {/* KPI Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "repeat(auto-fit, minmax(280px, 1fr))",
                gap: isMobile ? "1rem" : "2rem",
                marginBottom: isMobile ? "2rem" : "3rem",
              }}
            >
              {[
                {
                  title: "Total Enrollees",
                  value:
                    dashboardData.kpiData.total_enrollees?.toLocaleString() ||
                    "0",
                  icon: Users,
                  color: colors.blue,
                },
                {
                  title: "Total Revenue",
                  value: `₱${(
                    dashboardData.kpiData.total_revenue || 0
                  ).toLocaleString()}`,
                  icon: DollarSign,
                  color: colors.lightGreen,
                },
                {
                  title: "Total Graduates",
                  value:
                    dashboardData.kpiData.total_graduates?.toString() || "0",
                  icon: GraduationCap,
                  color: colors.purple || "#9b59b6",
                },
                {
                  title: "Accounts Receivable",
                  value: `₱${(
                    dashboardData.kpiData.pending_receivables || 0
                  ).toLocaleString()}`,
                  icon: TrendingUp,
                  color: colors.coral,
                },
              ].map((kpi, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: isMobile ? "8px" : "12px",
                    padding: isMobile ? "1.5rem" : "2rem",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "1rem",
                    }}
                  >
                    <p
                      style={{
                        fontSize: isMobile ? "14px" : "16px",
                        fontWeight: "500",
                        color: "#64748b",
                        margin: 0,
                      }}
                    >
                      {kpi.title}
                    </p>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "8px",
                        backgroundColor: kpi.color + "20",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <kpi.icon size={20} color={kpi.color} />
                    </div>
                  </div>
                  <p
                    style={{
                      fontSize: isMobile ? "1.5rem" : "2rem",
                      fontWeight: "bold",
                      color: kpi.color,
                      margin: 0,
                    }}
                  >
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Charts Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
                gap: isMobile ? "1.5rem" : "2rem",
                marginBottom: isMobile ? "2rem" : "3rem",
              }}
            >
              {/* Revenue Analysis Chart */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: isMobile ? "8px" : "12px",
                  padding: isMobile ? "1.5rem" : "2rem",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                }}
              >
                <h3
                  style={{
                    fontSize: isMobile ? "1.1rem" : "1.25rem",
                    fontWeight: "600",
                    color: colors.black,
                    margin: "0 0 1.5rem 0",
                  }}
                >
                  Revenue Analysis
                </h3>
                <div style={{ width: "100%", height: "300px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.revenueHistogram}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => [
                          `₱${value.toLocaleString()}`,
                          "",
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="payment_received"
                        fill="#10B981"
                        name="Payment Received"
                      />
                      <Bar
                        dataKey="accounts_receivable"
                        fill="#F59E0B"
                        name="Accounts Receivable"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status Distribution Chart */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: isMobile ? "8px" : "12px",
                  padding: isMobile ? "1.5rem" : "2rem",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                }}
              >
                <h3
                  style={{
                    fontSize: isMobile ? "1.1rem" : "1.25rem",
                    fontWeight: "600",
                    color: colors.black,
                    margin: "0 0 1.5rem 0",
                  }}
                >
                  Enrollment Status Distribution
                </h3>
                <div style={{ width: "100%", height: "300px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboardData.statusDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {dashboardData.statusDistribution.map(
                          (entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          )
                        )}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Additional Charts */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
                gap: isMobile ? "1.5rem" : "2rem",
                marginBottom: isMobile ? "2rem" : "3rem",
              }}
            >
              {/* Enrollment Trend */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: isMobile ? "8px" : "12px",
                  padding: isMobile ? "1.5rem" : "2rem",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                }}
              >
                <h3
                  style={{
                    fontSize: isMobile ? "1.1rem" : "1.25rem",
                    fontWeight: "600",
                    color: colors.black,
                    margin: "0 0 1.5rem 0",
                  }}
                >
                  Monthly Enrollment Trend
                </h3>
                <div style={{ width: "100%", height: "300px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.enrollmentTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="enrollees"
                        stroke={colors.blue}
                        strokeWidth={3}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Batch Performance */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: isMobile ? "8px" : "12px",
                  padding: isMobile ? "1.5rem" : "2rem",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                }}
              >
                <h3
                  style={{
                    fontSize: isMobile ? "1.1rem" : "1.25rem",
                    fontWeight: "600",
                    color: colors.black,
                    margin: "0 0 1.5rem 0",
                  }}
                >
                  Batch Performance
                </h3>
                <div style={{ width: "100%", height: "300px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.batchData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="batch"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="enrollees"
                        fill={colors.blue}
                        name="Enrollees"
                      />
                      <Bar
                        dataKey="graduates"
                        fill="#10B981"
                        name="Graduates"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Batch Details Table */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: isMobile ? "8px" : "12px",
                padding: isMobile ? "1.5rem" : "2rem",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.5rem",
                }}
              >
                <h3
                  style={{
                    fontSize: isMobile ? "1.1rem" : "1.25rem",
                    fontWeight: "600",
                    color: colors.black,
                    margin: 0,
                  }}
                >
                  Batch Details
                </h3>
                <button
                  onClick={refreshData}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: colors.darkGreen,
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Refresh Data
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: 0,
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      {[
                        "Batch",
                        "Total Enrollees",
                        "Basic",
                        "Common",
                        "Core",
                        "Graduates",
                      ].map((header) => (
                        <th
                          key={header}
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#64748b",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.batchData.map((batch, index) => (
                      <tr
                        key={batch.batch}
                        style={{
                          backgroundColor:
                            index % 2 === 0 ? "#ffffff" : "#f8fafc",
                        }}
                      >
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            fontWeight: "500",
                            color: colors.black,
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          {batch.batch}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: colors.black,
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          {batch.enrollees}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: colors.black,
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          {batch.basic || 0}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: colors.black,
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          {batch.common || 0}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: colors.black,
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          {batch.core || 0}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: "14px",
                            color: colors.black,
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          {batch.graduates}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case "PendingPayments":
        return <PendingPayment />;

      case "CompletedPayments":
        return <CompletedPayment />;

      case "UploadPayments":
        return <UploadPayments />;

      case "referral-tracking":
        return <ReferralTracking />;

      case "CancelledPayment":
        return <CancelledPayments />;

      case "add-new-Student":
        return <StudentForm />;

      case "add-new-Staff":
        return <StaffForm />;

      case "DisplayAccount":
      case "account-management":
        return <DisplayAccount />;

      case "add-documents":
        return <AddDocument />;

      case "courses":
        return <Courses />;

      case "BatchStudent":
        return <Batch/>;

      case "pending-documents":
        return <PendingDocument />;

      default:
        return (
          <div style={styles.sectionContent}>
            <h2 style={styles.sectionTitle}>
              {activeItem?.label || "Section"}
            </h2>
            <p style={styles.sectionDescription}>
              This section contains all the functionality and data related to{" "}
              {activeItem?.label}. The system processes and analyzes data
              according to the established workflow to provide accurate metrics
              and insights for decision-making.
            </p>
          </div>
        );
    }
  };

  return (
    <div style={styles.container}>
      {/* Mobile Menu Button */}
      <button style={styles.mobileMenuButton} onClick={toggleSidebar}>
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Overlay */}
      <div style={styles.mobileOverlay} onClick={() => setSidebarOpen(false)} />

      {/* Navigation Panel */}
      <nav style={styles.navigationPanel}>
        <div style={styles.navHeader}>
          <div
            style={{
              width: "80px", // Consistent size
              height: "80px",
              backgroundColor: colors.cream,
              borderRadius: "12px", // Consistent border radius
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <img
              src="Copy of 8CON.png"
              alt="8CON Logo"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>

          {/* Close button for mobile */}
          <button
            style={styles.navCloseButton}
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div style={styles.navContent}>
          {filteredFlowchartItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const isExpanded = expandedNodes[item.id];

            return (
              <div key={item.id}>
                <button
                  style={{
                    ...styles.navItem,
                    ...(isActive ? styles.navItemActive : {}),
                  }}
                  onClick={() => {
                    if (item.hasChildren) {
                      toggleNode(item.id);
                    } else {
                      handleSectionClick(item.id);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive && !isMobile) {
                      e.target.style.backgroundColor =
                        "rgba(255, 255, 255, 0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive && !isMobile) {
                      e.target.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <div style={styles.navItemContent}>
                    <div style={styles.navItemLeft}>
                      <div
                        style={{
                          ...styles.navItemIcon,
                          backgroundColor: item.color,
                        }}
                      >
                        <Icon size={12} color="#ffffff" />
                      </div>
                      <span>{item.label}</span>
                    </div>
                    {item.hasChildren &&
                      (isExpanded ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      ))}
                  </div>
                </button>

                {item.hasChildren && isExpanded && (
                  <div style={styles.subNavList}>
                    {item.children.map((child) => (
                      <button
                        key={child.id}
                        style={styles.subNavItem}
                        onClick={() => handleSectionClick(child.id)}
                        onMouseEnter={(e) => {
                          if (!isMobile) {
                            e.target.style.backgroundColor =
                              "rgba(255, 255, 255, 0.05)";
                            e.target.style.color = "#ffffff";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isMobile) {
                            e.target.style.backgroundColor = "transparent";
                            e.target.style.color = "rgba(255, 255, 255, 0.8)";
                          }
                        }}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Logout Button */}
        <div style={styles.logoutContainer}>
          <button
            style={styles.logoutButton}
            onClick={handleLogout}
            onMouseEnter={(e) => {
              if (!isMobile) {
                e.target.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isMobile) {
                e.target.style.backgroundColor = "transparent";
              }
            }}
          >
            <div style={styles.logoutIcon}>
              <LogOut size={12} color="#ffffff" />
            </div>
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main style={styles.mainContent}>
        <header style={styles.header}>
          <h1 style={styles.headerTitle}>
            {activeSection === "dashboard"
              ? "Dashboard Overview"
              : flowchartItems.find((item) => item.id === activeSection)
                  ?.label || "Module Details"}
          </h1>
          <p style={styles.headerSubtitle}>
            {currentTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}{" "}
            | Role: {userRole || "Guest"}
          </p>
        </header>

        <div style={styles.dashboardContent}>{getActiveContent()}</div>
      </main>
    </div>
  );
}

export default UniversalDashboard;
