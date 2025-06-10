import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Users, FileText, Award, GraduationCap, DollarSign, UserCheck, FolderOpen, BarChart3, Home, Settings, Book, LogOut, User, Lock, Database, TrendingUp, Calculator, Target } from 'lucide-react'
import PendingPayment from './PendingPayment'
import CompletedPayment from './CompletedPayment'
import PaymentHistory from './PaymentHistory'

function UniversalDashboard() {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [expandedNodes, setExpandedNodes] = useState({})
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024)
  const [isLoggedIn, setIsLoggedIn] = useState(false) // Changed to false to show login first
  const [loginData, setLoginData] = useState({ username: '', password: '' })

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
    black: '#2c2c2c'
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


      hasChildren: true,
      children: [
        { id: 'PendingPayments', label: 'Pending Payments' },
        { id: 'CompletedPayments', label: 'Completed Payments' },
        { id: 'payment-history', label: 'Payment History' }
      ]
    },
    { 
      id: 'competency-assessment', 
      label: 'Competency & Assessment', 
      icon: Award, 
      color: colors.red,
      hasChildren: true,
      children: [
        { id: 'skill-assessment', label: 'Skill Assessment' },
        { id: 'performance-review', label: 'Performance Review' },
        { id: 'certification-tracking', label: 'Certification Tracking' }
      ]
    },
    { 
      id: 'graduation-eligibility', 
      label: 'Graduation Eligibility Checker', 
      icon: GraduationCap, 
      color: colors.dustyRose,
      hasChildren: true,
      children: [
        { id: 'credit-requirements', label: 'Credit Requirements' },
        { id: 'gpa-tracking', label: 'GPA Tracking' },
        { id: 'graduation-status', label: 'Graduation Status' }
      ]
    },
    { 
      id: 'scholarship-management', 
      label: 'Scholarship Management Module', 
      icon: DollarSign, 
      color: colors.lightGreen,
      hasChildren: true,
      children: [
        { id: 'available-scholarships', label: 'Available Scholarships' },
        { id: 'application-status', label: 'Application Status' },
        { id: 'scholarship-awards', label: 'Scholarship Awards' },
        { id: 'student-registration', label: 'Student Registration'}
      ]
    },
    { 
      id: 'referral-tracking', 
      label: 'Referral Tracking', 
      icon: Users, 
      color: colors.olive,
      hasChildren: true,
      children: [
        { id: 'referral-links', label: 'Referral Links' },
        { id: 'referral-status', label: 'Referral Status' },
        { id: 'referral-rewards', label: 'Referral Rewards' }
      ]
    },
    
    { 
      id: 'account-management', 
      label: 'Account Management', 
      icon: UserCheck, 
      color: colors.coral,
      hasChildren: true,
      children: [ 
       { id: 'add-new-Staff', label: 'Add New Staff' },
       { id: 'display-account', label: 'Display Account'}
      ]
    },
    { 
      id: 'document-tracker', 
      label: 'Document Tracker', 
      icon: FileText, 
      color: colors.red,
      hasChildren: true,
      children: [
        { id: 'uploaded-documents', label: 'Uploaded Documents' },
        { id: 'pending-documents', label: 'Pending Documents' },
        { id: 'verified-documents', label: 'Verified Documents' }
      ]
    },
     { 
      id: 'settings', 
      label: 'Settings', 
      icon:  Settings, 
      color: colors.red,
      hasChildren: true,
      children: [
        { id: 'profile-settings', label: 'Profile Settings' },
        { id: 'security-settings', label: 'Security Settings' },
        { id: 'notification-preferences', label: 'Notification Preferences' }
      ]
    }
    
  ]

  const handleLogin = () => {
    if (loginData.username && loginData.password) {
      setIsLoggedIn(true)
      setActiveSection('dashboard')
    } else {
      alert('Please enter both username and password')
    }
  }

  const handleLogout = () => {
    // Reset all states to initial values
    setIsLoggedIn(false)
    setActiveSection('dashboard')
    setExpandedNodes({})
    setLoginData({ username: '', password: '' })
  }

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }))
  }

  const handleSectionClick = (sectionId) => {
    console.log(sectionId);
    setActiveSection(sectionId)
  }

  const styles = {
    // Login Page Styles
    loginContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: colors.cream,
      fontFamily: 'Arial, sans-serif',
      padding: '16px'
    },

    loginCard: {
      width: '100%',
      maxWidth: '420px',
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
      padding: '40px',
      textAlign: 'center',
      border: `1px solid ${colors.lightGreen}`
    },

    loginHeader: {
      textAlign: 'center',
      marginBottom: '32px'
    },

    loginLogo: {
      height: '120px',
      marginBottom: '0px'
    },

    loginLogoFallback: {
      height: '120px',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '32px',
      fontWeight: 'bold',
      color: colors.darkGreen,
      backgroundColor: colors.cream,
      borderRadius: '12px',
      marginBottom: '16px'
    },

    loginTitle: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: colors.black,
      marginBottom: '8px'
    },

    loginSubtitle: {
      fontSize: '14px',
      color: colors.olive,
      marginBottom: '24px'
    },

    loginInput: {
      width: '100%',
      padding: '12px',
      marginBottom: '16px',
      border: `1px solid ${colors.lightGreen}`,
      borderRadius: '8px',
      fontSize: '14px',
      boxSizing: 'border-box'
    },

    passwordWrapper: {
      position: 'relative',
      marginBottom: '16px'
    },

    loginButton: {
      width: '100%',
      backgroundColor: colors.darkGreen,
      color: '#ffffff',
      border: 'none',
      borderRadius: '8px',
      padding: '12px 24px',
      fontSize: '16px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      marginTop: '8px'
    },

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

    navTitle: {
      fontSize: '20px',
      fontWeight: 'bold',
      color: '#ffffff',
      margin: 0,
      marginBottom: '8px'
    },

    navSubtitle: {
      fontSize: '14px',
      color: '#000000',
      margin: 0,
      fontWeight: 'bold'
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

    // Workflow Cards
    workflowSection: {
      marginBottom: '32px'
    },

    workflowTitle: {
      fontSize: '20px',
      fontWeight: 'bold',
      color: colors.black,
      marginBottom: '16px'
    },

    workflowGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '16px'
    },

    workflowCard: {
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      padding: '20px',
      border: '1px solid #e2e8f0',
      transition: 'all 0.2s ease'
    },

    workflowCardTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: colors.black,
      marginBottom: '8px'
    },

    workflowCardDescription: {
      fontSize: '14px',
      color: '#64748b',
      marginBottom: '16px'
    },

    workflowButton: {
      backgroundColor: colors.darkGreen,
      color: '#ffffff',
      border: 'none',
      borderRadius: '6px',
      padding: '8px 16px',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease'
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

  // Login Page Component
  if (!isLoggedIn) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <img 
            src="Copy of 8CON.png" 
            alt="8Con Logo" 
            style={styles.loginLogo}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div style={styles.loginLogoFallback}>
            8CON
          </div>
          <h2 style={styles.loginTitle}>Welcome Back</h2>
          <p style={styles.loginSubtitle}>Please sign in to your account</p>

          <input
            type="text"
            placeholder="Username"
            value={loginData.username}
            onChange={(e) => setLoginData({...loginData, username: e.target.value})}
            style={styles.loginInput}
          />

          <div style={styles.passwordWrapper}>
            <input
              type="password"
              placeholder="Password"
              value={loginData.password}
              onChange={(e) => setLoginData({...loginData, password: e.target.value})}
              style={styles.loginInput}
            />
          </div>

          <button
            onClick={handleLogin}
            style={styles.loginButton}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.olive}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = colors.darkGreen}
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  const getActiveContent = () => {
    const activeItem = flowchartItems.find(item => item.id === activeSection)
    switch (activeSection)
    {
    case 'dashboard':
    if (activeSection === 'dashboard') {
      return (
        <div>
          {/* Welcome Card */}
          <div style={styles.welcomeCard}>
            <h2 style={styles.welcomeTitle}>Student Management Dashboard</h2>
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
                <span style={styles.statValue}>2,847</span>
                <span style={styles.statLabel}>Total Students</span>
              </div>
              <div style={styles.welcomeStat}>
                <span style={styles.statValue}>321</span>
                <span style={styles.statLabel}>Graduates</span>
              </div>
              <div style={styles.welcomeStat}>
                <span style={styles.statValue}>₱2.4M</span>
                <span style={styles.statLabel}>Total Revenue</span>
              </div>
              <div style={styles.welcomeStat}>
                <span style={styles.statValue}>94%</span>
                <span style={styles.statLabel}>Success Rate</span>
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div style={styles.statsGrid}>
            {[
              { title: 'Current Enrollment', value: '1,245', change: '+8.2%', color: colors.blue, icon: Users },
              { title: 'Scholar Students', value: '456', change: '+12.5%', color: colors.purple, icon: Award },
              { title: 'Paying Students', value: '789', change: '+5.8%', color: colors.coral, icon: DollarSign },
              { title: 'OJT Students', value: '234', change: '+15.3%', color: colors.olive, icon: Target },
              { title: 'Monthly Revenue', value: '₱180K', change: '+7.2%', color: colors.lightGreen, icon: TrendingUp },
              { title: 'Dropout Rate', value: '3.2%', change: '-1.1%', color: colors.red, icon: Calculator }
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

          {/* Workflow Process Overview */}
          {/* <div style={styles.workflowSection}>
            <h3 style={styles.workflowTitle}>Data Processing Workflow</h3>
            <div style={styles.workflowGrid}>
              {[
                {
                  title: 'Data Collection',
                  description: 'System gathers enrollment and student data from multiple sources',
                  action: 'View Data Sources'
                },
                {
                  title: 'Analytics Processing',
                  description: 'Calculate dropout rates, revenue metrics, and graduation analytics',
                  action: 'View Analytics'
                },
                {
                  title: 'Revenue Calculation',
                  description: 'Process total revenue by batch, month, and year with payment status',
                  action: 'View Revenue'
                },
                {
                  title: 'Dashboard Display',
                  description: 'Present processed metrics and KPIs in an intuitive dashboard',
                  action: 'Current View'
                }
              ].map((workflow, index) => (
                <div
                  key={index}
                  style={styles.workflowCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <h4 style={styles.workflowCardTitle}>{workflow.title}</h4>
                  <p style={styles.workflowCardDescription}>{workflow.description}</p>
                  <button
                    style={styles.workflowButton}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.olive}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = colors.darkGreen}
                  >
                    {workflow.action}
                  </button>
                </div>
              ))}
            </div>
          </div> */}
        </div>
      )
    };
    break;

    case 'PendingPayments':
  
    return(
      <PendingPayment/>
    );
    case 'CompletedPayments':
  
    return(
      <CompletedPayment/>
    );
    case 'payment-history':
  
    return(
      <PaymentHistory/>
    );
    
    default:
    return (
      <div style={styles.sectionContent}>
        <h2 style={styles.sectionTitle}>{activeItem?.label}</h2>
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
          {flowchartItems.map((item) => {
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
            })}
          </p>
        </header>
        
        <div style={styles.dashboardContent}>
          {getActiveContent()}
        </div>
      </main>
    </div>
  )
}

export default UniversalDashboard;