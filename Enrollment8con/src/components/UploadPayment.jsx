import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  User,
  CreditCard,
  FileText,
  DollarSign,
  Search,
  X,
} from "lucide-react";

const UploadPayments = ({ onSuccess, onCancel }) => {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [currentStudentId, setStudentId] = useState("");
  const [additionalData, setAdditionalData] = useState("");
  const [formData, setFormData] = useState({
    student_id: "",
    account_id: currentStudentId || "",
    method_id: "",
    payment_amount: "",
    reference_number: "",
    notes: "",
    receipt_path: "", // Added for the receipt upload
  });

  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [studentAccounts, setStudentAccounts] = useState([]);
  const searchTimeoutRef = useRef(null);

  const paymentTypes = [
    "Tuition",
    "Registration",
    "Miscellaneous",
    "Laboratory Fee",
    "Graduation Fee",
    "Certificate Fee",
    "Materials Fee",
    "Technology Fee",
  ];

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Fetch payment methods from database
  const fetchPaymentMethods = useCallback(async () => {
    try {
      const token = localStorage?.getItem("token");
      if (!token) return;

      const response = await fetch(
        "http://localhost:3000/api/payment-methods/active",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const methods = await response.json();
        setPaymentMethods(methods);
      }
    } catch (error) {
      console.error("Error fetching payment methods:", error);
    }
  }, []);

  // Search students function (similar to AddDocument.jsx)
  const searchStudents = useCallback(async (searchValue) => {
    if (!searchValue.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setError(null);

    try {
      const token = localStorage?.getItem("token");
      if (!token) {
        setError("Please log in to search for students");
        setSearchLoading(false);
        return;
      }

      const apiUrl = `http://localhost:3000/api/students?search=${encodeURIComponent(
        searchValue
      )}`;

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
          const studentsData = await response.json();
          setSearchResults(studentsData);
          const studentAdditionalDatas = await fetch(
            `http://localhost:3000/api/students/${studentsData[0].student_id}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                // Don't set Content-Type header for FormData - browser sets it automatically with boundary
              },
            }
          );
          const data = await studentAdditionalDatas.json();
          console.log("Student additional data:", data);
          setStudentId(data.account_id);
          console.log("Current student ID:", currentStudentId);

          if (studentsData.length === 0) {
            setError("No students found matching your search");
          }
        } else {
          setError("Invalid response from server");
        }
      } else {
        let errorMessage = "Failed to search students";

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }

        setError(errorMessage);
      }
    } catch (error) {
      setError(
        "Failed to search students. Please check your connection and try again."
      );
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Fetch student accounts for selected student
  const fetchStudentAccounts = useCallback(async (studentId) => {
    try {
      const token = localStorage?.getItem("token");
      if (!token) return;

      const response = await fetch(
        `http://localhost:3000/api/students/${studentId}/account-balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const accounts = await response.json();
        setStudentAccounts(accounts);
      }
    } catch (error) {
      console.error("Error fetching student accounts:", error);
    }
  }, []);

  useEffect(() => {
    fetchPaymentMethods();

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [fetchPaymentMethods]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (error) setError(null);
    if (success) setSuccess(null);

    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchStudents(value);
    }, 300);
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setSearchTerm(
      `${student.first_name} ${student.last_name} (${student.student_id})`
    );
    setSearchResults([]);
    setError(null);
    setFormData((prev) => ({
      ...prev,
      student_id: student.student_id,
    }));
    fetchStudentAccounts(student.student_id);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // File change handler
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          file: "File size must be less than 10MB",
        }));
        return;
      }

      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf",
      ];
      if (!allowedTypes.includes(file.type)) {
        setErrors((prev) => ({
          ...prev,
          file: "Only PDF, PNG, and JPG files are allowed",
        }));
        return;
      }

      setSelectedFile(file);
      setErrors((prev) => ({ ...prev, file: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!selectedStudent) {
      newErrors.student = "Please select a student";
    }

    if (!formData.account_id) {
      newErrors.account_id = "Please select a student account";
    }

    if (!formData.method_id) {
      newErrors.method_id = "Please select a payment method";
    }

    if (!formData.payment_amount || parseFloat(formData.payment_amount) <= 0) {
      newErrors.payment_amount = "Please enter a valid payment amount";
    }

    if (!selectedFile) {
      newErrors.file = "Please upload a payment receipt";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage?.getItem("token");

      if (!token) {
        throw new Error("No authentication token found. Please login again.");
      }
      // Validate selected student

      // Prepare FormData
      const uploadData = new FormData();
      uploadData.append("account_id", formData.account_id);
      uploadData.append("method_id", formData.method_id);
      uploadData.append("payment_amount", formData.payment_amount);
      uploadData.append("student_id", formData.student_id);
      console.log("Selected student ID:", formData.student_id);
      if (formData.reference_number) {
        uploadData.append("reference_number", formData.reference_number);
      }

      if (formData.notes) {
        uploadData.append("notes", formData.notes);
      }

      if (selectedFile) {
        uploadData.append("receipt", selectedFile);
      }

      console.log("Upload data prepared:", Array.from(uploadData.entries()));

      // Make the API request
      const paymentResponse = await fetch(
        "http://localhost:3000/api/payments/upload-with-receipt",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            // Do not set Content-Type for FormData
          },
          body: uploadData,
        }
      );

      const paymentResult = await paymentResponse.json();

      if (!paymentResponse.ok) {
        throw new Error(
          paymentResult.error ||
            `Payment creation failed: ${paymentResponse.status}`
        );
      }

      // Success handling
      setSuccess(
        `Payment uploaded successfully! ${
          paymentResult.receipt_uploaded ? "Receipt uploaded." : ""
        }`
      );

      // Clear form AFTER success
      resetForm();

      if (onSuccess) {
        onSuccess(paymentResult);
      }
    } catch (error) {
      console.error("Payment submission error:", error);
      setError(error.message || "Failed to upload payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to reset form state
  const resetForm = () => {
    setSelectedStudent(null);
    setSearchTerm("");
    setSelectedFile(null);
    setFormData({
      student_id: "",
      account_id: currentStudentId || "",
      method_id: "",
      payment_amount: "",
      reference_number: "",
      notes: "",
      receipt_path: "",
    });
    setStudentAccounts([]);

    // Clear file input
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.value = "";
    }
  };

  // Responsive styles object (keeping original styles but adding new ones for search)
  const styles = {
    container: {
      minHeight: "100vh",
      backgroundColor: "#f9fafb",
    },
    header: {
      backgroundColor: "white",
      boxShadow:
        "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
      borderBottom: "1px solid #e5e7eb",
      padding: isMobile ? "1rem" : "1rem 1.5rem",
    },
    headerContent: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexDirection: isMobile ? "column" : "row",
      gap: isMobile ? "0.5rem" : "0",
    },
    headerTitle: {
      fontSize: isMobile ? "1.25rem" : "1.5rem",
      fontWeight: "bold",
      color: "#1f2937",
      textAlign: isMobile ? "center" : "left",
    },
    headerSubtitle: {
      color: "#6b7280",
      fontSize: "0.875rem",
      marginTop: "0.25rem",
      textAlign: isMobile ? "center" : "left",
    },
    mainContent: {
      padding: isMobile ? "1rem" : "1.5rem",
    },
    contentWrapper: {
      maxWidth: "64rem",
      margin: "0 auto",
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: isMobile
        ? "repeat(2, 1fr)"
        : "repeat(auto-fit, minmax(200px, 1fr))",
      gap: isMobile ? "0.75rem" : "1rem",
      marginBottom: "1.5rem",
    },
    statsCard: {
      backgroundColor: "white",
      borderRadius: "0.5rem",
      padding: isMobile ? "0.75rem" : "1rem",
      boxShadow:
        "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
      border: "1px solid #e5e7eb",
      textAlign: "center",
    },
    statsNumber: {
      fontSize: isMobile ? "1.25rem" : "1.5rem",
      fontWeight: "bold",
      color: "#1f2937",
    },
    statsNumberGreen: {
      fontSize: isMobile ? "1.25rem" : "1.5rem",
      fontWeight: "bold",
      color: "#059669",
    },
    statsLabel: {
      fontSize: isMobile ? "0.75rem" : "0.875rem",
      color: "#6b7280",
      marginTop: "0.25rem",
    },
    formContainer: {
      backgroundColor: "white",
      borderRadius: "0.5rem",
      boxShadow:
        "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
      border: "1px solid #e5e7eb",
      overflow: "hidden",
    },
    formHeader: {
      background: "linear-gradient(135deg, #375e4b 0%, #6d8f81 100%)",
      color: "white",
      padding: isMobile ? "1rem" : "1rem 1.5rem",
      textAlign: isMobile ? "center" : "left",
    },
    formHeaderTitle: {
      fontSize: isMobile ? "1rem" : "1.125rem",
      fontWeight: "600",
      marginBottom: "0.25rem",
    },
    formHeaderSubtitle: {
      color: "#ffffff",
      fontSize: isMobile ? "0.8rem" : "0.875rem",
      opacity: 0.9,
    },
    formContent: {
      padding: isMobile ? "1rem" : "1.5rem",
    },
    formSection: {
      marginBottom: isMobile ? "1rem" : "1.5rem",
    },
    gridRow2: {
      display: "grid",
      gridTemplateColumns: isMobile
        ? "1fr"
        : "repeat(auto-fit, minmax(300px, 1fr))",
      gap: isMobile ? "1rem" : "1.5rem",
    },
    gridRow3: {
      display: "grid",
      gridTemplateColumns: isMobile
        ? "1fr"
        : "repeat(auto-fit, minmax(200px, 1fr))",
      gap: isMobile ? "1rem" : "1.5rem",
    },
    label: {
      display: "block",
      fontSize: isMobile ? "0.8rem" : "0.875rem",
      fontWeight: "600",
      color: "#374151",
      marginBottom: "0.5rem",
    },
    required: {
      color: "#ef4444",
      marginLeft: "4px",
    },
    inputGroup: {
      position: "relative",
      marginBottom: "16px",
    },
    inputIcon: {
      position: "absolute",
      left: "12px",
      top: "50%",
      transform: "translateY(-50%)",
      color: "#9ca3af",
      pointerEvents: "none",
    },
    input: {
      width: "100%",
      padding: isMobile ? "0.6rem" : "0.75rem",
      paddingLeft: "40px",
      border: "1px solid #d1d5db",
      borderRadius: "0.5rem",
      outline: "none",
      fontSize: isMobile ? "0.9rem" : "1rem",
      transition:
        "border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out",
      boxSizing: "border-box",
    },
    inputFocus: {
      borderColor: "#10b981",
      boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.1)",
    },
    inputError: {
      borderColor: "#ef4444",
    },
    select: {
      width: "100%",
      padding: isMobile ? "0.6rem" : "0.75rem 1rem",
      border: "1px solid #d1d5db",
      borderRadius: "0.5rem",
      outline: "none",
      fontSize: isMobile ? "0.9rem" : "1rem",
      backgroundColor: "white",
      transition:
        "border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out",
      boxSizing: "border-box",
    },
    errorText: {
      color: "#ef4444",
      fontSize: isMobile ? "0.7rem" : "0.75rem",
      marginTop: "0.25rem",
    },
    searchResults: {
      marginTop: "16px",
      maxHeight: "240px",
      overflowY: "auto",
      border: "1px solid #e5e7eb",
      borderRadius: "6px",
      backgroundColor: "white",
    },
    searchResultItem: {
      padding: "12px 16px",
      borderBottom: "1px solid #f3f4f6",
      cursor: "pointer",
      transition: "background-color 0.15s ease-in-out",
    },
    searchResultItemHover: {
      backgroundColor: "#f9fafb",
    },
    selectedStudent: {
      marginTop: "16px",
      backgroundColor: "#EEF2FF",
      border: "1px solid #c7d2fe",
      borderRadius: "6px",
      padding: "16px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    uploadArea: {
      border: "2px dashed #d1d5db",
      borderRadius: "0.5rem",
      padding: isMobile ? "1.5rem 1rem" : "2rem",
      textAlign: "center",
      transition: "background-color 0.15s ease-in-out",
      cursor: "pointer",
    },
    uploadAreaHover: {
      backgroundColor: "#f9fafb",
    },
    uploadAreaError: {
      borderColor: "#fca5a5",
      backgroundColor: "#fef2f2",
    },
    hiddenInput: {
      display: "none",
    },
    uploadIcon: {
      margin: "0 auto 1rem",
      height: isMobile ? "2rem" : "3rem",
      width: isMobile ? "2rem" : "3rem",
      color: "#9ca3af",
    },
    uploadText: {
      fontSize: isMobile ? "1rem" : "1.125rem",
      fontWeight: "500",
      color: "#374151",
      marginBottom: "0.5rem",
      wordBreak: "break-word",
    },
    uploadSubtext: {
      fontSize: isMobile ? "0.8rem" : "0.875rem",
      color: "#6b7280",
    },
    uploadButton: {
      display: "inline-flex",
      alignItems: "center",
      padding: isMobile ? "0.4rem 0.8rem" : "0.5rem 1rem",
      border: "1px solid #d1d5db",
      borderRadius: "0.5rem",
      fontSize: isMobile ? "0.8rem" : "0.875rem",
      fontWeight: "500",
      color: "#374151",
      backgroundColor: "white",
      marginTop: "1rem",
      transition: "background-color 0.15s ease-in-out",
    },
    buttonContainer: {
      display: "flex",
      justifyContent: isMobile ? "center" : "flex-end",
      flexDirection: isMobile ? "column" : "row",
      gap: isMobile ? "0.75rem" : "1rem",
      paddingTop: "1.5rem",
      borderTop: "1px solid #e5e7eb",
    },
    cancelButton: {
      padding: isMobile ? "0.75rem" : "0.75rem 1.5rem",
      color: "#374151",
      backgroundColor: "white",
      border: "1px solid #d1d5db",
      borderRadius: "0.5rem",
      fontWeight: "500",
      cursor: "pointer",
      transition: "background-color 0.15s ease-in-out",
      fontSize: isMobile ? "0.9rem" : "1rem",
      width: isMobile ? "100%" : "auto",
    },
    cancelButtonHover: {
      backgroundColor: "#f9fafb",
    },
    submitButton: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: isMobile ? "0.75rem" : "0.75rem 2rem",
      backgroundColor: "#15803d",
      color: "white",
      borderRadius: "0.5rem",
      fontWeight: "500",
      cursor: "pointer",
      border: "none",
      transition: "background-color 0.15s ease-in-out",
      fontSize: isMobile ? "0.9rem" : "1rem",
      width: isMobile ? "100%" : "auto",
    },
    submitButtonHover: {
      backgroundColor: "#166534",
    },
    submitButtonDisabled: {
      opacity: "0.5",
      cursor: "not-allowed",
    },
    spinner: {
      animation: "spin 1s linear infinite",
      borderRadius: "50%",
      height: "1rem",
      width: "1rem",
      border: "2px solid transparent",
      borderTop: "2px solid white",
      marginRight: "0.5rem",
    },
    iconInline: {
      display: "inline",
      width: isMobile ? "0.9rem" : "1rem",
      height: isMobile ? "0.9rem" : "1rem",
      marginRight: "0.5rem",
      verticalAlign: "middle",
    },
    buttonIcon: {
      width: isMobile ? "0.9rem" : "1rem",
      height: isMobile ? "0.9rem" : "1rem",
      marginRight: "0.5rem",
    },
    alert: {
      marginBottom: "24px",
      padding: "16px",
      borderRadius: "8px",
      borderLeftWidth: "4px",
      borderLeftStyle: "solid",
      display: "flex",
      alignItems: "center",
    },
    alertError: {
      backgroundColor: "#FEE2E2",
      borderLeftColor: "#ef4444",
      color: "#991B1B",
    },
    alertSuccess: {
      backgroundColor: "#D1FAE5",
      borderLeftColor: "#22c55e",
      color: "#065F46",
    },
    alertIcon: {
      flexShrink: 0,
      marginRight: "12px",
    },
    closeButton: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#4f46e5",
      padding: "4px",
    },
    loadingText: {
      marginLeft: "12px",
      color: "#6b7280",
    },
  };

  const getInputStyle = (fieldName) => ({
    ...styles.input,
    ...(errors[fieldName] ? styles.inputError : {}),
  });

  const getSelectStyle = (fieldName) => ({
    ...styles.select,
    ...(errors[fieldName] ? styles.inputError : {}),
  });

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.headerTitle}>Upload Payment</h1>
            <p style={styles.headerSubtitle}>
              Enter payment details and upload receipt
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        <div style={styles.contentWrapper}>
          {/* Alerts */}
          {error && (
            <div style={{ ...styles.alert, ...styles.alertError }}>
              <div style={styles.alertIcon}>
                <X size={16} />
              </div>
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div style={{ ...styles.alert, ...styles.alertSuccess }}>
              <div style={styles.alertIcon}>
                <FileText size={16} />
              </div>
              <p>{success}</p>
            </div>
          )}

          {/* Stats Cards */}
          <div style={styles.statsGrid}>
            <div style={styles.statsCard}>
              <div style={styles.statsNumber}>0</div>
              <div style={styles.statsLabel}>Pending Uploads</div>
            </div>
            <div style={styles.statsCard}>
              <div style={styles.statsNumberGreen}>₱0</div>
              <div style={styles.statsLabel}>Total Amount</div>
            </div>
            <div style={styles.statsCard}>
              <div style={styles.statsNumber}>0</div>
              <div style={styles.statsLabel}>Today's Uploads</div>
            </div>
            <div style={styles.statsCard}>
              <div style={styles.statsNumber}>0</div>
              <div style={styles.statsLabel}>Processing</div>
            </div>
          </div>

          {/* Upload Form */}
          <div style={styles.formContainer}>
            {/* Form Header */}
            <div style={styles.formHeader}>
              <h2 style={styles.formHeaderTitle}>Payment Upload Form</h2>
              <p style={styles.formHeaderSubtitle}>
                Complete all fields to submit payment details
              </p>
            </div>

            <div style={styles.formContent}>
              <form onSubmit={handleSubmit}>
                {/* Student Search Section */}
                <div style={styles.formSection}>
                  <label style={styles.label}>
                    <User style={styles.iconInline} />
                    Search Student<span style={styles.required}>*</span>
                  </label>
                  <div style={styles.inputGroup}>
                    <div style={styles.inputIcon}>
                      <Search size={16} />
                    </div>
                    <input
                      type="text"
                      style={getInputStyle("student")}
                      placeholder="Enter student name or ID..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                      disabled={loading}
                      onFocus={(e) => {
                        e.target.style.borderColor = "#10b981";
                        e.target.style.boxShadow =
                          "0 0 0 3px rgba(16, 185, 129, 0.1)";
                        if (selectedStudent && searchTerm.includes("(")) {
                          setSelectedStudent(null);
                          setSearchTerm("");
                          setStudentAccounts([]);
                          setFormData((prev) => ({
                            ...prev,
                            student_id: "",
                            account_id: currentStudentId || "",
                          }));
                        }
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#d1d5db";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                  </div>
                  {errors.student && (
                    <p style={styles.errorText}>{errors.student}</p>
                  )}

                  {searchLoading && (
                    <div style={{ textAlign: "center", padding: "16px" }}>
                      <div
                        style={{ display: "inline-flex", alignItems: "center" }}
                      >
                        <div style={styles.spinner}></div>
                        <span style={styles.loadingText}>
                          Searching students...
                        </span>
                      </div>
                    </div>
                  )}

                  {searchResults.length > 0 && !selectedStudent && (
                    <div style={styles.searchResults}>
                      {searchResults.map((student) => (
                        <div
                          key={student.student_id}
                          style={styles.searchResultItem}
                          onClick={() => handleStudentSelect(student)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f9fafb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <p
                                style={{
                                  fontWeight: "500",
                                  color: "#1f2937",
                                  margin: 0,
                                }}
                              >
                                {student.first_name} {student.last_name}
                              </p>
                              <p
                                style={{
                                  fontSize: "14px",
                                  color: "#6b7280",
                                  margin: 0,
                                }}
                              >
                                ID: {student.student_id}
                              </p>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <p
                                style={{
                                  fontSize: "12px",
                                  color: "#6b7280",
                                  margin: 0,
                                }}
                              >
                                Status: {student.graduation_status || "N/A"}
                              </p>
                              <p
                                style={{
                                  fontSize: "12px",
                                  color: "#6b7280",
                                  margin: 0,
                                }}
                              >
                                Level:{" "}
                                {student.current_trading_level ||
                                  "Not assigned"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedStudent && (
                    <div style={styles.selectedStudent}>
                      <div>
                        <p
                          style={{
                            fontWeight: "500",
                            color: "#4338CA",
                            margin: 0,
                          }}
                        >
                          {selectedStudent.first_name}{" "}
                          {selectedStudent.last_name}
                        </p>
                        <p
                          style={{
                            fontSize: "14px",
                            color: "#6366F1",
                            margin: 0,
                          }}
                        >
                          ID: {selectedStudent.student_id}
                        </p>
                      </div>
                      <button
                        type="button"
                        style={styles.closeButton}
                        onClick={() => {
                          setSelectedStudent(null);
                          setSearchTerm("");
                          setStudentAccounts([]);
                          setFormData((prev) => ({
                            ...prev,
                            student_id: "",
                            account_id: currentStudentId || "",
                          }));
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#3730a3";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "#4f46e5";
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Student Account Selection */}
                {selectedStudent && studentAccounts.length > 0 && (
                  <div style={styles.formSection}>
                    <label style={styles.label}>
                      <FileText style={styles.iconInline} />
                      Student Account<span style={styles.required}>*</span>
                    </label>
                    <select
                      name="account_id"
                      style={getSelectStyle("account_id")}
                      value={formData.account_id}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    >
                      <option value="">Select Account</option>
                      {studentAccounts.map((account) => (
                        <option
                          key={account.account_id}
                          value={account.account_id}
                        >
                          {account.course_name} - {account.batch_identifier}{" "}
                          {/* (Balance: ₱{account.balance?.toFixed(2) || "0.00"}) */}
                        </option>
                      ))}
                    </select>
                    {errors.account_id && (
                      <p style={styles.errorText}>{errors.account_id}</p>
                    )}
                  </div>
                )}

                {/* Payment Details */}
                <div style={{ ...styles.formSection, ...styles.gridRow3 }}>
                  {/* Payment Method */}
                  <div>
                    <label style={styles.label}>
                      <CreditCard style={styles.iconInline} />
                      Payment Method<span style={styles.required}>*</span>
                    </label>
                    <select
                      name="method_id"
                      style={getSelectStyle("method_id")}
                      value={formData.method_id}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    >
                      <option value="">Select payment method</option>
                      {paymentMethods.map((method) => (
                        <option key={method.method_id} value={method.method_id}>
                          {method.method_name}
                        </option>
                      ))}
                    </select>
                    {errors.method_id && (
                      <p style={styles.errorText}>{errors.method_id}</p>
                    )}
                  </div>

                  {/* Payment Amount */}
                  <div>
                    <label style={styles.label}>
                      <DollarSign style={styles.iconInline} />
                      Amount<span style={styles.required}>*</span>
                    </label>
                    <input
                      type="number"
                      name="payment_amount"
                      value={formData.payment_amount}
                      onChange={handleChange}
                      style={getInputStyle("payment_amount")}
                      placeholder="₱ 0.00"
                      min="0.01"
                      step="0.01"
                      disabled={loading}
                      required
                    />
                    {errors.payment_amount && (
                      <p style={styles.errorText}>{errors.payment_amount}</p>
                    )}
                  </div>

                  {/* Reference Number */}
                  <div>
                    <label style={styles.label}>
                      <FileText style={styles.iconInline} />
                      Reference Number
                    </label>
                    <input
                      type="text"
                      name="reference_number"
                      value={formData.reference_number}
                      onChange={handleChange}
                      style={styles.input}
                      placeholder="Optional reference number"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div style={styles.formSection}>
                  <label style={styles.label}>
                    <FileText style={styles.iconInline} />
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    style={{
                      ...styles.input,
                      minHeight: "80px",
                      resize: "vertical",
                      paddingLeft: "12px",
                    }}
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Optional payment notes..."
                    disabled={loading}
                  />
                </div>

                {/* Payment Receipt Upload */}
                <div style={styles.formSection}>
                  <label style={styles.label}>
                    <Upload style={styles.iconInline} />
                    Upload Payment Receipt<span style={styles.required}>*</span>
                  </label>
                  <div
                    style={{
                      ...styles.uploadArea,
                      ...(errors.file ? styles.uploadAreaError : {}),
                    }}
                  >
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept="image/*,.pdf"
                      style={styles.hiddenInput}
                      id="receipt-upload"
                      disabled={loading}
                      required
                    />

                    <label
                      htmlFor="receipt-upload"
                      style={{
                        cursor: loading ? "not-allowed" : "pointer",
                        display: "block",
                      }}
                    >
                      <Upload style={styles.uploadIcon} />
                      <div style={styles.uploadText}>
                        {selectedFile
                          ? selectedFile.name
                          : "Click to upload receipt"}
                      </div>
                      <p style={styles.uploadSubtext}>
                        PDF, PNG, JPG up to 10MB
                      </p>
                      {!selectedFile && (
                        <div>
                          <span style={styles.uploadButton}>Choose File</span>
                        </div>
                      )}
                    </label>
                  </div>
                  {errors.file && <p style={styles.errorText}>{errors.file}</p>}
                </div>

                {/* Submit Buttons */}
                <div style={styles.buttonContainer}>
                  {onCancel && (
                    <button
                      type="button"
                      onClick={onCancel}
                      style={styles.cancelButton}
                      disabled={loading}
                      onMouseOver={(e) =>
                        !loading &&
                        (e.target.style.backgroundColor =
                          styles.cancelButtonHover.backgroundColor)
                      }
                      onMouseOut={(e) =>
                        !loading && (e.target.style.backgroundColor = "white")
                      }
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      ...styles.submitButton,
                      ...(loading ? styles.submitButtonDisabled : {}),
                    }}
                    onMouseOver={(e) =>
                      !loading &&
                      (e.target.style.backgroundColor =
                        styles.submitButtonHover.backgroundColor)
                    }
                    onMouseOut={(e) =>
                      !loading && (e.target.style.backgroundColor = "#15803d")
                    }
                  >
                    {loading ? (
                      <>
                        <div style={styles.spinner}></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload style={styles.buttonIcon} />
                        Submit Payment
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
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

export default UploadPayments;
