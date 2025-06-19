import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Users, FileText, Award, GraduationCap, DollarSign, UserCheck, FolderOpen, BarChart3, Home, Settings, Book, LogOut, User, Lock, Database, TrendingUp, Calculator, Target } from 'lucide-react'
import PendingPayment from './PendingPayment'
import CompletedPayment from './CompletedPayment'
import PaymentHistory from './PaymentHistory'
import StudentForm from './AddStudent'
import StaffForm from './AddStaff'
import DisplayAccount from './DisplayAccount'
import AddDocument from './AddDocument'
import PendingDocument from './PendingDocument'
import Courses from './Courses'

import { useNavigate } from 'react-router-dom'
import UploadPayments from './UploadPayment'

// API configuration
const API_BASE_URL = 'http://localhost:3000/api'

// API helper function
const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token')
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { ...defaultHeaders, ...options.headers },
      ...options
    })

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/'
        return null
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error)
    throw error
  }
}

function UniversalDashboard() {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [expandedNodes, setExpandedNodes] = useState({})
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024)
  const [userRole, setUserRole] = useState('')
  const [userInfo, setUserInfo] = useState(null)
  const [dashboardMetrics, setDashboardMetrics] = useState({
    enrolled_students: 0,
    graduated_students: 0,
    pending_payments: 0,
    total_revenue: 0,
    monthly_enrollments: [],
    competency_breakdown: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  // Initialize user data and fetch dashboard metrics
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('token')
        
        if (!token) {
          navigate('/')
          return
        }

        // Decode JWT token to get user info
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          setUserRole(payload.role || 'student')
          setUserInfo(payload)
        } catch (tokenError) {
          console.error('Invalid token format:', tokenError)
          localStorage.removeItem('token')
          navigate('/')
          return
        }

        // Fetch dashboard metrics for admin/staff
        if (['admin', 'staff'].includes(userRole)) {
          await fetchDashboardMetrics()
        }

      } catch (error) {
        console.error('Dashboard initialization error:', error)
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    initializeDashboard()
  }, [userRole, navigate])

  // Fetch dashboard metrics from server
  const fetchDashboardMetrics = async () => {
    try {
      const metrics = await apiCall('/dashboard/metrics')
      if (metrics) {
        setDashboardMetrics(metrics)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard metrics:', error)
      setError('Failed to load dashboard metrics')
    }
  }

  // Time update effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024)
    
    window.addEventListener('resize', handleResize)
    
    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Color palette from branding image
  const colors = {
    darkGreen: '#2d4a3d',
    lightGreen: '#7a9b8a', 
    dustyRose: '#c19a9a',
    coral: '#d85c5c',
    red: '#d63447',
    cream: '#f5f2e8',
    olive: '#6b7c5c',
    black: '#2c2c2c',
    blue: '#4a90e2',
    purple: '#9b59b6'
  }

  // Function to check if user has required role
  const hasRequiredRole = (requiredRoles) => {
    if (!requiredRoles || requiredRoles.length === 0) return true
    return requiredRoles.includes(userRole)
  }

  // Flowchart navigation items
  const flowchartItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: Home, 
      color: colors.darkGreen,
      hasChildren: false 
    },
    { 
      id: 'payment-tracker', 
      label: 'Payment Tracker', 
      icon: DollarSign, 
      color: colors.coral,
      roles: ['admin', 'staff'],
      hasChildren: true,
      children: [
        { id: 'UploadPayments', label: 'Upload Payments'},
        { id: 'PendingPayments', label: 'Pending Payments' },
        { id: 'CompletedPayments', label: 'Completed Payments' }
      ]
    },
    { 
      id: 'courses', 
      label: 'Courses', 
      icon: Award, 
      color: colors.blue,
      roles: ['admin', 'staff'],
      // hasChildren: true,
      // children: [
      //   { id: 'skill-assessment', label: 'Skill Assessment' },
      // ]
    },
    { 
      id: 'competency-assessment', 
      label: 'Competency & Assessment', 
      icon: Award, 
      color: colors.red,
      roles: ['admin', 'staff'],
      hasChildren: true,
      children: [
        { id: 'skill-assessment', label: 'Skill Assessment' },
        { id: 'performance-review', label: 'Performance Review' },
        { id: 'certification-tracking', label: 'Certification Tracking' }
      ]
    },
    // { 
    //   id: 'graduation-eligibility', 
    //   label: 'Graduation Eligibility Checker', 
    //   icon: GraduationCap, 
    //   color: colors.dustyRose,
    //   hasChildren: true,
    //   children: [
    //     { id: 'credit-requirements', label: 'Credit Requirements' },
    //     { id: 'gpa-tracking', label: 'GPA Tracking' },
    //     { id: 'graduation-status', label: 'Graduation Status' }
    //   ]
    // },
    { 
      id: 'referral', 
      label: 'Referral', 
      icon: Users, 
      color: colors.olive,
    },
    { 
      id: 'account-management', 
      label: 'Account Management', 
      icon: UserCheck, 
      color: colors.coral,
      roles: ['admin'],
      hasChildren: true,
      children: [ 
       { id: 'add-new-Staff', label: 'Add New Staff' },
       { id: 'add-new-Student', label: 'Add New Student' },
       { id: 'DisplayAccount', label: 'Manage Accounts' }
      ]
    },
    { 
      id: 'document-tracker', 
      label: 'Document Tracker', 
      icon: FileText, 
      color: colors.red,
      roles: ['admin', 'staff'],
      hasChildren: true,
      children: [
        { id: 'add-documents', label: 'Documents'},
        { id: 'pending-documents', label: 'Pending Document'}
      ]
    }
  ]

  // Filter navigation items based on user role
  const filteredFlowchartItems = flowchartItems.filter(item => 
    hasRequiredRole(item.roles)
  )

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token')

      if (token) {
        await apiCall('/auth/logout', {
          method: 'POST'
        })
      }

      // Clear token and reset UI
      localStorage.removeItem('token')
      navigate('/')
      setActiveSection('dashboard')
      setExpandedNodes({})
      setUserRole('')
      setUserInfo(null)
    } catch (error) {
      console.error('Logout failed:', error)
      // Still redirect even if logout API fails
      localStorage.removeItem('token')
      navigate('/')
    }
  }

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }))
  }

  const handleSectionClick = (sectionId) => {
    // Check if user has permission to access this section
    const clickedItem = flowchartItems.find(item => 
      item.id === sectionId || (item.children && item.children.some(child => child.id === sectionId))
    )
    
    if (clickedItem && clickedItem.roles && !hasRequiredRole(clickedItem.roles)) {
      setError('You do not have permission to access this section.')
      return
    }
    
    setActiveSection(sectionId)
    setError(null) // Clear any previous errors
  }

  const styles = {
    // Dashboard Styles
    container: {
      display: 'flex',
      height: '100vh',
      backgroundColor: colors.cream,
      fontFamily: 'Arial, Helvetica, sans-serif',
      overflow: 'hidden'
    },

    // Navigation Panel
    navigationPanel: {
      width: '320px',
      backgroundColor: colors.darkGreen,
      color: '#ffffff',
      overflowY: 'auto',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column'
    },

    navHeader: {
      padding: '10px 20px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      backgroundColor: colors.lightGreen,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'  
    },

    navContent: {
      padding: '16px 0',
      flex: 1
    },

    navItem: {
      display: 'block',
      width: '100%',
      border: 'none',
      backgroundColor: 'transparent',
      color: '#ffffff',
      padding: '12px 20px',
      textAlign: 'left',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontSize: '14px'
    },

    navItemContent: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    },

    navItemLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },

    navItemIcon: {
      width: '20px',
      height: '20px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },

    navItemActive: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderLeft: '4px solid ' + colors.red
    },

    subNavList: {
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)'
    },

    subNavItem: {
      display: 'block',
      width: '100%',
      border: 'none',
      backgroundColor: 'transparent',
      color: 'rgba(255, 255, 255, 0.8)',
      padding: '8px 20px 8px 56px',
      textAlign: 'left',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontSize: '13px'
    },

    // Logout Button
    logoutContainer: {
      padding: '16px 20px',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      marginTop: 'auto'
    },

    logoutButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      width: '100%',
      border: 'none',
      backgroundColor: 'transparent',
      color: '#ffffff',
      padding: '12px 0',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontSize: '14px'
    },

    logoutIcon: {
      width: '20px',
      height: '20px',
      borderRadius: '4px',
      backgroundColor: colors.red,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },

    // Main Content Area
    mainContent: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff'
    },

    header: {
      backgroundColor: '#ffffff',
      padding: '20px 32px',
      borderBottom: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    },

    headerTitle: {
      fontSize: '28px',
      fontWeight: 'bold',
      color: colors.black,
      margin: 0,
      marginBottom: '4px'
    },

    headerSubtitle: {
      fontSize: '14px',
      color: colors.lightGreen,
      margin: 0
    },

    dashboardContent: {
      flex: 1,
      padding: '32px',
      overflowY: 'auto',
      backgroundColor: colors.cream
    },

    // Loading and Error States
    loadingContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '200px',
      fontSize: '16px',
      color: colors.lightGreen
    },

    errorContainer: {
      backgroundColor: '#fee',
      border: '1px solid #fcc',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '20px',
      color: colors.red
    },

    welcomeCard: {
      background: `linear-gradient(135deg, ${colors.darkGreen} 0%, ${colors.lightGreen} 100%)`,
      borderRadius: '16px',
      padding: '32px',
      color: '#ffffff',
      marginBottom: '32px'
    },

    welcomeTitle: {
      fontSize: '28px',
      fontWeight: 'bold',
      margin: 0,
      marginBottom: '8px'
    },

    welcomeText: {
      fontSize: '16px',
      opacity: 0.9,
      margin: 0,
      marginBottom: '24px'
    },

    welcomeStats: {
      display: 'flex',
      gap: '32px',
      flexWrap: 'wrap'
    },

    welcomeStat: {
      display: 'flex',
      flexDirection: 'column'
    },

    statValue: {
      fontSize: '24px',
      fontWeight: 'bold',
      margin: 0
    },

    statLabel: {
      fontSize: '12px',
      opacity: 0.8,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      margin: 0
    },

    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '24px',
      marginBottom: '32px'
    },

    statCard: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '24px',
      border: '1px solid #e2e8f0',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      cursor: 'pointer'
    },

    statCardHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '16px'
    },

    statCardTitle: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#64748b',
      margin: 0
    },

    statCardIcon: {
      width: '40px',
      height: '40px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },

    statCardValue: {
      fontSize: '32px',
      fontWeight: 'bold',
      color: colors.black,
      margin: 0,
      marginBottom: '8px'
    },

    statCardChange: {
      fontSize: '14px',
      fontWeight: '500',
      color: colors.lightGreen
    },

    // Content for different sections
    sectionContent: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '32px',
      border: '1px solid #e2e8f0'
    },

    sectionTitle: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: colors.black,
      margin: 0,
      marginBottom: '16px'
    },

    sectionDescription: {
      fontSize: '16px',
      color: '#64748b',
      lineHeight: '1.6',
      margin: 0
    }
  }

  const getActiveContent = () => {
    if (loading) {
      return (
        <div style={styles.loadingContainer}>
          <div>Loading dashboard data...</div>
        </div>
      )
    }

    if (error) {
      return (
        <div style={styles.errorContainer}>
          <strong>Error:</strong> {error}
        </div>
      )
    }

    const activeItem = flowchartItems.find(item => item.id === activeSection)
    
    // Check if user has permission to view this content
    if (activeItem && activeItem.roles && !hasRequiredRole(activeItem.roles)) {
      return (
        <div style={styles.sectionContent}>
          <h2 style={styles.sectionTitle}>Access Denied</h2>
          <p style={styles.sectionDescription}>
            You do not have the required permissions to access this section.
          </p>
        </div>
      )
    }
    
    switch (activeSection) {
      case 'dashboard':
        return (
          <div>
            {/* Welcome Card */}
            <div style={styles.welcomeCard}>
              <h2 style={styles.welcomeTitle}>
                Welcome back, {userInfo?.username || 'User'}!
              </h2>
              <p style={styles.welcomeText}>
                {currentTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
              <div style={styles.welcomeStats}>
                <div style={styles.welcomeStat}>
                  <span style={styles.statValue}>{dashboardMetrics.enrolled_students}</span>
                  <span style={styles.statLabel}>Enrolled Students</span>
                </div>
                <div style={styles.welcomeStat}>
                  <span style={styles.statValue}>{dashboardMetrics.graduated_students}</span>
                  <span style={styles.statLabel}>Graduates</span>
                </div>
                <div style={styles.welcomeStat}>
                  <span style={styles.statValue}>₱{(dashboardMetrics.total_revenue || 0).toLocaleString()}</span>
                  <span style={styles.statLabel}>Total Revenue</span>
                </div>
                <div style={styles.welcomeStat}>
                  <span style={styles.statValue}>{dashboardMetrics.pending_payments}</span>
                  <span style={styles.statLabel}>Pending Payments</span>
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            {['admin', 'staff'].includes(userRole) && (
              <div style={styles.statsGrid}>
                {[
                  { 
                    title: 'Current Enrollment', 
                    value: dashboardMetrics.enrolled_students, 
                    change: '+8.2%', 
                    color: colors.blue, 
                    icon: Users 
                  },
                  { 
                    title: 'Graduated Students', 
                    value: dashboardMetrics.graduated_students, 
                    change: '+12.5%', 
                    color: colors.purple, 
                    icon: Award 
                  },
                  { 
                    title: 'Pending Payments', 
                    value: dashboardMetrics.pending_payments, 
                    change: '+5.8%', 
                    color: colors.coral, 
                    icon: DollarSign 
                  },
                  { 
                    title: 'Monthly Revenue', 
                    value: `₱${(dashboardMetrics.total_revenue || 0).toLocaleString()}`, 
                    change: '+7.2%', 
                    color: colors.lightGreen, 
                    icon: TrendingUp 
                  }
                ].map((stat, index) => (
                  <div
                    key={index}
                    style={styles.statCard}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)'
                      e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div style={styles.statCardHeader}>
                      <h3 style={styles.statCardTitle}>{stat.title}</h3>
                      <div style={{
                        ...styles.statCardIcon,
                        backgroundColor: stat.color + '20'
                      }}>
                        <stat.icon size={20} color={stat.color} />
                      </div>
                    </div>
                    <div style={styles.statCardValue}>{stat.value}</div>
                    <div style={styles.statCardChange}>{stat.change} vs last month</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case 'PendingPayments':
        return <PendingPayment />

      case 'CompletedPayments':
        return <CompletedPayment />

      case 'UploadPayments':
        return <UploadPayments/>

      case 'payment-tracker':
        return <PaymentHistory />

      case 'add-new-Student':
        return <StudentForm />

      case 'add-new-Staff':
        return <StaffForm />

      case 'DisplayAccount':
      case 'account-management':
        return <DisplayAccount />

      case 'add-documents':
        return <AddDocument />

      case 'courses':
        return <Courses/>

      case 'pending-documents':
        return <PendingDocument/>

      default:
        return (
          <div style={styles.sectionContent}>
            <h2 style={styles.sectionTitle}>{activeItem?.label || 'Section'}</h2>
            <p style={styles.sectionDescription}>
              This section contains all the functionality and data related to {activeItem?.label}. 
              The system processes and analyzes data according to the established workflow to provide 
              accurate metrics and insights for decision-making.
            </p>
          </div>
        )
    }
  }

  return (
    <div style={styles.container}>
      {/* Navigation Panel */}
      <nav style={styles.navigationPanel}>
        <div style={styles.navHeader}>
          <div style={{
            width: '80px',
            height: '80px',
            backgroundColor: colors.cream,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            <img 
              src="Copy of 8CON.png" 
              alt="8CON Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
            />
          </div>
        </div>
        
        <div style={styles.navContent}>
          {filteredFlowchartItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            const isExpanded = expandedNodes[item.id]
            
            return (
              <div key={item.id}>
                <button
                  style={{
                    ...styles.navItem,
                    ...(isActive ? styles.navItemActive : {})
                  }}
                  onClick={() => {
                    if (item.hasChildren) {
                      toggleNode(item.id)
                    }
                    handleSectionClick(item.id)
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.target.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  <div style={styles.navItemContent}>
                    <div style={styles.navItemLeft}>
                      <div style={{
                        ...styles.navItemIcon,
                        backgroundColor: item.color
                      }}>
                        <Icon size={12} color="#ffffff" />
                      </div>
                      <span>{item.label}</span>
                    </div>
                    {item.hasChildren && (
                      isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                    )}
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
                          e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                          e.target.style.color = '#ffffff'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'transparent'
                          e.target.style.color = 'rgba(255, 255, 255, 0.8)'
                        }}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Logout Button */}
        <div style={styles.logoutContainer}>
          <button
            style={styles.logoutButton}
            onClick={handleLogout}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent'
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
            {activeSection === 'dashboard' ? 'Dashboard Overview' : 
             flowchartItems.find(item => item.id === activeSection)?.label || 'Module Details'}
          </h1>
          <p style={styles.headerSubtitle}>
            {currentTime.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              second: '2-digit'
            })} | Role: {userRole || 'Guest'}
          </p>
        </header>
        
        <div style={styles.dashboardContent}>
          {getActiveContent()}
        </div>
      </main>
    </div>
  )
}

export default UniversalDashboard