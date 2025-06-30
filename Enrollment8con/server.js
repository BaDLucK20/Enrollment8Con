import express from "express";
import mysql from "mysql2/promise";
import multer from "multer";
import path from "path";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(64).toString("hex");
const dashboardCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================
app.use(cors({
    origin: ['http://localhost:5173','https://atecon.netlify.app','http://localhost:5174','https://8con.netlify.app', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
});

app.use(limiter);

// Core middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Database connection pool
const pool = mysql.createPool({
 host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '', 
  database: process.env.DB_NAME || '8cons',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0
});


// Core middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));


// ============================================================================
// ENHANCED DASHBOARD PROCEDURES
// ============================================================================
async function createDashboardProcedures() {
  const connection = await pool.getConnection();

  try {
    // Create comprehensive dashboard data procedure
    await connection.query(`
      CREATE PROCEDURE IF NOT EXISTS sp_get_dashboard_kpi_data()
      BEGIN
        -- KPI Metrics
        SELECT 
          (SELECT COUNT(*) FROM students WHERE graduation_status != 'expelled') as total_enrollees,
          (SELECT SUM(payment_amount) FROM payments WHERE payment_status = 'confirmed') as total_revenue,
          (SELECT COUNT(*) FROM students WHERE graduation_status = 'graduated') as total_graduates,
          (SELECT SUM(payment_amount) FROM payments WHERE payment_status = 'pending') as pending_receivables;
        
        -- Revenue Analysis (Monthly)
        SELECT 
          MONTHNAME(p.payment_date) as month,
          SUM(CASE WHEN p.payment_status = 'confirmed' THEN p.payment_amount ELSE 0 END) as payment_received,
          SUM(CASE WHEN p.payment_status = 'pending' THEN p.payment_amount ELSE 0 END) as accounts_receivable
        FROM payments p
        WHERE p.payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY YEAR(p.payment_date), MONTH(p.payment_date), MONTHNAME(p.payment_date)
        ORDER BY YEAR(p.payment_date), MONTH(p.payment_date);
        
        -- Status Distribution
        SELECT 
          CASE 
            WHEN tl.level_name = 'Beginner' THEN 'Basic'
            WHEN tl.level_name = 'Intermediate' THEN 'Common' 
            WHEN tl.level_name = 'Advanced' THEN 'Core'
            ELSE 'Basic'
          END as name,
          COUNT(*) as value
        FROM students s
        LEFT JOIN student_trading_levels stl ON s.student_id = stl.student_id AND stl.is_current = TRUE
        LEFT JOIN trading_levels tl ON stl.level_id = tl.level_id
        WHERE s.graduation_status != 'expelled'
        GROUP BY CASE 
          WHEN tl.level_name = 'Beginner' THEN 'Basic'
          WHEN tl.level_name = 'Intermediate' THEN 'Common' 
          WHEN tl.level_name = 'Advanced' THEN 'Core'
          ELSE 'Basic'
        END;
        
        -- Monthly Enrollment Trend
        SELECT 
          MONTHNAME(s.registration_date) as month,
          COUNT(*) as enrollees
        FROM students s
        WHERE s.registration_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY YEAR(s.registration_date), MONTH(s.registration_date), MONTHNAME(s.registration_date)
        ORDER BY YEAR(s.registration_date), MONTH(s.registration_date);
        
        -- Batch Performance Data
        SELECT 
          co.batch_identifier as batch,
          COUNT(DISTINCT se.student_id) as enrollees,
          COUNT(DISTINCT CASE WHEN s.graduation_status = 'graduated' THEN s.student_id END) as graduates,
          COUNT(DISTINCT CASE WHEN tl.level_name = 'Beginner' THEN s.student_id END) as basic,
          COUNT(DISTINCT CASE WHEN tl.level_name = 'Intermediate' THEN s.student_id END) as common,
          COUNT(DISTINCT CASE WHEN tl.level_name = 'Advanced' THEN s.student_id END) as core
        FROM course_offerings co
        LEFT JOIN student_enrollments se ON co.offering_id = se.offering_id
        LEFT JOIN students s ON se.student_id = s.student_id
        LEFT JOIN student_trading_levels stl ON s.student_id = stl.student_id AND stl.is_current = TRUE
        LEFT JOIN trading_levels tl ON stl.level_id = tl.level_id
        WHERE co.start_date >= DATE_SUB(CURDATE(), INTERVAL 2 YEAR)
        GROUP BY co.offering_id, co.batch_identifier
        ORDER BY co.start_date DESC;
      END
    `);

    console.log("✅ Dashboard KPI procedures created successfully");
  } catch (error) {
    console.error("❌ Failed to create dashboard procedures:", error);
    throw error;
  } finally {
    connection.release();
  }
}

// ============================================================================
// DATABASE INITIALIZATION - SYNC IDs AND CREATE PROCEDURES
// ============================================================================

async function initializeDatabase() {
  const connection = await pool.getConnection();

  try {
    console.log("🔄 Initializing database with ID synchronization...");

    // Check if stored procedure exists, if not create it
    const [procedures] = await connection.execute(`
      SELECT ROUTINE_NAME 
      FROM information_schema.ROUTINES 
      WHERE ROUTINE_SCHEMA = DATABASE() 
      AND ROUTINE_NAME = 'sp_register_user_with_synced_ids'
    `);

    if (procedures.length === 0) {
      console.log("📝 Creating stored procedure for synced registration...");

      await connection.query(`
        CREATE PROCEDURE sp_register_user_with_synced_ids(
          IN p_password_hash VARCHAR(255),
          IN p_first_name VARCHAR(50),
          IN p_middle_name VARCHAR(50),
          IN p_last_name VARCHAR(50),
          IN p_birth_date DATE,
          IN p_birth_place VARCHAR(100),
          IN p_gender ENUM('Male','Female','Other'),
          IN p_email VARCHAR(100),
          IN p_education VARCHAR(100),
          IN p_phone_no VARCHAR(15),
          IN p_address TEXT,
          IN p_role_name VARCHAR(50),
          OUT p_account_id INT,
          OUT p_result VARCHAR(100)
        )
        BEGIN
          DECLARE v_role_id INT;
          DECLARE v_student_id VARCHAR(20);
          DECLARE EXIT HANDLER FOR SQLEXCEPTION
          BEGIN
            ROLLBACK;
            SET p_result = 'ERROR: Registration failed';
            SET p_account_id = NULL;
          END;

          START TRANSACTION;

          -- Create account first
          INSERT INTO accounts (password_hash, token, account_status)
          VALUES ( p_password_hash, '', 'active');
          
          SET p_account_id = LAST_INSERT_ID();

          -- Create person with matching ID
          INSERT INTO persons (person_id, first_name, middle_name, last_name, birth_date, birth_place, gender, email, education)
          VALUES (p_account_id, p_first_name, p_middle_name, p_last_name, p_birth_date, p_birth_place, p_gender, p_email, p_education);

          -- Get role_id
          SELECT role_id INTO v_role_id FROM roles WHERE role_name = p_role_name;
          
          IF v_role_id IS NULL THEN
            SET p_result = 'ERROR: Invalid role specified';
            ROLLBACK;
          ELSE
            -- Assign role
            INSERT INTO account_roles (account_id, role_id) VALUES (p_account_id, v_role_id);
            
            -- If student role, create student record
            IF p_role_name = 'student' THEN
              SET v_student_id = CONCAT('S', UNIX_TIMESTAMP(NOW()) * 1000, '_', p_account_id);
              
              INSERT INTO students (student_id, person_id, account_id)
              VALUES (v_student_id, p_account_id, p_account_id);
              
              -- Add contact information
              IF p_phone_no IS NOT NULL THEN
                INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary)
                VALUES (p_account_id, v_student_id, 'phone', p_phone_no, 1);
              END IF;
              
              IF p_address IS NOT NULL THEN
                INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary)
                VALUES (p_account_id, v_student_id, 'address', p_address, 1);
              END IF;
              
              INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary)
              VALUES (p_account_id, v_student_id, 'email', p_email, 1);
              
              -- Set default trading level (Beginner = level_id 1)
              INSERT INTO student_trading_levels (student_id, level_id, is_current)
              VALUES (v_student_id, 1, 1);
              
              -- Set default learning preferences
              INSERT INTO learning_preferences (student_id, delivery_preference)
              VALUES (v_student_id, 'hybrid');
            END IF;
            
            -- If staff role, create staff record
            IF p_role_name = 'staff' THEN
              INSERT INTO staff (person_id, account_id, employee_id, hire_date, employment_status)
              VALUES (p_account_id, p_account_id, CONCAT('EMP', UNIX_TIMESTAMP(NOW()) * 1000), CURDATE(), 'active');
            END IF;
            
            SET p_result = 'SUCCESS: User registered successfully';
            COMMIT;
          END IF;
        END
      `);

      console.log("✅ Stored procedure created successfully");
    }

    // Sync existing data if needed
    const [mismatchedRecords] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM accounts a
      LEFT JOIN students s ON a.account_id = s.account_id
      LEFT JOIN persons p ON s.person_id = p.person_id
      WHERE a.account_id != p.person_id AND p.person_id IS NOT NULL
    `);

    if (mismatchedRecords[0].count > 0) {
      console.log(
        `🔧 Found ${mismatchedRecords[0].count} mismatched records. Synchronizing...`
      );

      // Temporarily disable foreign key checks
      await connection.execute("SET FOREIGN_KEY_CHECKS = 0");

      // Update person_id to match account_id
      await connection.execute(`
        UPDATE persons p
        JOIN students s ON p.person_id = s.person_id
        JOIN accounts a ON s.account_id = a.account_id
        SET p.person_id = a.account_id
      `);

      // Update students table
      await connection.execute(`
        UPDATE students s
        JOIN accounts a ON s.account_id = a.account_id
        SET s.person_id = a.account_id
      `);

      // Update contact_info table
      await connection.execute(`
        UPDATE contact_info ci
        JOIN students s ON ci.student_id = s.student_id
        JOIN accounts a ON s.account_id = a.account_id
        SET ci.person_id = a.account_id
      `);

      // Update staff table
      await connection.execute(`
        UPDATE staff st
        JOIN accounts a ON st.account_id = a.account_id
        SET st.person_id = a.account_id
      `);

      // Re-enable foreign key checks
      await connection.execute("SET FOREIGN_KEY_CHECKS = 1");

      console.log("✅ ID synchronization completed");
    }
    await createDashboardProcedures();
  } catch (error) {
    console.error("❌ Database initialization error:", error);
    throw error;
  } finally {
    connection.release();
  }
}

// Create email transporter
const createEmailTransporter = () => {
  // You can use different email services. Here are examples:

  // For Gmail:
  if (process.env.EMAIL_SERVICE === "gmail") {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD, // Use app-specific password for Gmail
      },
    });
  }

  // For Outlook/Hotmail:
  if (process.env.EMAIL_SERVICE === "outlook") {
    return nodemailer.createTransport({
      service: "hotmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // For custom SMTP:
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

let emailTransporter = null;

// Initialize email transporter
const initializeEmailService = async () => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn(
        "⚠️  Email service not configured. Please set EMAIL_USER and EMAIL_PASSWORD in .env file"
      );
      return false;
    }

    emailTransporter = createEmailTransporter();

    // Verify connection
    await emailTransporter.verify();
    console.log("✅ Email service connected successfully");
    return true;
  } catch (error) {
    console.error("❌ Email service connection failed:", error.message);
    console.warn("⚠️  Email functionality will be disabled");
    return false;
  }
};

// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/documents";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, file.fieldname + "-" + uniqueSuffix + "-" + sanitizedFilename);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only images and documents are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ============================================================================
// MIDDLEWARE UTILITIES
// ============================================================================

const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array(),
    });
  }
  next();
};

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const [userRows] = await pool.execute(
      `
      SELECT a.account_id, a.account_status, ar.role_id, r.role_name, r.permissions,
             p.first_name, p.last_name, 
             COALESCE(s.student_id, st.staff_id) as user_id,
             a.account_id as person_id
      FROM accounts a
      JOIN account_roles ar ON a.account_id = ar.account_id
      JOIN roles r ON ar.role_id = r.role_id
      LEFT JOIN staff st ON a.account_id = st.account_id
      LEFT JOIN students s ON a.account_id = s.account_id
      LEFT JOIN persons p ON a.account_id = p.person_id
      WHERE a.account_id = ? AND a.account_status = 'active' AND ar.is_active = TRUE
    `,
      [decoded.accountId]
    );

    if (userRows.length === 0) {
      return res
        .status(401)
        .json({ error: "Invalid token or inactive account" });
    }

    req.user = {
      accountId: userRows[0].account_id,
      role: userRows[0].role_name,
      permissions: userRows[0].permissions,
      firstName: userRows[0].first_name,
      lastName: userRows[0].last_name,
      personId: userRows[0].person_id,
      userId: userRows[0].user_id,
    };

    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (allowedRoles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ error: "Insufficient permissions" });
    }
  };
};

const authorizeStudentAccess = async (req, res, next) => {
  if (req.user.role === "admin") {
    return next();
  }

  if (req.user.role === "student") {
    const studentId = req.params.studentId || req.body.student_id;

    if (!studentId) {
      return res.status(400).json({ error: "Student ID required" });
    }

    try {
      const [studentRows] = await pool.execute(
        `
        SELECT s.student_id 
        FROM students s 
        WHERE s.student_id = ? AND s.account_id = ?
      `,
        [studentId, req.user.accountId]
      );

      if (studentRows.length === 0) {
        return res
          .status(403)
          .json({ error: "Access denied to this student record" });
      }
    } catch (error) {
      console.error("Student access control error:", error);
      return res.status(500).json({ error: "Authorization check failed" });
    }
  }

  next();
};

// ============================================================================
// AUTHENTICATION ROUTES (Updated to use synced IDs)
// ============================================================================
// Email sending endpoint
app.post(
  "/api/send-email",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("to").isEmail().normalizeEmail(),
    body("subject").trim().isLength({ min: 1, max: 200 }),
    body("html").trim().isLength({ min: 1 }),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { to, subject, html, text } = req.body;

      // Check if email service is configured
      if (!emailTransporter) {
        console.error("Email service not configured");
        return res.status(503).json({
          error:
            "Email service is not configured. Please contact administrator.",
        });
      }

      // Prepare email options
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || "Trading Academy"}" <${
          process.env.EMAIL_USER
        }>`,
        to: to,
        subject: subject,
        html: html,
        text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML tags for text version
      };

      console.log("📧 Sending email to:", to);
      console.log("📧 Subject:", subject);

      // Send email
      const info = await emailTransporter.sendMail(mailOptions);

      console.log("✅ Email sent successfully:", info.messageId);

      // Log email activity
      await pool.execute(
        `
      INSERT INTO activity_logs (account_id, action, description, created_at)
      VALUES (?, 'email_sent', ?, CURRENT_TIMESTAMP)
    `,
        [req.user.accountId, `Email sent to ${to} - Subject: ${subject}`]
      );

      res.json({
        success: true,
        message: "Email sent successfully",
        messageId: info.messageId,
      });
    } catch (error) {
      console.error("❌ Email sending error:", error);

      // Log failed attempt
      try {
        await pool.execute(
          `
        INSERT INTO activity_logs (account_id, action, description, created_at)
        VALUES (?, 'email_failed', ?, CURRENT_TIMESTAMP)
      `,
          [
            req.user.accountId,
            `Failed to send email to ${req.body.to} - Error: ${error.message}`,
          ]
        );
      } catch (logError) {
        console.error("Failed to log email error:", logError);
      }

      res.status(500).json({
        error: "Failed to send email",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Test email endpoint (for admin only)
app.post(
  "/api/test-email",
  [authenticateToken, authorize(["admin"])],
  async (req, res) => {
    try {
      if (!emailTransporter) {
        return res.status(503).json({
          error: "Email service is not configured",
        });
      }

      const testEmail = req.user.email || process.env.EMAIL_USER;

      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || "Trading Academy"}" <${
          process.env.EMAIL_USER
        }>`,
        to: testEmail,
        subject: "Test Email - Trading Academy",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2d4a3d;">Test Email Successful!</h2>
          <p>This is a test email from your Trading Academy system.</p>
          <p>If you're receiving this, your email configuration is working correctly.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Sent on: ${new Date().toLocaleString()}<br>
            Environment: ${process.env.NODE_ENV || "development"}
          </p>
        </div>
      `,
      };

      await emailTransporter.sendMail(mailOptions);

      res.json({
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
      });
    } catch (error) {
      console.error("Test email error:", error);
      res.status(500).json({
        error: "Failed to send test email",
        details: error.message,
      });
    }
  }
);

app.post(
  "/api/auth",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Admin auto-setup and login
      if (email === "admin@gmail.com" && password === "admin123") {
        const [existingAdmin] = await pool.execute(
          "SELECT a.account_id FROM accounts a LEFT JOIN persons p ON a.account_id = p.person_id WHERE p.email = ?",
          ["admin@gmail.com"]
        );

        let adminId;

        if (existingAdmin.length === 0) {
          const hash = await bcrypt.hash("admin123", 10);
          const [insertResult] = await pool.execute(
            `INSERT INTO accounts (password_hash, token, account_status)
           VALUES ( ?, '', 'active')`,
            ["admin", hash]
          );
          adminId = insertResult.insertId;

          // Create person record with matching ID
          // await pool.execute(
          //   `INSERT INTO persons (person_id, first_name, last_name, email, birth_place, gender, education)
          //    VALUES (?, 'System', 'Administrator', 'admin@gmail.com', 'System', 'Other', 'System Administrator')`,
          //   [adminId]
          // );

          await pool.execute(
            `INSERT INTO account_roles (account_id, role_id, is_active)
           VALUES (?, ?, TRUE)`,
            [adminId, 1]
          );
        } else {
          adminId = existingAdmin[0].account_id;
        }

        const [[existingTokenRow]] = await pool.execute(
          `SELECT token FROM accounts WHERE account_id = ?`,
          [adminId]
        );

        let token = existingTokenRow.token;
        let shouldUpdate = true;

        if (token) {
          try {
            jwt.verify(token, JWT_SECRET);
            shouldUpdate = false;
          } catch (err) {
            shouldUpdate = true;
          }
        }

        if (shouldUpdate) {
          token = jwt.sign(
            {
              accountId: adminId,
              role: "admin",
            },
            JWT_SECRET,
            { expiresIn: "8h" }
          );

          await pool.execute(
            `UPDATE accounts SET token = ? WHERE account_id = ?`,
            [token, adminId]
          );
        }

        return res.json({
          token,
          user: {
            accountId: adminId,
            role: "admin",
            firstName: "System",
            lastName: "Administrator",
            permissions: "all",
            profile: {},
          },
        });
      }

      const [userRows] = await pool.execute(
        `
      SELECT 
        a.account_id, a.password_hash, a.account_status, 
        a.failed_login_attempts, a.locked_until,
        ar.role_id, r.role_name, r.permissions,
        p.first_name, p.last_name
      FROM accounts a
      JOIN account_roles ar ON a.account_id = ar.account_id
      JOIN roles r ON ar.role_id = r.role_id
      LEFT JOIN persons p ON a.account_id = p.person_id
      WHERE p.email = ? AND ar.is_active = TRUE
    `,
        [email]
      );

      if (userRows.length === 0) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = userRows[0];

      if (user.locked_until && new Date() < new Date(user.locked_until)) {
        return res.status(423).json({ error: "Account is temporarily locked" });
      }

      if (user.account_status !== "active") {
        return res.status(401).json({ error: "Account is not active" });
      }

      const isValidPassword = await bcrypt.compare(
        password,
        user.password_hash
      );
      if (!isValidPassword) {
        await pool.execute(
          `
        UPDATE accounts 
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE 
              WHEN failed_login_attempts >= 4 THEN DATE_ADD(NOW(), INTERVAL 15 MINUTE)
              ELSE NULL 
            END
        WHERE account_id = ?`,
          [user.account_id]
        );
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Reset login attempts
      await pool.execute(
        `
      UPDATE accounts 
      SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW()
      WHERE account_id = ?`,
        [user.account_id]
      );

      // Get or generate token
      const [[existingTokenRow]] = await pool.execute(
        `SELECT token FROM accounts WHERE account_id = ?`,
        [user.account_id]
      );

      let token = existingTokenRow.token;
      let shouldUpdate = true;

      if (token) {
        try {
          jwt.verify(token, JWT_SECRET);
          shouldUpdate = false;
        } catch (err) {
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        token = jwt.sign(
          {
            accountId: user.account_id,
            role: user.role_name,
          },
          JWT_SECRET,
          { expiresIn: "24h" }
        );

        await pool.execute(
          `UPDATE accounts SET token = ? WHERE account_id = ?`,
          [token, user.account_id]
        );
      }

      let profileData = {};
      if (user.role_name === "student") {
        const [studentData] = await pool.execute(
          `
        SELECT student_id, graduation_status, academic_standing
        FROM students WHERE account_id = ?`,
          [user.account_id]
        );
        profileData = studentData[0] || {};
      } else if (user.role_name === "staff" || user.role_name === "admin") {
        const [staffData] = await pool.execute(
          `
        SELECT staff_id, employee_id, employment_status
        FROM staff WHERE account_id = ?`,
          [user.account_id]
        );
        profileData = staffData[0] || {};
      }

      return res.json({
        token,
        user: {
          accountId: user.account_id,
          role: user.role_name,
          firstName: user.first_name,
          lastName: user.last_name,
          permissions: user.permissions,
          profile: profileData,
        },
      });
    } catch (error) {
      console.error("Auth error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  }
);

// SIGNUP (Updated to use stored procedure)
app.post(
  "/api/auth/signup",
  [
    // Validation middleware
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("firstName")
      .trim()
      .isLength({ min: 1, max: 100 })
      .escape()
      .withMessage("First name is required"),
    body("lastName")
      .trim()
      .isLength({ min: 1, max: 100 })
      .escape()
      .withMessage("Last name is required"),
    body("role")
      .optional()
      .isIn(["student", "staff"])
      .withMessage("Role must be student or staff"),
    body("phoneNumber")
      .optional()
      .isMobilePhone()
      .withMessage("Valid phone number required"),
    body("dateOfBirth")
      .optional()
      .isISO8601()
      .withMessage("Date of birth must be YYYY-MM-DD"),
    body("birthPlace")
      .optional()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage("City of birth is required"),
    body("address").optional().trim().isLength({ min: 1, max: 500 }),
    body("city").optional().trim().isLength({ min: 1, max: 100 }),
    body("province").optional().trim().isLength({ min: 1, max: 100 }),
    body("gender").optional().isIn(["Male", "Female", "Other"]),
    body("education").optional().trim().isLength({ min: 1, max: 100 }),
    body("tradingLevel").optional().trim().isLength({ min: 1, max: 50 }),
    body("device").optional(),
    body("learningStyle").optional(),
    body("deliveryPreference").optional(),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      const {
        password,
        email,
        firstName,
        middleName = null,
        lastName,
        dateOfBirth = null,
        birthPlace = null,
        gender = null,
        education = null,
        phoneNumber = null,
        role = "student",
        address = null,
        city = null,
        province = null,
        tradingLevel = null,
        device = null,
        learningStyle = null,
        deliveryPreference = null,
      } = req.body;

      console.log("Signup request:", { email, firstName, lastName, role });

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Combine address components
      const fullAddress =
        address && city && province
          ? `${address}, ${city}, ${province}`
          : address || null;

      // Format device type (handle arrays)
      const deviceType = Array.isArray(device)
        ? device.join(",")
        : device || null;

      // Format learning style (handle arrays)
      const formattedLearningStyle = Array.isArray(learningStyle)
        ? learningStyle.join(",")
        : learningStyle || null;

      // Call the enhanced stored procedure
      const [registerResult] = await connection.execute(
        `
      CALL sp_register_user_complete(
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @account_id, @student_id, @result
      )
    `,
        [
          passwordHash,
          firstName,
          middleName,
          lastName,
          dateOfBirth,
          birthPlace,
          gender || "Other",
          email,
          education || "Not specified",
          phoneNumber,
          fullAddress,
          role,
          tradingLevel || "No Experience",
          deviceType,
          formattedLearningStyle,
          deliveryPreference || "hybrid",
        ]
      );

      // Get output parameters
      const [[output]] = await connection.execute(`
      SELECT @account_id AS account_id, @student_id AS student_id, @result AS result
    `);

      const { account_id, student_id, result: procedureResult } = output;

      if (!procedureResult || !procedureResult.startsWith("SUCCESS")) {
        return res.status(400).json({
          error: procedureResult || "Registration failed",
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          accountId: account_id,
          role: role,
          studentId: student_id,
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      // Update account with token
      await connection.execute(
        "UPDATE accounts SET token = ? WHERE account_id = ?",
        [token, account_id]
      );

      // Fetch complete user profile
      const [userProfile] = await connection.execute(
        `
      SELECT 
        p.person_id,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.birth_date,
        p.birth_place,
        p.gender,
        p.email,
        p.education,
        a.account_status,
        a.created_at,
        r.role_name,
        r.permissions
      FROM persons p
      JOIN accounts a ON p.person_id = a.account_id
      JOIN account_roles ar ON a.account_id = ar.account_id
      JOIN roles r ON ar.role_id = r.role_id
      WHERE a.account_id = ?
    `,
        [account_id]
      );

      let additionalData = {};

      if (role === "student" && student_id) {
        // Fetch student-specific data
        const [studentData] = await connection.execute(
          `
        SELECT 
          s.student_id,
          s.graduation_status,
          s.academic_standing,
          tl.level_name as trading_level,
          lp.learning_style,
          lp.delivery_preference,
          lp.device_type,
          sb.education_level,
          sb.highest_degree
        FROM students s
        LEFT JOIN student_trading_levels stl ON s.student_id = stl.student_id AND stl.is_current = 1
        LEFT JOIN trading_levels tl ON stl.level_id = tl.level_id
        LEFT JOIN learning_preferences lp ON s.student_id = lp.student_id
        LEFT JOIN student_backgrounds sb ON s.student_id = sb.student_id
        WHERE s.account_id = ?
      `,
          [account_id]
        );

        if (studentData.length > 0) {
          additionalData = {
            student_id: studentData[0].student_id,
            graduation_status: studentData[0].graduation_status,
            academic_standing: studentData[0].academic_standing,
            trading_level: studentData[0].trading_level,
            learning_preferences: {
              style: studentData[0].learning_style,
              delivery: studentData[0].delivery_preference,
              device: studentData[0].device_type,
            },
            background: {
              education_level: studentData[0].education_level,
              highest_degree: studentData[0].highest_degree,
            },
          };
        }
      } else if (role === "staff") {
        // Fetch staff-specific data
        const [staffData] = await connection.execute(
          `
        SELECT 
          staff_id,
          employee_id,
          hire_date,
          employment_status
        FROM staff
        WHERE account_id = ?
      `,
          [account_id]
        );

        if (staffData.length > 0) {
          additionalData = {
            staff_id: staffData[0].staff_id,
            employee_id: staffData[0].employee_id,
            hire_date: staffData[0].hire_date,
            employment_status: staffData[0].employment_status,
          };
        }
      }

      // Prepare response
      const responseData = {
        message: "Account created successfully",
        token,
        user: {
          accountId: account_id,
          personId: userProfile[0].person_id,
          firstName: userProfile[0].first_name,
          middleName: userProfile[0].middle_name,
          lastName: userProfile[0].last_name,
          email: userProfile[0].email,
          birthDate: userProfile[0].birth_date,
          birthPlace: userProfile[0].birth_place,
          gender: userProfile[0].gender,
          education: userProfile[0].education,
          role: userProfile[0].role_name,
          permissions: JSON.parse(userProfile[0].permissions || "{}"),
          accountStatus: userProfile[0].account_status,
          createdAt: userProfile[0].created_at,
          contactInfo: {
            phone: phoneNumber,
            address: fullAddress,
          },
          ...additionalData,
        },
      };

      res.status(201).json(responseData);
    } catch (error) {
      console.error("Signup error:", error);

      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          error: "Email already exists",
        });
      }

      res.status(500).json({
        error: "Account creation failed",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      connection.release();
    }
  }
);

app.post(
  "/api/auth/login",
  [body("token").notEmpty().isString()],
  validateInput,
  async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) return res.status(400).json({ error: "Token required" });

      console.log("🔐 Incoming token:", token);

      // 1. Verify JWT
      let payload;
      try {
        payload = jwt.verify(token, JWT_SECRET);
        console.log("✅ Decoded JWT payload:", payload);
      } catch (err) {
        console.error("❌ JWT verification failed:", err.message);
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      // 2. Find matching account in DB using account_id and stored token
      const [rows] = await pool.execute(
        `
      SELECT  
        a.account_id, a.account_status, a.last_login, a.failed_login_attempts, a.locked_until, a.created_at, a.updated_at,
        ar.role_id, 
        r.role_name, 
        r.permissions,
        p.person_id, p.first_name, p.middle_name, p.last_name, p.gender, p.birth_date, p.birth_place, p.email, p.education, p.created_at AS person_created_at, p.updated_at AS person_updated_at,
        st.staff_id, st.employee_id, st.employment_status, st.hire_date,
        s.student_id, s.graduation_status, s.academic_standing, s.registration_date
      FROM accounts a
      JOIN account_roles ar ON a.account_id = ar.account_id AND ar.is_active = TRUE
      JOIN roles r ON ar.role_id = r.role_id
      LEFT JOIN staff st ON a.account_id = st.account_id
      LEFT JOIN students s ON a.account_id = s.account_id
      LEFT JOIN persons p ON a.account_id = p.person_id
      WHERE a.account_id = ? AND a.token = ?
    `,
        [payload.accountId, token]
      );

      console.log("📦 Query result rows:", rows.length);

      if (rows.length === 0) {
        return res
          .status(401)
          .json({ error: "Invalid or expired token (not matched in DB)" });
      }

      const user = rows[0];

      // 3. Fetch contact info
      let contactInfo = [];
      if (user.person_id) {
        const [contactRows] = await pool.execute(
          `
        SELECT contact_type, contact_value, is_primary
        FROM contact_info
        WHERE person_id = ?
        ORDER BY is_primary DESC, contact_type
      `,
          [user.person_id]
        );
        contactInfo = contactRows;
      }

      // 4. Role-specific extra data
      let additionalData = {};
      if (user.role_name === "student" && user.student_id) {
        const [tradingLevels] = await pool.execute(
          `
        SELECT 
          tl.level_name,
          tl.level_description,
          stl.is_current,
          stl.assigned_date
        FROM student_trading_levels stl
        JOIN trading_levels tl ON stl.level_id = tl.level_id
        WHERE stl.student_id = ?
        ORDER BY stl.assigned_date DESC
      `,
          [user.student_id]
        );

        const [learningPrefs] = await pool.execute(
          `
        SELECT device_type, learning_style, created_at
        FROM learning_preferences
        WHERE student_id = ?
      `,
          [user.student_id]
        );

        additionalData = {
          trading_levels: tradingLevels,
          learning_preferences: learningPrefs,
          enrollments: [], // You can add enrollment logic here later
        };
      }

      // 5. Build response
      const responseUser = {
        account: {
          account_id: user.account_id,
          account_status: user.account_status,
          last_login: user.last_login,
          failed_login_attempts: user.failed_login_attempts,
          locked_until: user.locked_until,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
        role: {
          role_id: user.role_id,
          role_name: user.role_name,
          permissions: user.permissions,
        },
        person: {
          person_id: user.person_id,
          first_name: user.first_name,
          middle_name: user.middle_name,
          last_name: user.last_name,
          full_name: `${user.first_name} ${
            user.middle_name ? user.middle_name + " " : ""
          }${user.last_name}`.trim(),
          gender: user.gender,
          birth_date: user.birth_date,
          birth_place: user.birth_place,
          email: user.email,
          education: user.education,
          created_at: user.person_created_at,
          updated_at: user.person_updated_at,
        },
        contact_info: contactInfo,
        profile: {},
        additional_data: additionalData,
      };

      // 6. Set role-specific profile
      if (user.role_name === "student") {
        responseUser.profile = {
          student_id: user.student_id,
          graduation_status: user.graduation_status,
          academic_standing: user.academic_standing,
          registration_date: user.registration_date,
          current_trading_level:
            additionalData.trading_levels?.find((tl) => tl.is_current)
              ?.level_name || null,
          total_enrollments: additionalData.enrollments?.length || 0,
          active_enrollments:
            additionalData.enrollments?.filter((e) => e.status === "active")
              .length || 0,
          completed_courses:
            additionalData.enrollments?.filter((e) => e.status === "completed")
              .length || 0,
        };
      } else if (user.role_name === "staff" || user.role_name === "admin") {
        responseUser.profile = {
          staff_id: user.staff_id,
          employee_id: user.employee_id,
          employment_status: user.employment_status,
          hire_date: user.hire_date,
        };
      }

      // 7. Update last login time
      await pool.execute(
        `
      UPDATE accounts 
      SET last_login = NOW() 
      WHERE account_id = ?
    `,
        [user.account_id]
      );

      console.log("✅ Login successful for account:", user.account_id);

      // 8. Send response
      return res.status(200).json({
        success: true,
        token,
        user: responseUser,
      });
    } catch (err) {
      console.error("❌ Login token validation error:", err);
      return res.status(401).json({ error: "Invalid token" });
    }
  }
);

app.post("/api/auth/logout", authenticateToken, async (req, res) => {
  try {
    const accountId = req.user.accountId;

    // Remove token from DB
    await pool.execute(
      `UPDATE accounts SET token = NULL WHERE account_id = ?`,
      [accountId]
    );

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

// ============================================================================
// PROFILE ROUTES (Updated for synced IDs)
// ============================================================================

// GET profile by account_id
app.get("/api/profile/:account_id", async (req, res) => {
  try {
    const account_id = req.params.account_id;

    console.log("🔍 Fetching profile for account_id:", account_id);

    const [profile] = await pool.execute(
      `
      SELECT 
        a.account_id,
        s.student_id,
        CONCAT(p.first_name, ' ', COALESCE(p.middle_name, ''), ' ', p.last_name) as name,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.email,
        p.birth_date,
        p.birth_place,
        p.gender,
        p.education,
        p.created_at,
        p.updated_at,
        s.graduation_status as status,
        tl.level_name as trading_level,
        lp.delivery_preference as learning_style,
        phone_contact.contact_value as phone_no,
        address_contact.contact_value as address,
        r.role_name as roles
      FROM accounts a
      LEFT JOIN students s ON a.account_id = s.account_id
      LEFT JOIN persons p ON a.account_id = p.person_id
      LEFT JOIN student_trading_levels stl ON s.student_id = stl.student_id AND stl.is_current = 1
      LEFT JOIN trading_levels tl ON stl.level_id = tl.level_id
      LEFT JOIN learning_preferences lp ON s.student_id = lp.student_id
      LEFT JOIN contact_info phone_contact ON a.account_id = phone_contact.person_id 
        AND phone_contact.contact_type = 'phone' AND phone_contact.is_primary = 1
      LEFT JOIN contact_info address_contact ON a.account_id = address_contact.person_id 
        AND address_contact.contact_type = 'address' AND address_contact.is_primary = 1
      LEFT JOIN account_roles ar ON a.account_id = ar.account_id AND ar.is_active = 1
      LEFT JOIN roles r ON ar.role_id = r.role_id
      WHERE a.account_id = ?
    `,
      [account_id]
    );

    if (profile.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Profile not found",
      });
    }

    console.log("✅ Profile data retrieved:", profile[0]);

    res.json({
      success: true,
      profile: profile[0],
    });
  } catch (error) {
    console.error("❌ Profile fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch profile data",
    });
  }
});

// Helper function to handle contact info updates
async function updateContactInfo(
  connection,
  person_id,
  student_id,
  contact_type,
  contact_value
) {
  if (!contact_value || !person_id) return false;

  try {
    console.log(`🔄 Updating ${contact_type} contact:`, contact_value);

    // First, try to update existing record
    const [updateResult] = await connection.execute(
      `
      UPDATE contact_info 
      SET contact_value = ?, updated_at = CURRENT_TIMESTAMP
      WHERE person_id = ? AND contact_type = ? AND is_primary = 1
    `,
      [contact_value, person_id, contact_type]
    );

    // If no rows were updated, insert a new record
    if (updateResult.affectedRows === 0) {
      // Delete any existing records of this type for this person to avoid duplicates
      await connection.execute(
        `
        DELETE FROM contact_info 
        WHERE person_id = ? AND contact_type = ?
      `,
        [person_id, contact_type]
      );

      // Insert a new record
      await connection.execute(
        `
        INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary, is_verified)
        VALUES (?, ?, ?, ?, 1, 0)
      `,
        [person_id, student_id || null, contact_type, contact_value]
      );
    }

    console.log(`✅ ${contact_type} contact updated successfully`);
    return true;
  } catch (error) {
    console.error(`❌ ${contact_type} update error:`, error);

    // Fallback approach - force delete and insert
    try {
      await connection.execute(
        `
        DELETE FROM contact_info 
        WHERE person_id = ? AND contact_type = ?
      `,
        [person_id, contact_type]
      );

      await connection.execute(
        `
        INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary, is_verified)
        VALUES (?, ?, ?, ?, 1, 0)
      `,
        [person_id, student_id || null, contact_type, contact_value]
      );

      console.log(`✅ ${contact_type} contact updated (fallback method)`);
      return true;
    } catch (fallbackError) {
      console.error(
        `❌ ${contact_type} fallback update failed:`,
        fallbackError
      );
      return false;
    }
  }
}

// PUT /api/profile/:account_id - Update user profile (FIXED with enhanced phone/email handling)
app.put(
  "/api/profile/:account_id",
  [
    body("name").optional().trim().isLength({ min: 1, max: 100 }),
    body("email").optional().isEmail(),
    body("phone_no").optional().trim().isLength({ min: 1, max: 15 }),
    body("address").optional().trim().isLength({ max: 500 }),
    body("trading_level")
      .optional()
      .isIn([
        "Beginner",
        "Intermediate",
        "Advanced",
        "beginner",
        "intermediate",
        "advanced",
      ]),
    body("learning_style")
      .optional()
      .isIn(["In-person", "Online", "in-person", "online", ""]),
    body("gender")
      .optional()
      .isIn(["Male", "Female", "Other", "male", "female", "other"]),
  ],
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      const account_id = req.params.account_id;
      const {
        name,
        email,
        phone_no,
        address,
        trading_level,
        learning_style,
        gender,
        birth_date,
        birth_place,
        education,
      } = req.body;

      console.log("🔄 Updating profile for account_id:", account_id);
      console.log("📝 Data received:", req.body);

      await connection.beginTransaction();

      // Check if email is already used by another account (if email is being changed)
      if (email) {
        const [existingEmail] = await connection.execute(
          `
        SELECT person_id FROM persons 
        WHERE email = ? AND person_id != ?
      `,
          [email, account_id]
        );

        if (existingEmail.length > 0) {
          await connection.rollback();
          return res.status(409).json({
            success: false,
            error: "Email is already in use by another account",
          });
        }
      }

      // Check if phone number is already used by another account (if phone is being changed)
      if (phone_no) {
        const [existingPhone] = await connection.execute(
          `
        SELECT person_id FROM contact_info 
        WHERE contact_type = 'phone' AND contact_value = ? AND person_id != ?
      `,
          [phone_no, account_id]
        );

        if (existingPhone.length > 0) {
          await connection.rollback();
          return res.status(409).json({
            success: false,
            error: "Phone number is already in use by another account",
          });
        }
      }

      // Get current profile data (person_id now equals account_id)
      const [currentProfile] = await connection.execute(
        `
      SELECT 
        a.account_id as person_id,
        s.student_id,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.email as person_email,
        p.birth_date,
        p.birth_place,
        p.gender,
        p.education
      FROM accounts a
      LEFT JOIN students s ON a.account_id = s.account_id
      LEFT JOIN persons p ON a.account_id = p.person_id
      WHERE a.account_id = ?
    `,
        [account_id]
      );

      if (currentProfile.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          error: "Profile not found",
        });
      }

      const profile = currentProfile[0];
      const person_id = profile.person_id; // This now equals account_id
      const student_id = profile.student_id;

      console.log("📋 Current profile:", profile);

      // Update persons table if any personal information has changed
      if (name || email || birth_date || birth_place || gender || education) {
        let first_name = profile.first_name;
        let middle_name = profile.middle_name;
        let last_name = profile.last_name;

        if (name) {
          const nameParts = name.trim().split(" ");
          first_name = nameParts[0] || "";
          if (nameParts.length === 2) {
            // Just first and last name
            middle_name = "";
            last_name = nameParts[1];
          } else if (nameParts.length > 2) {
            // First, middle(s), and last name
            last_name = nameParts[nameParts.length - 1];
            middle_name = nameParts.slice(1, -1).join(" ");
          } else {
            // Only one name provided
            last_name = "";
            middle_name = "";
          }
        }

        // Convert birth_date if it's a string
        let formatted_birth_date = birth_date;
        if (birth_date && typeof birth_date === "string") {
          try {
            formatted_birth_date = new Date(birth_date)
              .toISOString()
              .split("T")[0];
          } catch (e) {
            console.warn("⚠️ Invalid birth_date format:", birth_date);
            formatted_birth_date = null;
          }
        }

        // Normalize gender
        const normalized_gender = gender
          ? gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase()
          : null;

        // Convert undefined to null for MySQL compatibility
        const safeParams = [
          first_name || null,
          middle_name || null,
          last_name || null,
          email || null,
          formatted_birth_date || null,
          birth_place || null,
          normalized_gender || null,
          education || null,
          person_id,
        ];

        console.log("🔄 Updating persons table with safe parameters:", {
          first_name: safeParams[0],
          middle_name: safeParams[1],
          last_name: safeParams[2],
          email: safeParams[3],
          formatted_birth_date: safeParams[4],
          birth_place: safeParams[5],
          normalized_gender: safeParams[6],
          education: safeParams[7],
        });

        await connection.execute(
          `
        UPDATE persons 
        SET 
          first_name = COALESCE(?, first_name),
          middle_name = COALESCE(?, middle_name),
          last_name = COALESCE(?, last_name),
          email = COALESCE(?, email),
          birth_date = COALESCE(?, birth_date),
          birth_place = COALESCE(?, birth_place),
          gender = COALESCE(?, gender),
          education = COALESCE(?, education),
          updated_at = CURRENT_TIMESTAMP
        WHERE person_id = ?
      `,
          safeParams
        );

        console.log("✅ Persons table updated");
      }

      // Update contact information using helper function
      if (phone_no && student_id) {
        await updateContactInfo(
          connection,
          person_id,
          student_id,
          "phone",
          phone_no
        );
      }

      if (address && student_id) {
        await updateContactInfo(
          connection,
          person_id,
          student_id,
          "address",
          address
        );
      }

      if (email && student_id) {
        // For email, also update the persons table (already done above if email is provided)
        // Then update contact_info
        await updateContactInfo(
          connection,
          person_id,
          student_id,
          "email",
          email
        );
      }

      // Update student trading level if provided
      if (trading_level && student_id) {
        // Normalize trading level name
        const normalized_trading_level =
          trading_level.charAt(0).toUpperCase() +
          trading_level.slice(1).toLowerCase();

        console.log("🔄 Updating trading level:", normalized_trading_level);

        const [levelResult] = await connection.execute(
          `
        SELECT level_id FROM trading_levels WHERE level_name = ?
      `,
          [normalized_trading_level]
        );

        if (levelResult.length > 0) {
          const level_id = levelResult[0].level_id;

          // Set current level to not current
          await connection.execute(
            `
          UPDATE student_trading_levels 
          SET is_current = 0 
          WHERE student_id = ?
        `,
            [student_id || null]
          );

          // Insert new current level
          await connection.execute(
            `
          INSERT INTO student_trading_levels (student_id, level_id, assigned_date, is_current)
          VALUES (?, ?, CURRENT_TIMESTAMP, 1)
          ON DUPLICATE KEY UPDATE 
            is_current = 1,
            assigned_date = CURRENT_TIMESTAMP
        `,
            [student_id || null, level_id]
          );

          console.log("✅ Trading level updated");
        } else {
          console.warn("⚠️ Trading level not found:", normalized_trading_level);
        }
      }

      // Update learning preferences if provided
      if (learning_style !== undefined && student_id) {
        let delivery_preference = "hybrid"; // default

        if (learning_style === "In-person" || learning_style === "in-person") {
          delivery_preference = "in-person";
        } else if (learning_style === "Online" || learning_style === "online") {
          delivery_preference = "online";
        } else if (learning_style === "") {
          delivery_preference = "hybrid"; // default for empty string
        }

        console.log("🔄 Updating learning preferences:", delivery_preference);

        await connection.execute(
          `
        INSERT INTO learning_preferences (student_id, delivery_preference)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE 
          delivery_preference = VALUES(delivery_preference),
          updated_at = CURRENT_TIMESTAMP
      `,
          [student_id || null, delivery_preference]
        );

        console.log("✅ Learning preferences updated");
      }

      // Log the profile update
      await connection.execute(
        `
      INSERT INTO activity_logs (account_id, action, description, created_at)
      VALUES (?, 'profile_updated', 'User profile was updated', CURRENT_TIMESTAMP)
    `,
        [account_id]
      );

      await connection.commit();
      console.log("✅ Transaction committed");

      // Fetch the updated profile data to return
      const [updatedProfile] = await connection.execute(
        `
      SELECT 
        a.account_id,
        s.student_id,
        TRIM(CONCAT(p.first_name, ' ', COALESCE(p.middle_name, ''), ' ', p.last_name)) as name,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.email,
        p.birth_date,
        p.birth_place,
        p.gender,
        p.education,
        p.created_at,
        p.updated_at,
        s.graduation_status as status,
        tl.level_name as trading_level,
        lp.delivery_preference as learning_style,
        phone_contact.contact_value as phone_no,
        address_contact.contact_value as address,
        r.role_name as roles
      FROM accounts a
      LEFT JOIN students s ON a.account_id = s.account_id
      LEFT JOIN persons p ON a.account_id = p.person_id
      LEFT JOIN student_trading_levels stl ON s.student_id = stl.student_id AND stl.is_current = 1
      LEFT JOIN trading_levels tl ON stl.level_id = tl.level_id
      LEFT JOIN learning_preferences lp ON s.student_id = lp.student_id
      LEFT JOIN contact_info phone_contact ON a.account_id = phone_contact.person_id 
        AND phone_contact.contact_type = 'phone' AND phone_contact.is_primary = 1
      LEFT JOIN contact_info address_contact ON a.account_id = address_contact.person_id 
        AND address_contact.contact_type = 'address' AND address_contact.is_primary = 1
      LEFT JOIN account_roles ar ON a.account_id = ar.account_id AND ar.is_active = 1
      LEFT JOIN roles r ON ar.role_id = r.role_id
      WHERE a.account_id = ?
    `,
        [account_id]
      );

      if (updatedProfile.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Updated profile not found",
        });
      }

      console.log("✅ Profile update successful:", updatedProfile[0]);

      res.json({
        success: true,
        message: "Profile updated successfully",
        profile: updatedProfile[0],
      });
    } catch (error) {
      await connection.rollback();
      console.error("❌ Profile update error:", error);
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);

      let errorMessage = "Failed to update profile";
      if (error.code === "ER_DUP_ENTRY") {
        errorMessage = "Email or phone number already exists";
      } else if (error.code === "ER_DATA_TOO_LONG") {
        errorMessage = "One or more fields exceed maximum length";
      } else if (error.code === "ER_BAD_NULL_ERROR") {
        errorMessage = "Required field cannot be empty";
      } else if (error.code === "ER_NO_SUCH_TABLE") {
        errorMessage = "Database table not found - please check database setup";
      } else if (error.code === "ER_BAD_FIELD_ERROR") {
        errorMessage = "Database field error - please check database schema";
      }

      res.status(500).json({
        success: false,
        error: errorMessage,
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      connection.release();
    }
  }
);

// ============================================================================
// STUDENT ROUTES (Updated for synced IDs)
// ============================================================================

app.get(
  "/api/students",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { name_sort, graduation_status, trading_level, search } = req.query;

      let query = `
        SELECT 
          s.student_id,
          p.first_name,
          p.last_name,
          p.email,
          GROUP_CONCAT(DISTINCT CONCAT(c.course_code, ' - ', c.course_name) SEPARATOR ', ') as enrolled_courses,
          GROUP_CONCAT(DISTINCT co.batch_identifier SEPARATOR ', ') as batch_identifiers,
          s.graduation_status,
          s.academic_standing,
          s.gpa,
          s.registration_date,
          p.birth_date,
          p.birth_place,
          p.gender,
          tl.level_name as current_trading_level,
          COUNT(DISTINCT se.enrollment_id) as total_enrollments,
          SUM(DISTINCT sa.total_due) as total_course_cost,
          SUM(DISTINCT sa.amount_paid) as total_amount_paid,
          SUM(DISTINCT sa.balance) as total_balance
        FROM students s
        JOIN persons p ON s.person_id = p.person_id
        LEFT JOIN student_trading_levels stl ON s.student_id = stl.student_id AND stl.is_current = TRUE
        LEFT JOIN trading_levels tl ON stl.level_id = tl.level_id
        LEFT JOIN student_enrollments se ON s.student_id = se.student_id
        LEFT JOIN course_offerings co ON se.offering_id = co.offering_id
        LEFT JOIN courses c ON co.course_id = c.course_id
        LEFT JOIN student_accounts sa ON se.student_id = sa.student_id AND se.offering_id = sa.offering_id
      `;

      const params = [];
      const conditions = [];

      if (graduation_status) {
        conditions.push("s.graduation_status = ?");
        params.push(graduation_status);
      }

      if (trading_level) {
        conditions.push("tl.level_name = ?");
        params.push(trading_level);
      }

      if (search) {
        conditions.push(
          "(p.first_name LIKE ? OR p.last_name LIKE ? OR s.student_id LIKE ?)"
        );
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += `
        GROUP BY 
          s.student_id,
          p.first_name,
          p.last_name,
          p.email,
          p.birth_date,
          p.birth_place,
          p.gender,
          s.graduation_status,
          s.academic_standing,
          s.gpa,
          s.registration_date,
          tl.level_name
      `;

      if (name_sort) {
        query += ` ORDER BY p.first_name ${
          name_sort === "ascending" ? "ASC" : "DESC"
        }`;
      } else {
        query += " ORDER BY s.registration_date DESC";
      }

      console.log("Executing query:", query);
      console.log("With parameters:", params);

      const [students] = await pool.execute(query, params);

      const processedStudents = students.map(student => ({
        ...student,
        total_course_cost: parseFloat(student.total_course_cost) || 0,
        total_amount_paid: parseFloat(student.total_amount_paid) || 0,
        total_balance: parseFloat(student.total_balance) || 0
      }));

      console.log(`Found ${processedStudents.length} students`);
      res.json(processedStudents);
    } catch (error) {
      console.error("Students fetch error:", error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  }
);


// Improved Student Creation Endpoint
app.post(
  "/api/students",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("first_name").trim().isLength({ min: 1, max: 50 }).escape(),
    body("last_name").trim().isLength({ min: 1, max: 50 }).escape(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      const {
        first_name,
        middle_name,
        last_name,
        birth_date,
        birth_place,
        gender,
        email,
        education,
        phone,
        address,
        trading_level_id,
        password,
        learning_style,
        delivery_preference,
        device_type,
        preferred_schedule,
        goals,
        background_info,
      } = req.body;

      console.log("Creating student with data:", {
        first_name,
        middle_name,
        last_name,
        email,
      });

      await connection.beginTransaction();

      // Check if email already exists
      const [existingEmail] = await connection.execute(
        "SELECT person_id FROM persons WHERE email = ?",
        [email]
      );

      if (existingEmail.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: "Email already exists" });
      }

      // Hash the password
      const passwordHash = await bcrypt.hash(password, 12);

      // Call the stored procedure
      const [registerResult] = await connection.execute(
        `
      CALL sp_register_user_with_synced_ids(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @account_id, @result)
    `,
        [
          passwordHash,
          first_name,
          middle_name || null,
          last_name,
          birth_date || null,
          birth_place || "Not specified",
          gender || "Other",
          email,
          education || "Not specified",
          phone || null,
          address || null,
          "student",
        ]
      );

      const [[output]] = await connection.execute(
        `SELECT @account_id AS account_id, @result AS result`
      );

      if (!output || !output.result || !output.result.startsWith("SUCCESS")) {
        throw new Error(output?.result || "Registration failed");
      }

      const account_id = output.account_id;

      const [studentData] = await connection.execute(
        "SELECT student_id FROM students WHERE account_id = ?",
        [account_id]
      );

      const student_id = studentData[0]?.student_id;

      if (!student_id) {
        throw new Error("Student record not found after creation");
      }

      if (trading_level_id && trading_level_id !== 1) {
        await connection.execute(
          `
        UPDATE student_trading_levels 
        SET is_current = FALSE 
        WHERE student_id = ? AND is_current = TRUE
      `,
          [student_id]
        );

        await connection.execute(
          `
        INSERT INTO student_trading_levels (student_id, level_id, is_current, assigned_by)
        VALUES (?, ?, TRUE, ?)
      `,
          [student_id, trading_level_id, req.user.staffId || null]
        );
      }

      // Update learning preferences if provided
      if (
        learning_style ||
        delivery_preference ||
        device_type ||
        preferred_schedule
      ) {
        const updateFields = [];
        const updateValues = [];

        if (learning_style) {
          updateFields.push("learning_style = ?");
          updateValues.push(learning_style);
        }
        if (delivery_preference) {
          updateFields.push("delivery_preference = ?");
          updateValues.push(delivery_preference);
        }
        if (device_type) {
          updateFields.push("device_type = ?");
          updateValues.push(device_type);
        }
        if (preferred_schedule) {
          updateFields.push("preferred_schedule = ?");
          updateValues.push(preferred_schedule);
        }

        if (updateFields.length > 0) {
          updateValues.push(student_id);
          await connection.execute(
            `
          UPDATE learning_preferences 
          SET ${updateFields.join(", ")}
          WHERE student_id = ?
        `,
            updateValues
          );
        }
      }

      // Add student goals if provided
      if (goals && Array.isArray(goals)) {
        for (const goal of goals) {
          await connection.execute(
            `
          INSERT INTO student_goals (
            student_id, goal_type, goal_title, goal_description, 
            target_date, priority_level, status
          ) VALUES (?, ?, ?, ?, ?, ?, 'active')
        `,
            [
              student_id,
              goal.type || "personal",
              goal.title,
              goal.description,
              goal.target_date || null,
              goal.priority || "medium",
            ]
          );
        }
      }

      // Update background info if provided
      if (background_info) {
        const {
          work_experience_years,
          current_occupation,
          industry,
          financial_experience,
          prior_trading_experience,
        } = background_info;

        await connection.execute(
          `
        UPDATE student_backgrounds 
        SET work_experience_years = ?,
            current_occupation = ?,
            industry = ?,
            financial_experience = ?,
            prior_trading_experience = ?
        WHERE student_id = ?
      `,
          [
            work_experience_years || 0,
            current_occupation || null,
            industry || null,
            financial_experience || null,
            prior_trading_experience || null,
            student_id,
          ]
        );
      }

      await connection.commit();
      console.log("Transaction committed successfully");

      // Send welcome email
      let emailSent = false;
      try {
        if (emailTransporter && email) {
          await sendWelcomeEmail(
            email,
            first_name,
            last_name,
            password,
            "student"
          );
          emailSent = true;
        }
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }

      // Fetch complete student data
      const [completeStudentData] = await connection.execute(
        `
      SELECT 
        s.student_id,
        s.registration_date,
        p.first_name,
        p.last_name,
        p.email,
        tl.level_name as trading_level,
        lp.delivery_preference,
        lp.learning_style
      FROM students s
      JOIN persons p ON s.person_id = p.person_id
      LEFT JOIN student_trading_levels stl ON s.student_id = stl.student_id AND stl.is_current = TRUE
      LEFT JOIN trading_levels tl ON stl.level_id = tl.level_id
      LEFT JOIN learning_preferences lp ON s.student_id = lp.student_id
      WHERE s.student_id = ?
    `,
        [student_id]
      );

      res.status(201).json({
        message: emailSent
          ? "Student created successfully! Login credentials have been sent to their email."
          : "Student created successfully!",
        student: completeStudentData[0],
        email_sent: emailSent,
        credentials: !emailSent ? { email, password } : undefined,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Student creation error:", error);

      if (error.code === "ER_DUP_ENTRY") {
        res.status(409).json({ error: "Email already exists" });
      } else {
        res.status(500).json({
          error: "Failed to create student",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    } finally {
      connection.release();
    }
  }
);

app.get(
  "/api/students/:studentId/financial-summary",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [financialData] = await pool.execute(
        `
        SELECT 
          s.student_id,
          p.first_name,
          p.last_name,
          c.course_code,
          c.course_name,
          sa.total_due,
          sa.amount_paid,
          sa.balance,
          se.enrollment_status,
          co.batch_identifier
        FROM students s
        JOIN persons p ON s.person_id = p.person_id
        JOIN student_enrollments se ON s.student_id = se.student_id
        JOIN course_offerings co ON se.offering_id = co.offering_id
        JOIN courses c ON co.course_id = c.course_id
        LEFT JOIN student_accounts sa ON se.student_id = sa.student_id AND se.offering_id = sa.offering_id
        WHERE s.student_id = ?
        ORDER BY c.course_code
        `,
        [studentId]
      );

      if (financialData.length === 0) {
        return res.status(404).json({ error: "Student not found or no enrollments" });
      }

      // Calculate totals
      const totals = financialData.reduce(
        (acc, row) => ({
          total_cost: acc.total_cost + (parseFloat(row.total_due) || 0),
          total_paid: acc.total_paid + (parseFloat(row.amount_paid) || 0),
          total_balance: acc.total_balance + (parseFloat(row.balance) || 0),
        }),
        { total_cost: 0, total_paid: 0, total_balance: 0 }
      );

      res.json({
        student_info: {
          student_id: financialData[0].student_id,
          name: `${financialData[0].first_name} ${financialData[0].last_name}`,
        },
        course_financials: financialData.map(row => ({
          course_code: row.course_code,
          course_name: row.course_name,
          batch: row.batch_identifier,
          enrollment_status: row.enrollment_status,
          cost: parseFloat(row.total_due) || 0,
          paid: parseFloat(row.amount_paid) || 0,
          balance: parseFloat(row.balance) || 0,
        })),
        summary: {
          total_course_cost: totals.total_cost,
          total_amount_paid: totals.total_paid,
          outstanding_balance: totals.total_balance,
        },
      });
    } catch (error) {
      console.error("Financial summary fetch error:", error);
      res.status(500).json({ error: "Failed to fetch financial summary" });
    }
  }
);

// Staff Creation Endpoint
app.post(
  "/api/staff",
  [
    authenticateToken,
    authorize(["admin"]),
    body("first_name").trim().isLength({ min: 1, max: 50 }).escape(),
    body("last_name").trim().isLength({ min: 1, max: 50 }).escape(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      const {
        first_name,
        middle_name,
        last_name,
        birth_date,
        birth_place,
        gender,
        email,
        education,
        phone,
        address,
        password,
        position_id,
        department,
        emergency_contact,
      } = req.body;

      await connection.beginTransaction();

      // Check if email already exists
      const [existingEmail] = await connection.execute(
        "SELECT person_id FROM persons WHERE email = ?",
        [email]
      );

      if (existingEmail.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: "Email already exists" });
      }

      // Hash the password
      const passwordHash = await bcrypt.hash(password, 12);

      // Call the stored procedure
      const [registerResult] = await connection.execute(
        `
      CALL sp_register_user_with_synced_ids(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @account_id, @result)
    `,
        [
          passwordHash,
          first_name,
          middle_name || null,
          last_name,
          birth_date || null,
          birth_place || "Not specified",
          gender || "Other",
          email,
          education || "Not specified",
          phone || null,
          address || null,
          "staff",
        ]
      );

      const [[output]] = await connection.execute(
        `SELECT @account_id AS account_id, @result AS result`
      );

      if (!output || !output.result || !output.result.startsWith("SUCCESS")) {
        throw new Error(output?.result || "Registration failed");
      }

      const account_id = output.account_id;

      // Get the staff_id
      const [staffData] = await connection.execute(
        "SELECT staff_id, employee_id FROM staff WHERE account_id = ?",
        [account_id]
      );

      const { staff_id, employee_id } = staffData[0] || {};

      if (!staff_id) {
        throw new Error("Staff record not found after creation");
      }

      // Update emergency contact if provided
      if (emergency_contact) {
        await connection.execute(
          `
        UPDATE staff 
        SET emergency_contact = ?
        WHERE staff_id = ?
      `,
          [emergency_contact, staff_id]
        );
      }

      // Assign position if provided
      if (position_id) {
        await connection.execute(
          `
        INSERT INTO staff_positions (staff_id, position_id, start_date, is_primary)
        VALUES (?, ?, CURDATE(), TRUE)
      `,
          [staff_id, position_id]
        );
      }

      await connection.commit();
      console.log("Staff member created successfully");

      // Send welcome email
      let emailSent = false;
      try {
        if (emailTransporter && email) {
          await sendWelcomeEmail(
            email,
            first_name,
            last_name,
            password,
            "staff"
          );
          emailSent = true;
        }
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }

      res.status(201).json({
        message: emailSent
          ? "Staff member created successfully! Login credentials have been sent to their email."
          : "Staff member created successfully!",
        staff: {
          staff_id,
          employee_id,
          account_id,
          name: `${first_name} ${last_name}`,
          email,
        },
        email_sent: emailSent,
        credentials: !emailSent ? { email, password } : undefined,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Staff creation error:", error);

      if (error.code === "ER_DUP_ENTRY") {
        res.status(409).json({ error: "Email already exists" });
      } else {
        res.status(500).json({
          error: "Failed to create staff member",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    } finally {
      connection.release();
    }
  }
);

// Helper function to send welcome emails
async function sendWelcomeEmail(email, firstName, lastName, password, role) {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || "Trading Academy"}" <${
      process.env.EMAIL_USER
    }>`,
    to: email,
    subject: `Your Trading Academy ${
      role === "staff" ? "Staff" : "Student"
    } Account Credentials`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d4a3d;">Welcome to Trading Academy!</h2>
        <p>Dear ${firstName} ${lastName},</p>
        <p>Your ${role} account has been successfully created. Here are your login credentials:</p>
        <div style="background-color: #f5f2e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> <code style="background-color: #fff; padding: 2px 4px; border-radius: 3px;">${password}</code></p>
          ${
            role === "staff"
              ? "<p><strong>Portal:</strong> Staff Portal</p>"
              : ""
          }
        </div>
        <p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
        <p>You can log in to your account using your email address and the password provided above.</p>
        ${
          role === "staff"
            ? "<p>As a staff member, you will have access to manage student records and course information.</p>"
            : ""
        }
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <p>Best regards,<br>8Con Academy Team</p>
      </div>
    `,
  };

  await emailTransporter.sendMail(mailOptions);
}

app.get(
  "/api/students/:studentId",
  authenticateToken,
  authorize(["admin", "staff", "student"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      // Use exact match, not LIKE, for getting a specific student
      const [students] = await pool.execute(
        `
        SELECT s.student_id, s.account_id, s.graduation_status, s.academic_standing, s.registration_date,
               p.person_id, p.first_name, p.middle_name, p.last_name, p.birth_date, p.birth_place, 
               p.gender, p.email, p.education,
               tl.level_name as current_trading_level, tl.level_id,
               a.account_status
        FROM students s
        JOIN persons p ON s.person_id = p.person_id
        LEFT JOIN accounts a ON s.account_id = a.account_id
        LEFT JOIN student_trading_levels stl ON s.student_id = stl.student_id AND stl.is_current = TRUE
        LEFT JOIN trading_levels tl ON stl.level_id = tl.level_id
        WHERE s.student_id = ?
        `,
        [studentId] // Only one parameter needed for exact match
      );

      if (students.length === 0) {
        return res.status(404).json({ error: "Student not found" });
      }

      const [contacts] = await pool.execute(
        `
        SELECT contact_type, contact_value, is_primary
        FROM contact_info
        WHERE student_id = ?
        `,
        [studentId]
      );

      res.json({
        ...students[0],
        contacts,
      });
    } catch (error) {
      console.error("Student fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student details" });
    }
  }
);

// ============================================================================
// DASHBOARD ROUTES (Updated for synced IDs)
// ============================================================================

app.get(
  "/api/dashboard/kpi-data",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const cacheKey = 'dashboard_kpi_data';
      const now = Date.now();
      
      // Check cache first
      if (dashboardCache.has(cacheKey)) {
        const { data, timestamp } = dashboardCache.get(cacheKey);
        if (now - timestamp < CACHE_DURATION) {
          return res.json(data);
        }
      }

      // Fetch fresh data using stored procedure
      const [results] = await pool.execute('CALL sp_get_dashboard_kpi_data()');
      
      const dashboardData = {
        kpiData: results[0][0] || {
          total_enrollees: 0,
          total_revenue: 0,
          total_graduates: 0,
          pending_receivables: 0
        },
        revenueHistogram: results[1] || [],
        statusDistribution: (results[2] || []).map(item => ({
          ...item,
          color: item.name === 'Basic' ? '#3B82F6' : 
                 item.name === 'Common' ? '#10B981' : '#F59E0B'
        })),
        enrollmentTrend: results[3] || [],
        batchData: results[4] || []
      };

      // Cache the result
      dashboardCache.set(cacheKey, { data: dashboardData, timestamp: now });

      res.json(dashboardData);
    } catch (error) {
      console.error("Dashboard KPI data fetch error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard KPI data" });
    }
  }
);

// Clear cache endpoint for real-time updates
app.post(
  "/api/dashboard/clear-cache",
  authenticateToken,
  authorize(["admin", "staff"]),
  (req, res) => {
    dashboardCache.clear();
    res.json({ message: "Dashboard cache cleared successfully" });
  }
);

app.get(
  "/api/dashboard/student/:studentId",
  authenticateToken,
  authorize(["student", "admin", "staff"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [studentInfo] = await pool.execute(
        `
      SELECT s.student_id, s.graduation_status, s.academic_standing, s.gpa,
             p.first_name, p.last_name, p.birth_date,
             tl.level_name as current_trading_level
      FROM students s
      JOIN persons p ON s.person_id = p.person_id
      LEFT JOIN student_trading_levels stl ON s.student_id = stl.student_id AND stl.is_current = TRUE
      LEFT JOIN trading_levels tl ON stl.level_id = tl.level_id
      WHERE s.student_id = ?
    `,
        [studentId]
      );

      const [enrollments] = await pool.execute(
        `
      SELECT se.enrollment_id, se.enrollment_status, se.completion_percentage,
             c.course_name, co.batch_identifier, co.start_date, co.end_date
      FROM student_enrollments se
      JOIN course_offerings co ON se.offering_id = co.offering_id
      JOIN courses c ON co.course_id = c.course_id
      WHERE se.student_id = ?
      ORDER BY co.start_date DESC
    `,
        [studentId]
      );

      const [financialSummary] = await pool.execute(
        `
      SELECT 
        COALESCE(SUM(sa.total_due), 0) as total_due,
        COALESCE(SUM(sa.amount_paid), 0) as amount_paid,
        COALESCE(SUM(sa.balance), 0) as balance
      FROM student_accounts sa
      WHERE sa.student_id = ?
    `,
        [studentId]
      );

      const [recentProgress] = await pool.execute(
        `
      SELECT sp.score, sp.max_score, sp.percentage_score, sp.passed, sp.attempt_date,
             comp.competency_name, ct.type_name as competency_type
      FROM student_progress sp
      JOIN student_enrollments se ON sp.enrollment_id = se.enrollment_id
      JOIN competencies comp ON sp.competency_id = comp.competency_id
      JOIN competency_types ct ON comp.competency_type_id = ct.competency_type_id
      WHERE se.student_id = ?
      ORDER BY sp.attempt_date DESC
      LIMIT 5
    `,
        [studentId]
      );

      res.json({
        student: studentInfo[0] || {},
        enrollments,
        financial: financialSummary[0] || {
          total_due: 0,
          amount_paid: 0,
          balance: 0,
        },
        recent_progress: recentProgress,
      });
    } catch (error) {
      console.error("Student dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch student dashboard" });
    }
  }
);
app.put('/api/payments/:id/status', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id: paymentId } = req.params;
    const { status, notes } = req.body;
    
    console.log('Payment status update request:', {
      paymentId,
      status,
      notes,
      body: req.body
    });

    // Validate required parameters
    if (!paymentId || !status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment ID and status are required' 
      });
    }

    // Validate payment ID
    const numericPaymentId = parseInt(paymentId);
    if (isNaN(numericPaymentId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment ID format' 
      });
    }

    // Validate status
    const allowedStatuses = ['pending', 'confirmed', 'completed', 'failed', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status value. Allowed: ${allowedStatuses.join(', ')}` 
      });
    }

    // Get the user ID from the token (with fallbacks)
    let processedBy = 1; // Default fallback
    if (req.user) {
      processedBy = req.user.user_id || req.user.id || req.user.staff_id || 1;
    }

    console.log('Processing payment update:', {
      paymentId: numericPaymentId,
      status,
      notes: notes || null,
      processedBy
    });

    // Start transaction
    await connection.beginTransaction();

    // First, check if payment exists and get full payment details
    const [existingPayment] = await connection.execute(
      `SELECT p.*, s.first_name, s.last_name, s.student_id, 
              c.course_name, b.batch_identifier,
              pm.method_name
       FROM payments p
       JOIN students s ON p.student_id = s.student_id
       JOIN courses c ON p.course_id = c.course_id
       JOIN batches b ON p.batch_id = b.batch_id
       JOIN payment_methods pm ON p.method_id = pm.method_id
       WHERE p.payment_id = ?`,
      [numericPaymentId]
    );

    if (existingPayment.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const payment = existingPayment[0];
    console.log('Found existing payment:', payment);

    // Update payment status in payments table
    const updateQuery = `
      UPDATE payments 
      SET payment_status = ?, 
          notes = ?, 
          updated_at = NOW(),
          processed_by = ?
      WHERE payment_id = ?
    `;

    const updateParams = [status, notes || null, processedBy, numericPaymentId];

    console.log('Executing update query:', updateQuery);
    console.log('With parameters:', updateParams);

    const [updateResult] = await connection.execute(updateQuery, updateParams);

    console.log('Update result:', updateResult);

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Failed to update payment status'
      });
    }

    // If status is completed or confirmed, insert into completedpayments table
    if (status === 'completed' || status === 'confirmed') {
      console.log('Inserting into completedpayments table...');
      
      // Check if record already exists in completedpayments
      const [existingCompleted] = await connection.execute(
        'SELECT payment_id FROM completedpayments WHERE payment_id = ?',
        [numericPaymentId]
      );

      if (existingCompleted.length === 0) {
        // Insert into completedpayments table
        const insertCompletedQuery = `
          INSERT INTO completedpayments (
            payment_id,
            student_id,
            course_id,
            batch_id,
            payment_amount,
            payment_date,
            method_id,
            reference_number,
            notes,
            processed_by,
            completed_at,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        const insertParams = [
          payment.payment_id,
          payment.student_id,
          payment.course_id,
          payment.batch_id,
          payment.payment_amount,
          payment.payment_date,
          payment.method_id,
          payment.reference_number,
          notes || payment.notes,
          processedBy
        ];

        console.log('Inserting completed payment:', insertParams);

        const [insertResult] = await connection.execute(insertCompletedQuery, insertParams);
        
        console.log('Insert completed payment result:', insertResult);

        if (insertResult.affectedRows === 0) {
          await connection.rollback();
          return res.status(500).json({
            success: false,
            message: 'Failed to insert into completed payments'
          });
        }
      } else {
        console.log('Payment already exists in completedpayments table');
        
        // Update existing record in completedpayments
        const updateCompletedQuery = `
          UPDATE completedpayments 
          SET notes = ?, 
              processed_by = ?,
              completed_at = NOW(),
              updated_at = NOW()
          WHERE payment_id = ?
        `;

        await connection.execute(updateCompletedQuery, [notes || payment.notes, processedBy, numericPaymentId]);
      }

      // Update student balance if needed
      try {
        const updateBalanceQuery = `
          UPDATE students 
          SET balance = balance - ?
          WHERE student_id = ? AND balance >= ?
        `;
        
        const [balanceResult] = await connection.execute(updateBalanceQuery, [
          payment.payment_amount,
          payment.student_id,
          payment.payment_amount
        ]);

        console.log('Balance update result:', balanceResult);
      } catch (balanceError) {
        console.warn('Balance update failed (non-critical):', balanceError.message);
        // Don't fail the transaction for balance update issues
      }
    }

    // If status is failed, we might want to add to a failed_payments table or just keep in payments
    if (status === 'failed') {
      console.log('Payment marked as failed');
      // Could add logic here to handle failed payments specifically
    }

    // Commit transaction
    await connection.commit();

    // Verify the update worked
    const [verifyResult] = await connection.execute(
      'SELECT payment_id, payment_status, notes, updated_at FROM payments WHERE payment_id = ?',
      [numericPaymentId]
    );

    console.log('Verification result:', verifyResult[0]);

    // If completed, also verify it's in completedpayments
    let completedPaymentVerification = null;
    if (status === 'completed' || status === 'confirmed') {
      const [completedVerify] = await connection.execute(
        'SELECT payment_id, completed_at FROM completedpayments WHERE payment_id = ?',
        [numericPaymentId]
      );
      completedPaymentVerification = completedVerify[0] || null;
      console.log('Completed payment verification:', completedPaymentVerification);
    }

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      paymentId: numericPaymentId,
      newStatus: status,
      payment: verifyResult[0],
      completedPayment: completedPaymentVerification
    });

  } catch (error) {
    // Rollback transaction on error
    await connection.rollback();
    
    console.error('Payment status update error:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during payment status update',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : 'Internal server error'
    });
  } finally {
    // Release connection back to pool
    connection.release();
  }
});

// Backup simple endpoint
app.put('/api/payments/:id/status-simple', authenticateToken, async (req, res) => {
  try {
    const { id: paymentId } = req.params;
    const { status, notes } = req.body;
    
    console.log('Simple status update request:', { paymentId, status, notes });

    const numericPaymentId = parseInt(paymentId);
    if (isNaN(numericPaymentId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment ID format' 
      });
    }

    // Very simple update - just status and notes
    const [updateResult] = await pool.execute(
      'UPDATE payments SET payment_status = ?, notes = ?, updated_at = NOW() WHERE payment_id = ?',
      [status, notes || null, numericPaymentId]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Payment status updated successfully',
      paymentId: numericPaymentId,
      newStatus: status
    });

  } catch (error) {
    console.error('Simple payment status update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Alternative endpoint specifically for amount updates (if needed)
app.put('/api/payments/:id/amount', authenticateToken, async (req, res) => {
  try {
    const { id: paymentId } = req.params;
    const { amount } = req.body;

    if (!paymentId || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment ID and amount are required' 
      });
    }

    const numericPaymentId = parseInt(paymentId);
    const numericAmount = parseFloat(amount);

    if (isNaN(numericPaymentId) || isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment ID or amount format' 
      });
    }

    // Update only the amount
    const [updateResult] = await pool.execute(
      'UPDATE payments SET payment_amount = ?, updated_at = NOW() WHERE payment_id = ?',
      [numericAmount, numericPaymentId]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Payment amount updated successfully',
      paymentId: numericPaymentId,
      newAmount: numericAmount
    });

  } catch (error) {
    console.error('Payment amount update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error during amount update' 
    });
  }
});

// Utility function for parameter sanitization
function sanitizeForMySQL(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return value;
}

// Enhanced parameter sanitization for different data types
function sanitizeParams(params) {
  return params.map(param => {
    if (param === undefined || param === null || param === '') {
      return null;
    }
    return param;
  });
}

// GET /api/payments - Enhanced to include filtering and pagination
app.get(
  "/api/payments",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const {
        name_sort,
        status,
        student_search,
        page = 1,
        limit = 15,
        date_range,
        course_filter,
      } = req.query;

      let query = `
        SELECT 
          p.payment_id, 
          p.payment_amount, 
          p.processing_fee, 
          p.payment_date, 
          p.payment_status,
          p.reference_number, 
          p.notes,
          p.created_at,
          p.updated_at,
          pm.method_name,
          pm.method_type,
          sa.account_id,
          sa.total_due, 
          sa.amount_paid,
          sa.balance,
          s.student_id, 
          per.first_name, 
          per.last_name,
          per.email,
          c.course_name, 
          c.course_code,
          co.batch_identifier,
          co.offering_id,
          ci_phone.contact_value as phone,
          staff_per.first_name as processed_by_first_name,
          staff_per.last_name as processed_by_last_name
        FROM payments p
        JOIN payment_methods pm ON p.method_id = pm.method_id
        JOIN student_accounts sa ON p.account_id = sa.account_id
        JOIN students s ON sa.student_id = s.student_id
        JOIN persons per ON s.person_id = per.person_id
        JOIN course_offerings co ON sa.offering_id = co.offering_id
        JOIN courses c ON co.course_id = c.course_id
        LEFT JOIN contact_info ci_phone ON s.person_id = ci_phone.person_id 
          AND ci_phone.contact_type = 'phone' 
          AND ci_phone.is_primary = TRUE
        LEFT JOIN staff st ON p.processed_by = st.staff_id
        LEFT JOIN persons staff_per ON st.person_id = staff_per.person_id
        WHERE 1=1
      `;

      const params = [];

      // Filter by payment status
      if (status && status !== "all") {
        query += " AND p.payment_status = ?";
        params.push(status);
      }

      // Filter by student name search
      if (student_search) {
        query +=
          " AND (per.first_name LIKE ? OR per.last_name LIKE ? OR s.student_id LIKE ?)";
        const searchParam = `%${student_search}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      // Filter by course
      if (course_filter) {
        query += " AND c.course_name = ?";
        params.push(course_filter);
      }

      // Filter by date range
      if (date_range && date_range !== "all") {
        const today = new Date();
        let filterDate = new Date();

        switch (date_range) {
          case "week":
            filterDate.setDate(today.getDate() - 7);
            break;
          case "month":
            filterDate.setMonth(today.getMonth() - 1);
            break;
          case "quarter":
            filterDate.setMonth(today.getMonth() - 3);
            break;
          case "year":
            filterDate.setFullYear(today.getFullYear() - 1);
            break;
        }

        query += " AND p.payment_date >= ?";
        params.push(filterDate.toISOString().split("T")[0]);
      }

      // Sort by student name or payment date
      if (name_sort) {
        query += ` ORDER BY per.first_name ${
          name_sort === "ascending" ? "ASC" : "DESC"
        }, per.last_name ${name_sort === "ascending" ? "ASC" : "DESC"}`;
      } else {
        query += " ORDER BY p.payment_date DESC, p.created_at DESC";
      }

      // Count total records for pagination
      const countQuery = query.replace(
        /SELECT[\s\S]*?FROM/,
        "SELECT COUNT(*) as total FROM"
      );
      const [countResult] = await pool.execute(countQuery, params);
      const totalRecords = countResult[0].total;
      const totalPages = Math.ceil(totalRecords / parseInt(limit));

      // Add pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += " LIMIT ? OFFSET ?";
      params.push(parseInt(limit), offset);

      console.log("Executing payments query:", query);
      console.log("With parameters:", params);

      const [payments] = await pool.execute(query, params);

      console.log(`Found ${payments.length} payments`);

      res.json({
        payments,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_records: totalRecords,
          total_pages: totalPages,
        },
      });
    } catch (error) {
      console.error("Payments fetch error:", error);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  }
);

// GET /api/payments/pending - Get pending payments
app.get(
  "/api/payments/pending",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { name_sort, student_search } = req.query;

      let query = `
        SELECT 
          p.payment_id, 
          p.payment_amount, 
          p.processing_fee, 
          p.payment_date, 
          p.payment_status,
          p.reference_number, 
          p.notes,
          p.created_at,
          pm.method_name,
          sa.account_id,
          sa.total_due, 
          sa.balance,
          s.student_id, 
          per.first_name, 
          per.last_name,
          per.email,
          c.course_name, 
          co.batch_identifier,
          co.offering_id,
          pm.method_id,
          ci_phone.contact_value as phone
        FROM payments p
        JOIN payment_methods pm ON p.method_id = pm.method_id
        JOIN student_accounts sa ON p.account_id = sa.account_id
        JOIN students s ON sa.student_id = s.student_id
        JOIN persons per ON s.person_id = per.person_id
        JOIN course_offerings co ON sa.offering_id = co.offering_id
        JOIN courses c ON co.course_id = c.course_id
        LEFT JOIN contact_info ci_phone ON s.person_id = ci_phone.person_id 
          AND ci_phone.contact_type = 'phone' 
          AND ci_phone.is_primary = TRUE
        WHERE p.payment_status = 'pending'
      `;

      const params = [];

      // Filter by student name search
      if (student_search) {
        query +=
          " AND (per.first_name LIKE ? OR per.last_name LIKE ? OR s.student_id LIKE ?)";
        const searchParam = `%${student_search}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      // Sort by student name
      if (name_sort) {
        query += ` ORDER BY per.first_name ${
          name_sort === "ascending" ? "ASC" : "DESC"
        }, per.last_name ${name_sort === "ascending" ? "ASC" : "DESC"}`;
      } else {
        query += " ORDER BY p.payment_date DESC, p.created_at DESC";
      }

      const [payments] = await pool.execute(query, params);
      res.json(payments);
    } catch (error) {
      console.error("Pending payments fetch error:", error);
      res.status(500).json({ error: "Failed to fetch pending payments" });
    }
  }
);

// GET /api/payments/completed - Get completed payments (Enhanced)
app.get(
  "/api/payments/completed",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { name_sort, student_search, date_range } = req.query;

      console.log('=== FETCHING COMPLETED PAYMENTS ===');
      console.log('Request filters:', { name_sort, student_search, date_range });

      // SIMPLIFIED query - remove complex JOINs that might be filtering out payments
      let query = `
        SELECT 
          p.payment_id, 
          p.payment_amount, 
          p.processing_fee, 
          p.payment_date, 
          p.payment_status,
          p.reference_number, 
          p.notes,
          p.created_at,
          p.updated_at,
          pm.method_name,
          COALESCE(sa.account_id, 'N/A') as account_id,
          COALESCE(sa.total_due, 0) as total_due, 
          COALESCE(sa.balance, 0) as balance,
          COALESCE(s.student_id, 'Unknown') as student_id, 
          COALESCE(per.first_name, 'Unknown') as first_name, 
          COALESCE(per.last_name, 'Student') as last_name,
          COALESCE(per.email, '') as email,
          COALESCE(c.course_name, 'Unknown Course') as course_name, 
          COALESCE(co.batch_identifier, 'Unknown Batch') as batch_identifier,
          pm.method_id,
          COALESCE(ci_phone.contact_value, '') as phone
        FROM payments p
        LEFT JOIN payment_methods pm ON p.method_id = pm.method_id
        LEFT JOIN student_accounts sa ON p.account_id = sa.account_id
        LEFT JOIN students s ON sa.student_id = s.student_id
        LEFT JOIN persons per ON s.person_id = per.person_id
        LEFT JOIN course_offerings co ON sa.offering_id = co.offering_id
        LEFT JOIN courses c ON co.course_id = c.course_id
        LEFT JOIN contact_info ci_phone ON s.person_id = ci_phone.person_id 
          AND ci_phone.contact_type = 'phone' 
          AND ci_phone.is_primary = TRUE
        WHERE p.payment_status IN ('completed', 'confirmed', 'approved')
      `;

      const params = [];

      // Filter by student name search
      if (student_search) {
        query +=
          " AND (per.first_name LIKE ? OR per.last_name LIKE ? OR s.student_id LIKE ? OR p.payment_id LIKE ?)";
        const searchParam = `%${student_search}%`;
        params.push(searchParam, searchParam, searchParam, searchParam);
      }

      // Filter by date range
      if (date_range && date_range !== "all") {
        const now = new Date();
        let filterDate = new Date();

        switch (date_range) {
          case "week":
            filterDate.setDate(now.getDate() - 7);
            break;
          case "month":
            filterDate.setMonth(now.getMonth() - 1);
            break;
          case "quarter":
            filterDate.setMonth(now.getMonth() - 3);
            break;
          case "year":
            filterDate.setFullYear(now.getFullYear() - 1);
            break;
        }

        query += " AND p.updated_at >= ?";
        params.push(filterDate.toISOString().split("T")[0]);
      }

      // Sort by most recently updated first
      if (name_sort) {
        query += ` ORDER BY per.first_name ${
          name_sort === "ascending" ? "ASC" : "DESC"
        }, per.last_name ${name_sort === "ascending" ? "ASC" : "DESC"}`;
      } else {
        query += " ORDER BY p.updated_at DESC, p.created_at DESC";
      }

      console.log("Executing completed payments query:", query);
      console.log("With parameters:", params);

      const [payments] = await pool.execute(query, params);

      console.log(`Found ${payments.length} completed payments`);
      
      // Enhanced logging for debugging
      if (payments.length > 0) {
        console.log('First 3 completed payments:');
        payments.slice(0, 3).forEach((p, index) => {
          console.log(`${index + 1}. ID: ${p.payment_id}, Status: ${p.payment_status}, Student: ${p.first_name} ${p.last_name}, Updated: ${p.updated_at}`);
        });
      } else {
        console.log('No completed payments found - checking if any payments exist...');
        
        // Debug query to see what payments exist
        const [allPayments] = await pool.execute(
          "SELECT payment_id, payment_status, updated_at FROM payments ORDER BY updated_at DESC LIMIT 10"
        );
        
        console.log('Recent payments in database:');
        allPayments.forEach(p => {
          console.log(`- ID: ${p.payment_id}, Status: ${p.payment_status}, Updated: ${p.updated_at}`);
        });
      }

      res.json(payments);
      
    } catch (error) {
      console.error("=== COMPLETED PAYMENTS FETCH ERROR ===");
      console.error("Error details:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ 
        error: "Failed to fetch completed payments",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Enhanced cancelled payments endpoint  
app.get(
  "/api/payments/cancelled",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { name_sort, student_search, date_range } = req.query;

      let query = `
        SELECT 
          p.payment_id, 
          p.payment_amount, 
          p.processing_fee, 
          p.payment_date, 
          p.payment_status,
          p.reference_number, 
          p.notes,
          p.created_at,
          p.updated_at,
          pm.method_name,
          sa.account_id,
          sa.total_due, 
          sa.balance,
          s.student_id, 
          per.first_name, 
          per.last_name,
          per.email,
          c.course_name, 
          co.batch_identifier,
          co.offering_id,
          pm.method_id,
          ci_phone.contact_value as phone
        FROM payments p
        JOIN payment_methods pm ON p.method_id = pm.method_id
        JOIN student_accounts sa ON p.account_id = sa.account_id
        JOIN students s ON sa.student_id = s.student_id
        JOIN persons per ON s.person_id = per.person_id
        JOIN course_offerings co ON sa.offering_id = co.offering_id
        JOIN courses c ON co.course_id = c.course_id
        LEFT JOIN contact_info ci_phone ON s.person_id = ci_phone.person_id 
          AND ci_phone.contact_type = 'phone' 
          AND ci_phone.is_primary = TRUE
        WHERE p.payment_status IN ('failed', 'cancelled')
      `;

      const params = [];

      // Filter by student name search
      if (student_search) {
        query +=
          " AND (per.first_name LIKE ? OR per.last_name LIKE ? OR s.student_id LIKE ?)";
        const searchParam = `%${student_search}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      // Filter by date range
      if (date_range && date_range !== "all") {
        const now = new Date();
        let filterDate = new Date();

        switch (date_range) {
          case "week":
            filterDate.setDate(now.getDate() - 7);
            break;
          case "month":
            filterDate.setMonth(now.getMonth() - 1);
            break;
          case "quarter":
            filterDate.setMonth(now.getMonth() - 3);
            break;
          case "year":
            filterDate.setFullYear(now.getFullYear() - 1);
            break;
        }

        query += " AND p.updated_at >= ?";
        params.push(filterDate.toISOString().split("T")[0]);
      }

      // Sort by student name or payment date
      if (name_sort) {
        query += ` ORDER BY per.first_name ${
          name_sort === "ascending" ? "ASC" : "DESC"
        }, per.last_name ${name_sort === "ascending" ? "ASC" : "DESC"}`;
      } else {
        query += " ORDER BY p.updated_at DESC, p.created_at DESC";
      }

      console.log("Executing cancelled payments query:", query);
      console.log("With parameters:", params);

      const [payments] = await pool.execute(query, params);

      console.log(`Found ${payments.length} cancelled payments`);
      res.json(payments);
    } catch (error) {
      console.error("Cancelled payments fetch error:", error);
      res.status(500).json({ error: "Failed to fetch cancelled payments" });
    }
  }
);

// Test endpoint to verify payment status updates
app.get('/api/payments/:id/verify', authenticateToken, async (req, res) => {
  try {
    const { id: paymentId } = req.params;
    const numericPaymentId = parseInt(paymentId);
    
    if (isNaN(numericPaymentId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment ID format' 
      });
    }

    const [result] = await pool.execute(
      'SELECT payment_id, payment_status, notes, updated_at FROM payments WHERE payment_id = ?',
      [numericPaymentId]
    );

    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }

    res.json({ 
      success: true, 
      payment: result[0] 
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Utility function to log payment status changes for debugging
const logPaymentStatusChange = async (paymentId, oldStatus, newStatus, processedBy, notes) => {
  try {
    await pool.execute(
      `INSERT INTO payment_status_log (payment_id, old_status, new_status, processed_by, notes, changed_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [paymentId, oldStatus || 'unknown', newStatus, processedBy, notes || null]
    );
  } catch (error) {
    console.error('Failed to log payment status change:', error);
    // Don't throw error as this is just for logging
  }
};

// GET /api/payments/cancelled - Get cancelled/failed payments
// app.get(
//   "/api/payments/cancelled",
//   authenticateToken,
//   authorize(["admin", "staff"]),
//   async (req, res) => {
//     try {
//       const { name_sort, student_search, date_range } = req.query;

//       let query = `
//         SELECT 
//           p.payment_id, 
//           p.payment_amount, 
//           p.processing_fee, 
//           p.payment_date, 
//           p.payment_status,
//           p.reference_number, 
//           p.notes,
//           p.created_at,
//           p.updated_at,
//           pm.method_name,
//           sa.account_id,
//           sa.total_due, 
//           sa.balance,
//           s.student_id, 
//           per.first_name, 
//           per.last_name,
//           per.email,
//           c.course_name, 
//           co.batch_identifier,
//           co.offering_id,
//           pm.method_id,
//           ci_phone.contact_value as phone,
//           staff_per.first_name as processed_by_first_name,
//           staff_per.last_name as processed_by_last_name
//         FROM payments p
//         JOIN payment_methods pm ON p.method_id = pm.method_id
//         JOIN student_accounts sa ON p.account_id = sa.account_id
//         JOIN students s ON sa.student_id = s.student_id
//         JOIN persons per ON s.person_id = per.person_id
//         JOIN course_offerings co ON sa.offering_id = co.offering_id
//         JOIN courses c ON co.course_id = c.course_id
//         LEFT JOIN contact_info ci_phone ON s.person_id = ci_phone.person_id 
//           AND ci_phone.contact_type = 'phone' 
//           AND ci_phone.is_primary = TRUE
//         LEFT JOIN staff st ON p.processed_by = st.staff_id
//         LEFT JOIN persons staff_per ON st.person_id = staff_per.person_id
//         WHERE p.payment_status IN ('failed', 'cancelled')
//       `;

//       const params = [];

//       // Filter by student name search
//       if (student_search) {
//         query +=
//           " AND (per.first_name LIKE ? OR per.last_name LIKE ? OR s.student_id LIKE ?)";
//         const searchParam = `%${student_search}%`;
//         params.push(searchParam, searchParam, searchParam);
//       }

//       // Filter by date range
//       if (date_range && date_range !== "all") {
//         const now = new Date();
//         let filterDate = new Date();

//         switch (date_range) {
//           case "week":
//             filterDate.setDate(now.getDate() - 7);
//             break;
//           case "month":
//             filterDate.setMonth(now.getMonth() - 1);
//             break;
//           case "quarter":
//             filterDate.setMonth(now.getMonth() - 3);
//             break;
//           case "year":
//             filterDate.setFullYear(now.getFullYear() - 1);
//             break;
//         }

//         query += " AND p.updated_at >= ?";
//         params.push(filterDate.toISOString().split("T")[0]);
//       }

//       // Sort by student name or payment date
//       if (name_sort) {
//         query += ` ORDER BY per.first_name ${
//           name_sort === "ascending" ? "ASC" : "DESC"
//         }, per.last_name ${name_sort === "ascending" ? "ASC" : "DESC"}`;
//       } else {
//         query += " ORDER BY p.updated_at DESC, p.created_at DESC";
//       }

//       console.log("Executing cancelled payments query:", query);
//       console.log("With parameters:", params);

//       const [payments] = await pool.execute(query, params);

//       console.log(`Found ${payments.length} cancelled payments`);
//       res.json(payments);
//     } catch (error) {
//       console.error("Cancelled payments fetch error:", error);
//       res.status(500).json({ error: "Failed to fetch cancelled payments" });
//     }
//   }
// );

// GET /api/payments/statistics - Get payment statistics
app.get(
  "/api/payments/statistics",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const [stats] = await pool.execute(`
        SELECT 
          COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN payment_status = 'confirmed' THEN 1 END) as confirmed_count,
          COUNT(CASE WHEN payment_status = 'failed' THEN 1 END) as failed_count,
          COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN payment_amount END), 0) as pending_amount,
          COALESCE(SUM(CASE WHEN payment_status = 'confirmed' THEN payment_amount END), 0) as confirmed_amount,
          COALESCE(SUM(CASE WHEN payment_status = 'failed' THEN payment_amount END), 0) as failed_amount,
          COUNT(*) as total_payments,
          COALESCE(SUM(payment_amount), 0) as total_amount
        FROM payments
        WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `);

      const [dailyStats] = await pool.execute(`
        SELECT 
          DATE(payment_date) as payment_date,
          COUNT(*) as count,
          SUM(payment_amount) as amount,
          payment_status
        FROM payments
        WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(payment_date), payment_status
        ORDER BY payment_date DESC
      `);

      res.json({
        summary: stats[0],
        daily_breakdown: dailyStats,
      });
    } catch (error) {
      console.error("Payment statistics error:", error);
      res.status(500).json({ error: "Failed to fetch payment statistics" });
    }
  }
);

// POST /api/payments/bulk-update - Bulk update payment statuses
app.post(
  "/api/payments/bulk-update",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("payment_ids").isArray({ min: 1 }),
    body("status").isIn(["confirmed", "failed", "cancelled"]),
    body("notes").optional().trim().isLength({ max: 1000 }),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const { payment_ids, status, notes } = req.body;

      // Get staff_id for processed_by
      const [staffRows] = await connection.execute(
        "SELECT staff_id FROM staff WHERE account_id = ?",
        [req.user.accountId]
      );

      const staffId = staffRows[0]?.staff_id;

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const paymentId of payment_ids) {
        try {
          // Check if payment exists
          const [paymentCheck] = await connection.execute(
            "SELECT payment_id FROM payments WHERE payment_id = ?",
            [paymentId]
          );

          if (paymentCheck.length === 0) {
            errors.push({ payment_id: paymentId, error: "Payment not found" });
            errorCount++;
            continue;
          }

          // Use stored procedure to update payment status
          await connection.execute("CALL UpdatePaymentStatus(?, ?, ?, ?)", [
            paymentId,
            status,
            staffId,
            notes || null,
          ]);

          successCount++;
        } catch (error) {
          errors.push({ payment_id: paymentId, error: error.message });
          errorCount++;
        }
      }

      if (errorCount > 0 && successCount === 0) {
        await connection.rollback();
        return res.status(400).json({
          error: "All payment updates failed",
          errors: errors,
        });
      }

      await connection.commit();

      res.json({
        message: `Bulk update completed. ${successCount} successful, ${errorCount} failed.`,
        success_count: successCount,
        error_count: errorCount,
        errors: errors,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Bulk payment update error:", error);
      res.status(500).json({
        error: "Failed to perform bulk update",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      connection.release();
    }
  }
);

// GET /api/payments/:paymentId/activity - Get payment activity log
app.get(
  "/api/payments/:paymentId/activity",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { paymentId } = req.params;

      const [activities] = await pool.execute(
        `
        SELECT 
          pal.log_id,
          pal.action,
          pal.old_status,
          pal.new_status,
          pal.notes,
          pal.created_at,
          p.first_name as performed_by_first_name,
          p.last_name as performed_by_last_name
        FROM payment_activity_logs pal
        LEFT JOIN staff s ON pal.performed_by = s.staff_id
        LEFT JOIN persons p ON s.person_id = p.person_id
        WHERE pal.payment_id = ?
        ORDER BY pal.created_at DESC
      `,
        [paymentId]
      );

      res.json(activities);
    } catch (error) {
      console.error("Payment activity fetch error:", error);
      res.status(500).json({ error: "Failed to fetch payment activity" });
    }
  }
);

// GET /api/students/:studentId/payment-history - Get student payment history
app.get(
  "/api/students/:studentId/payment-history",
  authenticateToken,
  authorize(["admin", "staff", "student"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [payments] = await pool.execute(
        `
        SELECT 
          p.payment_id,
          p.payment_amount,
          p.processing_fee,
          p.payment_date,
          p.payment_status,
          p.reference_number,
          p.notes,
          p.created_at,
          p.updated_at,
          pm.method_name,
          c.course_name,
          co.batch_identifier,
          sa.total_due,
          sa.amount_paid,
          sa.balance
        FROM payments p
        JOIN payment_methods pm ON p.method_id = pm.method_id
        JOIN student_accounts sa ON p.account_id = sa.account_id
        JOIN course_offerings co ON sa.offering_id = co.offering_id
        JOIN courses c ON co.course_id = c.course_id
        WHERE sa.student_id = ?
        ORDER BY p.payment_date DESC
      `,
        [studentId]
      );

      res.json(payments);
    } catch (error) {
      console.error("Student payment history fetch error:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch student payment history" });
    }
  }
);

app.get(
  "/api/students/:studentId/documents",
  authenticateToken,
  authorize(["admin", "staff", "student"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [documents] = await pool.execute(
        `
      SELECT sd.document_id, sd.original_filename, sd.upload_date, sd.verification_status,
             sd.verified_date, sd.verification_notes,
             dt.type_name as document_type, dt.is_required, dt.category
      FROM student_documents sd
      JOIN document_types dt ON sd.document_type_id = dt.document_type_id
      WHERE sd.student_id = ? AND sd.is_current = TRUE
      ORDER BY dt.is_required DESC, sd.upload_date DESC
    `,
        [studentId]
      );

      res.json(documents);
    } catch (error) {
      console.error("Student documents fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student documents" });
    }
  }
);

// FIXED: Enhanced student search endpoint with better error handling and database query
app.get(
  "/api/students/search",
  authenticateToken,
  authorize(["admin", "staff"]), // Only admin/staff can search students
  async (req, res) => {
    try {
      const { q } = req.query; // search query parameter

      console.log("Student search request:", { query: q, user: req.user.role });

      // Return empty array for short queries
      if (!q || q.length < 2) {
        console.log("Search query too short:", q);
        return res.json([]);
      }

      const searchTerm = `%${q}%`;
      console.log("Searching with term:", searchTerm);

      // FIXED: Enhanced query with better error handling and proper joins
      const [students] = await pool.execute(
        `
        SELECT 
          s.student_id, 
          s.account_id, 
          s.graduation_status, 
          s.academic_standing,
          p.first_name, 
          p.last_name, 
          p.email,
          p.person_id,
          tl.level_name as current_trading_level,
          CONCAT(p.first_name, ' ', p.last_name) as full_name
        FROM students s
        INNER JOIN persons p ON s.person_id = p.person_id
        LEFT JOIN student_trading_levels stl ON s.student_id = stl.student_id AND stl.is_current = TRUE
        LEFT JOIN trading_levels tl ON stl.level_id = tl.level_id
        WHERE (
          p.first_name LIKE ? OR 
          p.last_name LIKE ? OR 
          s.student_id LIKE ? OR
          CONCAT(p.first_name, ' ', p.last_name) LIKE ?
        )
        AND s.graduation_status != 'expelled'
        ORDER BY p.first_name ASC, p.last_name ASC
        LIMIT 15
        `,
        [searchTerm, searchTerm, searchTerm, searchTerm] // Four parameters for the four LIKE clauses
      );

      console.log(`Found ${students.length} students matching search criteria`);

      // FIXED: Enhanced response with more details
      const enhancedResults = students.map((student) => ({
        student_id: student.student_id,
        account_id: student.account_id,
        person_id: student.person_id,
        first_name: student.first_name,
        last_name: student.last_name,
        full_name: student.full_name,
        email: student.email,
        graduation_status: student.graduation_status,
        academic_standing: student.academic_standing,
        current_trading_level: student.current_trading_level || "Not assigned",
      }));

      res.json(enhancedResults);
    } catch (error) {
      console.error("Student search error:", error);
      console.error("Error stack:", error.stack);

      // FIXED: Better error response
      let errorMessage = "Failed to search students";
      let statusCode = 500;

      if (error.code === "ER_NO_SUCH_TABLE") {
        errorMessage = "Database table not found. Please check database setup.";
      } else if (error.code === "ER_BAD_FIELD_ERROR") {
        errorMessage = "Database field error. Please check database schema.";
      } else if (error.code === "ECONNREFUSED") {
        errorMessage =
          "Database connection refused. Please check database server.";
        statusCode = 503;
      } else if (error.code === "ER_ACCESS_DENIED_ERROR") {
        errorMessage =
          "Database access denied. Please check database credentials.";
        statusCode = 503;
      }

      res.status(statusCode).json({
        error: errorMessage,
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// ALTERNATIVE: Fallback search endpoint with simpler query if the above fails
app.get(
  "/api/students/search/simple",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { q } = req.query;

      if (!q || q.length < 2) {
        return res.json([]);
      }

      console.log("Using simple search fallback for:", q);

      // Simpler query that should work even with sync issues
      const searchTerm = `%${q}%`;

      const [students] = await pool.execute(
        `
        SELECT DISTINCT
          s.student_id,
          s.account_id,
          p.first_name,
          p.last_name,
          p.email
        FROM students s, persons p
        WHERE s.person_id = p.person_id
        AND (
          p.first_name LIKE ? OR 
          p.last_name LIKE ? OR 
          s.student_id LIKE ?
        )
        ORDER BY p.first_name, p.last_name
        LIMIT 10
        `,
        [searchTerm, searchTerm, searchTerm]
      );

      console.log(`Simple search found ${students.length} students`);

      res.json(
        students.map((student) => ({
          student_id: student.student_id,
          account_id: student.account_id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
          full_name: `${student.first_name} ${student.last_name}`,
        }))
      );
    } catch (error) {
      console.error("Simple student search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  }
);

// DIAGNOSTIC: Endpoint to check database relationships
app.get(
  "/api/debug/student-relationships",
  authenticateToken,
  authorize(["admin"]),
  async (req, res) => {
    try {
      // Check students table
      const [studentsCount] = await pool.execute(
        "SELECT COUNT(*) as count FROM students"
      );

      // Check persons table
      const [personsCount] = await pool.execute(
        "SELECT COUNT(*) as count FROM persons"
      );

      // Check relationship integrity
      const [orphanedStudents] = await pool.execute(`
        SELECT s.student_id, s.person_id, s.account_id
        FROM students s
        LEFT JOIN persons p ON s.person_id = p.person_id
        WHERE p.person_id IS NULL
        LIMIT 10
      `);

      // Check ID mismatches
      const [idMismatches] = await pool.execute(`
        SELECT s.student_id, s.person_id, s.account_id, p.person_id as actual_person_id
        FROM students s
        JOIN persons p ON s.person_id = p.person_id
        WHERE s.person_id != s.account_id
        LIMIT 10
      `);

      // Sample working students
      const [sampleStudents] = await pool.execute(`
        SELECT s.student_id, s.person_id, s.account_id, p.first_name, p.last_name, p.email
        FROM students s
        JOIN persons p ON s.person_id = p.person_id
        LIMIT 5
      `);

      res.json({
        summary: {
          total_students: studentsCount[0].count,
          total_persons: personsCount[0].count,
          orphaned_students: orphanedStudents.length,
          id_mismatches: idMismatches.length,
        },
        issues: {
          orphaned_students: orphanedStudents,
          id_mismatches: idMismatches,
        },
        sample_working_students: sampleStudents,
      });
    } catch (error) {
      console.error("Database relationship check error:", error);
      res.status(500).json({
        error: "Failed to check database relationships",
        details: error.message,
      });
    }
  }
);

// DIAGNOSTIC: Test search functionality
app.get(
  "/api/debug/test-search",
  authenticateToken,
  authorize(["admin"]),
  async (req, res) => {
    try {
      // Test basic student query
      const [basicTest] = await pool.execute(`
        SELECT s.student_id, p.first_name, p.last_name 
        FROM students s
        JOIN persons p ON s.person_id = p.person_id
        LIMIT 3
      `);

      // Test search with a simple term
      const [searchTest] = await pool.execute(`
        SELECT s.student_id, p.first_name, p.last_name, p.email
        FROM students s
        JOIN persons p ON s.person_id = p.person_id
        WHERE p.first_name LIKE '%a%'
        LIMIT 5
      `);

      res.json({
        basic_query_works: basicTest.length > 0,
        basic_results: basicTest,
        search_query_works: searchTest.length > 0,
        search_results: searchTest,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Search test error:", error);
      res.status(500).json({
        error: "Search test failed",
        details: error.message,
        code: error.code,
      });
    }
  }
);

// ============================================================================
// COMPETENCY AND PROGRESS ROUTES (Fixed)
// ============================================================================

app.get(
  "/api/competency-assessments",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { competency_type, student_search, passed } = req.query;

      let query = `
      SELECT sp.progress_id, sp.score, sp.max_score, sp.percentage_score, sp.passed, 
             sp.attempt_number, sp.attempt_date, sp.feedback,
             comp.competency_name, ct.type_name as competency_type,
             s.student_id, per.first_name, per.last_name,
             c.course_name, co.batch_identifier,
             staff_per.first_name as assessed_by_first_name, staff_per.last_name as assessed_by_last_name
      FROM student_progress sp
      JOIN student_enrollments se ON sp.enrollment_id = se.enrollment_id
      JOIN students s ON se.student_id = s.student_id
      JOIN persons per ON s.person_id = per.person_id
      JOIN course_offerings co ON se.offering_id = co.offering_id
      JOIN courses c ON co.course_id = c.course_id
      JOIN competencies comp ON sp.competency_id = comp.competency_id
      JOIN competency_types ct ON comp.competency_type_id = ct.competency_type_id
      LEFT JOIN staff st ON sp.assessed_by = st.staff_id
      LEFT JOIN persons staff_per ON st.person_id = staff_per.person_id
      WHERE 1=1
    `;
      const params = [];

      if (competency_type) {
        query += " AND ct.type_name = ?";
        params.push(competency_type);
      }

      if (passed !== undefined) {
        query += " AND sp.passed = ?";
        params.push(passed === "true");
      }

      if (student_search) {
        query +=
          " AND (per.first_name LIKE ? OR per.last_name LIKE ? OR s.student_id LIKE ?)";
        const searchParam = `%${student_search}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      query += " ORDER BY sp.attempt_date DESC";

      const [assessments] = await pool.execute(query, params);
      res.json(assessments);
    } catch (error) {
      console.error("Competency assessments fetch error:", error);
      res.status(500).json({ error: "Failed to fetch competency assessments" });
    }
  }
);

app.post(
  "/api/competency-assessments",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("enrollment_id").isInt(),
    body("competency_id").isInt(),
    body("score").isFloat({ min: 0 }),
    body("max_score").isFloat({ min: 0.01 }),
    body("feedback").optional().trim().isLength({ max: 1000 }),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { enrollment_id, competency_id, score, max_score, feedback } =
        req.body;

      const [attemptRows] = await pool.execute(
        `
      SELECT COALESCE(MAX(attempt_number), 0) + 1 as next_attempt
      FROM student_progress
      WHERE enrollment_id = ? AND competency_id = ?
    `,
        [enrollment_id, competency_id]
      );

      const attempt_number = attemptRows[0].next_attempt;

      const [staffRows] = await pool.execute(
        "SELECT staff_id FROM staff WHERE account_id = ?",
        [req.user.accountId]
      );

      const staffId = staffRows[0]?.staff_id;

      await pool.execute(
        `
      INSERT INTO student_progress (enrollment_id, competency_id, attempt_number, score, max_score, assessed_by, feedback)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
        [
          enrollment_id,
          competency_id,
          attempt_number,
          score,
          max_score,
          staffId,
          feedback || null,
        ]
      );

      res.status(201).json({ message: "Assessment recorded successfully" });
    } catch (error) {
      console.error("Assessment creation error:", error);
      res.status(500).json({ error: "Failed to record assessment" });
    }
  }
);

app.get(
  "/api/students/:studentId/progress",
  authenticateToken,
  authorize(["admin", "staff", "student"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [progress] = await pool.execute(
        `
      SELECT sp.progress_id, sp.score, sp.max_score, sp.percentage_score, sp.passed, 
             sp.attempt_number, sp.attempt_date, sp.feedback,
             comp.competency_name, comp.competency_description,
             ct.type_name as competency_type, ct.passing_score,
             c.course_name, co.batch_identifier
      FROM student_progress sp
      JOIN student_enrollments se ON sp.enrollment_id = se.enrollment_id
      JOIN course_offerings co ON se.offering_id = co.offering_id
      JOIN courses c ON co.course_id = c.course_id
      JOIN competencies comp ON sp.competency_id = comp.competency_id
      JOIN competency_types ct ON comp.competency_type_id = ct.competency_type_id
      WHERE se.student_id = ?
      ORDER BY sp.attempt_date DESC
    `,
        [studentId]
      );

      res.json(progress);
    } catch (error) {
      console.error("Student progress fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student progress" });
    }
  }
);

// ============================================================================
// SCHOLARSHIP ROUTES (Fixed)
// ============================================================================

app.get(
  "/api/scholarships",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const [scholarships] = await pool.execute(`
      SELECT sp.sponsor_id, sp.sponsor_name, sp.contact_person, sp.contact_email, 
             sp.industry, sp.total_commitment, sp.current_commitment, sp.students_sponsored, sp.is_active,
             st.type_name as sponsor_type
      FROM sponsors sp
      JOIN sponsor_types st ON sp.sponsor_type_id = st.sponsor_type_id
      WHERE sp.is_active = TRUE
      ORDER BY sp.sponsor_name
    `);
      res.json(scholarships);
    } catch (error) {
      console.error("Scholarships fetch error:", error);
      res.status(500).json({ error: "Failed to fetch scholarships" });
    }
  }
);

app.post(
  "/api/scholarships",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("sponsor_name").trim().isLength({ min: 1, max: 100 }),
    body("sponsor_type_id").isInt(),
    body("contact_person").trim().isLength({ min: 1, max: 100 }),
    body("contact_email").isEmail(),
    body("total_commitment").isFloat({ min: 0 }),
  ],
  validateInput,
  async (req, res) => {
    try {
      const {
        sponsor_name,
        sponsor_type_id,
        contact_person,
        contact_email,
        contact_phone,
        address,
        website,
        industry,
        total_commitment,
        agreement_details,
        agreement_start_date,
        agreement_end_date,
      } = req.body;

      const sponsor_code = `SP${Date.now()}`;

      await pool.execute(
        `
      INSERT INTO sponsors (
        sponsor_type_id, sponsor_name, sponsor_code, contact_person, contact_email,
        contact_phone, address, website, industry, total_commitment,
        agreement_details, agreement_start_date, agreement_end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
        [
          sponsor_type_id,
          sponsor_name,
          sponsor_code,
          contact_person,
          contact_email,
          contact_phone || null,
          address || null,
          website || null,
          industry || null,
          total_commitment,
          agreement_details || null,
          agreement_start_date || null,
          agreement_end_date || null,
        ]
      );

      res.status(201).json({
        message: "Scholarship sponsor created successfully",
        sponsor_code,
      });
    } catch (error) {
      console.error("Scholarship creation error:", error);
      res.status(500).json({ error: "Failed to create scholarship sponsor" });
    }
  }
);

app.get(
  "/api/students/:studentId/scholarships",
  authenticateToken,
  authorize(["admin", "staff", "student"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [scholarships] = await pool.execute(
        `
      SELECT ss.scholarship_id, ss.scholarship_type, ss.coverage_percentage, ss.coverage_amount,
             ss.scholarship_status, ss.start_date, ss.end_date, ss.gpa_requirement,
             sp.sponsor_name, st.type_name as sponsor_type
      FROM student_scholarships ss
      JOIN sponsors sp ON ss.sponsor_id = sp.sponsor_id
      JOIN sponsor_types st ON sp.sponsor_type_id = st.sponsor_type_id
      WHERE ss.student_id = ?
      ORDER BY ss.start_date DESC
    `,
        [studentId]
      );

      res.json(scholarships);
    } catch (error) {
      console.error("Student scholarships fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student scholarships" });
    }
  }
);

// ============================================================================
// COURSE AND ENROLLMENT ROUTES (Fixed)
// ============================================================================

app.post(
  "/api/courses",
  [
    authenticateToken,
    authorize(["admin"]),
    body("course_code").trim().isLength({ min: 1, max: 20 }),
    body("course_name").trim().isLength({ min: 1, max: 100 }),
    body("course_description").optional().trim(),
    body("duration_weeks").isInt({ min: 1 }),
    body("credits").isFloat({ min: 0 }),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const {
        course_code,
        course_name,
        course_description,
        duration_weeks,
        credits,
        competencies = [],
        pricing = {},
      } = req.body;

      // Check if course code already exists
      const [existingCourse] = await connection.execute(
        "SELECT course_id FROM courses WHERE course_code = ?",
        [course_code]
      );

      if (existingCourse.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: "Course code already exists" });
      }

      // Insert course
      const [courseResult] = await connection.execute(
        `
      INSERT INTO courses (
        course_code, course_name, course_description,
        duration_weeks, credits, is_active
      ) VALUES (?, ?, ?, ?, ?, TRUE)
    `,
        [
          course_code,
          course_name,
          course_description || null,
          duration_weeks,
          credits,
        ]
      );

      const courseId = courseResult.insertId;

      // Link competencies if provided
      if (competencies.length > 0) {
        const competencyValues = competencies.map((compId, index) => [
          courseId,
          compId,
          true,
          index + 1,
          null,
        ]);

        const competencyPlaceholders = competencies
          .map(() => "(?, ?, ?, ?, ?)")
          .join(", ");

        await connection.execute(
          `
        INSERT INTO course_competencies (
          course_id, competency_id, is_required, order_sequence, estimated_hours
        ) VALUES ${competencyPlaceholders}
      `,
          competencyValues.flat()
        );
      }

      // Create default course offering
      const batchIdentifier = `${course_code}-${new Date().getFullYear()}-01`;
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + duration_weeks * 7);

      const [offeringResult] = await connection.execute(
        `
      INSERT INTO course_offerings (
        course_id, batch_identifier, start_date, end_date,
        max_enrollees, current_enrollees, status, location
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
        [
          courseId,
          batchIdentifier,
          startDate,
          endDate,
          30, // default max enrollees
          0,
          "planned",
          "Online", // default location
        ]
      );

      const offeringId = offeringResult.insertId;

      // Insert pricing if provided
      const pricingTypes = [
        "regular",
        "early_bird",
        "group",
        "scholarship",
        "special",
      ];

      for (const type of pricingTypes) {
        if (pricing[type] && parseFloat(pricing[type]) > 0) {
          let expiryDate = null;

          // Set expiry date for early bird pricing (30 days before start)
          if (type === "early_bird") {
            expiryDate = new Date(startDate);
            expiryDate.setDate(expiryDate.getDate() - 30);
          }

          await connection.execute(
            `
          INSERT INTO course_pricing (
            offering_id, pricing_type, amount, currency,
            effective_date, expiry_date, is_active
          ) VALUES (?, ?, ?, 'PHP', NOW(), ?, TRUE)
        `,
            [offeringId, type, parseFloat(pricing[type]), expiryDate]
          );
        }
      }

      await connection.commit();

      // Fetch the created course with full details
      const [newCourse] = await connection.execute(
        `
      SELECT c.*, COUNT(DISTINCT co.offering_id) as total_offerings
      FROM courses c
      LEFT JOIN course_offerings co ON c.course_id = co.course_id
      WHERE c.course_id = ?
      GROUP BY c.course_id
    `,
        [courseId]
      );

      res.status(201).json({
        message: "Course created successfully",
        course: newCourse[0],
      });
    } catch (error) {
      await connection.rollback();
      console.error("Course creation error:", error);
      res.status(500).json({
        error: "Failed to create course",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      connection.release();
    }
  }
);

// Debug endpoint to test validation
app.post(
  "/api/students/validate-debug",
  [
    authenticateToken,
    authorize(["admin", "instructor"]),
    body("first_name").trim().notEmpty().withMessage("First name is required"),
    body("last_name").trim().notEmpty().withMessage("Last name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("offering_id")
      .isInt({ min: 1 })
      .withMessage("Valid offering ID is required"),
  ],
  (req, res) => {
    const errors = validationResult(req);

    res.json({
      hasErrors: !errors.isEmpty(),
      errors: errors.array(),
      receivedData: req.body,
    });
  }
);

// Enhanced validation middleware with better error handling
const validateStudentRegistration = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log("Validation errors:", errors.array());
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

// Additional API endpoint to get available courses (not course offerings)
app.get(
  "/api/courses/available",
  [authenticateToken, authorize(["admin", "instructor"])],
  async (req, res) => {
    try {
      const [courses] = await pool.execute(`
      SELECT 
        c.*,
        COUNT(DISTINCT co.offering_id) as total_offerings,
        SUM(CASE WHEN co.status IN ('planned', 'active') 
                 AND co.end_date > NOW() THEN 1 ELSE 0 END) as available_offerings,
        MIN(CASE WHEN co.status IN ('planned', 'active') 
                 AND co.current_enrollees < co.max_enrollees 
                 AND co.end_date > NOW() THEN co.start_date END) as next_start_date
      FROM courses c
      LEFT JOIN course_offerings co ON c.course_id = co.course_id
      WHERE c.is_active = TRUE
      GROUP BY c.course_id
      HAVING available_offerings > 0
      ORDER BY c.course_name ASC
    `);

      res.json({
        message: "Available courses retrieved successfully",
        courses: courses,
      });
    } catch (error) {
      console.error("Error fetching available courses:", error);
      res.status(500).json({
        error: "Failed to fetch available courses",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

app.put(
  "/api/students/batch-reassign",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("student_ids").isArray({ min: 1 }).withMessage("At least one student ID is required"),
    body("new_batch_identifier").trim().isLength({ min: 1 }).withMessage("New batch identifier is required"),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const { student_ids, new_batch_identifier } = req.body;

      console.log('🔄 Batch reassignment request:', {
        student_count: student_ids.length,
        new_batch: new_batch_identifier,
        student_ids: student_ids
      });

      // Validate that all student IDs exist
      const placeholders = student_ids.map(() => '?').join(',');
      const [studentCheck] = await connection.execute(
        `SELECT student_id, person_id FROM students WHERE student_id IN (${placeholders})`,
        student_ids
      );

      if (studentCheck.length !== student_ids.length) {
        await connection.rollback();
        const foundIds = studentCheck.map(s => s.student_id);
        const missingIds = student_ids.filter(id => !foundIds.includes(id));
        return res.status(404).json({
          error: `Some student IDs not found: ${missingIds.join(', ')}`
        });
      }

      // Find the course offering with the new batch identifier
      const [targetOffering] = await connection.execute(
        `SELECT co.offering_id, co.course_id, co.batch_identifier, co.max_enrollees, 
                co.current_enrollees, co.status, c.course_name, c.course_code
         FROM course_offerings co
         JOIN courses c ON co.course_id = c.course_id
         WHERE co.batch_identifier = ?`,
        [new_batch_identifier]
      );

      if (targetOffering.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          error: `Course offering with batch identifier '${new_batch_identifier}' not found`
        });
      }

      const offering = targetOffering[0];

      // Check if the target offering has enough capacity
      const availableSpots = offering.max_enrollees - offering.current_enrollees;
      if (availableSpots < student_ids.length) {
        await connection.rollback();
        return res.status(400).json({
          error: `Target batch '${new_batch_identifier}' has insufficient capacity. Available: ${availableSpots}, Required: ${student_ids.length}`
        });
      }

      // Check if offering is available for enrollment
      if (offering.status === 'cancelled' || offering.status === 'completed') {
        await connection.rollback();
        return res.status(400).json({
          error: `Cannot reassign to batch '${new_batch_identifier}' with status: ${offering.status}`
        });
      }

      let successCount = 0;
      let errorCount = 0;
      const results = [];

      for (const student_id of student_ids) {
        try {
          // Get current enrollments for this student
          const [currentEnrollments] = await connection.execute(
            `SELECT se.enrollment_id, se.offering_id, co.batch_identifier, co.course_id
             FROM student_enrollments se
             JOIN course_offerings co ON se.offering_id = co.offering_id
             WHERE se.student_id = ? AND se.enrollment_status = 'enrolled'`,
            [student_id]
          );

          // Check if student is already in the target batch
          const alreadyInTargetBatch = currentEnrollments.some(
            enrollment => enrollment.batch_identifier === new_batch_identifier
          );

          if (alreadyInTargetBatch) {
            results.push({
              student_id,
              status: 'skipped',
              message: 'Already in target batch'
            });
            continue;
          }

          // Find enrollment in the same course as target offering
          const relevantEnrollment = currentEnrollments.find(
            enrollment => enrollment.course_id === offering.course_id
          );

          if (relevantEnrollment) {
            // Update existing enrollment to new offering
            await connection.execute(
              `UPDATE student_enrollments 
               SET offering_id = ?, updated_at = NOW()
               WHERE enrollment_id = ?`,
              [offering.offering_id, relevantEnrollment.enrollment_id]
            );

            // Update student account if it exists
            const [accountCheck] = await connection.execute(
              `SELECT account_id FROM student_accounts 
               WHERE student_id = ? AND offering_id = ?`,
              [student_id, relevantEnrollment.offering_id]
            );

            if (accountCheck.length > 0) {
              await connection.execute(
                `UPDATE student_accounts 
                 SET offering_id = ?, updated_at = NOW()
                 WHERE student_id = ? AND offering_id = ?`,
                [offering.offering_id, student_id, relevantEnrollment.offering_id]
              );
            }

            // Decrease count from old offering
            await connection.execute(
              `UPDATE course_offerings 
               SET current_enrollees = GREATEST(0, current_enrollees - 1), updated_at = NOW()
               WHERE offering_id = ?`,
              [relevantEnrollment.offering_id]
            );

            results.push({
              student_id,
              status: 'moved',
              message: `Moved from batch ${relevantEnrollment.batch_identifier} to ${new_batch_identifier}`
            });

          } else {
            // Create new enrollment in target offering
            await connection.execute(
              `INSERT INTO student_enrollments (
                student_id, offering_id, enrollment_date, enrollment_status, 
                completion_percentage, attendance_percentage
              ) VALUES (?, ?, NOW(), 'enrolled', 0.00, NULL)`,
              [student_id, offering.offering_id]
            );

            // Create student account for the new enrollment if pricing exists
            const [pricingData] = await connection.execute(
              `SELECT amount FROM course_pricing 
               WHERE offering_id = ? AND pricing_type = 'regular' AND is_active = TRUE
               ORDER BY effective_date DESC LIMIT 1`,
              [offering.offering_id]
            );

            const totalDue = pricingData.length > 0 ? parseFloat(pricingData[0].amount) : 0;
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30); // 30 days from now

            await connection.execute(
              `INSERT INTO student_accounts (
                student_id, offering_id, total_due, amount_paid, balance,
                account_status, due_date, created_at, updated_at
              ) VALUES (?, ?, ?, 0.00, ?, 'active', ?, NOW(), NOW())`,
              [student_id, offering.offering_id, totalDue, totalDue, dueDate]
            );

            results.push({
              student_id,
              status: 'enrolled',
              message: `Newly enrolled in batch ${new_batch_identifier}`
            });
          }

          successCount++;

        } catch (studentError) {
          console.error(`Error processing student ${student_id}:`, studentError);
          results.push({
            student_id,
            status: 'error',
            message: studentError.message
          });
          errorCount++;
        }
      }

      // Update target offering enrollment count
      await connection.execute(
        `UPDATE course_offerings 
         SET current_enrollees = current_enrollees + ?, updated_at = NOW()
         WHERE offering_id = ?`,
        [successCount, offering.offering_id]
      );

      // Log the batch reassignment activity
      const staffQuery = await connection.execute(
        "SELECT staff_id FROM staff WHERE account_id = ?",
        [req.user.accountId]
      );
      const staffId = staffQuery[0]?.[0]?.staff_id;

      if (staffId) {
        await connection.execute(
          `INSERT INTO activity_logs (account_id, action, description, created_at)
           VALUES (?, 'batch_reassignment', ?, NOW())`,
          [req.user.accountId, 
           `Reassigned ${successCount} students to batch ${new_batch_identifier}. ${errorCount} errors.`]
        );
      }

      await connection.commit();
      console.log('✅ Batch reassignment completed successfully');

      res.json({
        success: true,
        message: `Batch reassignment completed. ${successCount} successful, ${errorCount} failed.`,
        target_batch: {
          batch_identifier: new_batch_identifier,
          course_name: offering.course_name,
          course_code: offering.course_code
        },
        summary: {
          total_processed: student_ids.length,
          successful: successCount,
          failed: errorCount,
          skipped: results.filter(r => r.status === 'skipped').length
        },
        results: results
      });

    } catch (error) {
      await connection.rollback();
      console.error('❌ Batch reassignment error:', error);
      
      res.status(500).json({
        success: false,
        error: "Failed to reassign students to new batch",
        message: error.message,
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    } finally {
      connection.release();
    }
  }
);

// GET /api/batches - Get all available batches with student counts
app.get(
  "/api/batches",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const [batches] = await pool.execute(`
        SELECT 
          co.offering_id,
          co.batch_identifier,
          co.start_date,
          co.end_date,
          co.status,
          co.max_enrollees,
          co.current_enrollees,
          co.location,
          c.course_id,
          c.course_code,
          c.course_name,
          COUNT(DISTINCT se.student_id) as actual_enrolled_count
        FROM course_offerings co
        JOIN courses c ON co.course_id = c.course_id
        LEFT JOIN student_enrollments se ON co.offering_id = se.offering_id 
          AND se.enrollment_status = 'enrolled'
        WHERE c.is_active = TRUE
        GROUP BY co.offering_id, co.batch_identifier, co.start_date, co.end_date, 
                 co.status, co.max_enrollees, co.current_enrollees, co.location,
                 c.course_id, c.course_code, c.course_name
        ORDER BY c.course_name, co.start_date DESC
      `);

      res.json({
        message: "Batches retrieved successfully",
        batches: batches
      });
    } catch (error) {
      console.error("Batches fetch error:", error);
      res.status(500).json({ error: "Failed to fetch batches" });
    }
  }
);

// GET /api/batches/:batchIdentifier/students - Get students in a specific batch
app.get(
  "/api/batches/:batchIdentifier/students",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { batchIdentifier } = req.params;

      const [students] = await pool.execute(`
        SELECT 
          s.student_id,
          p.first_name,
          p.last_name,
          p.email,
          se.enrollment_date,
          se.enrollment_status,
          se.completion_percentage,
          se.attendance_percentage,
          c.course_code,
          c.course_name,
          co.batch_identifier,
          tl.level_name as trading_level
        FROM student_enrollments se
        JOIN students s ON se.student_id = s.student_id
        JOIN persons p ON s.person_id = p.person_id
        JOIN course_offerings co ON se.offering_id = co.offering_id
        JOIN courses c ON co.course_id = c.course_id
        LEFT JOIN student_trading_levels stl ON s.student_id = stl.student_id AND stl.is_current = TRUE
        LEFT JOIN trading_levels tl ON stl.level_id = tl.level_id
        WHERE co.batch_identifier = ?
        ORDER BY p.last_name, p.first_name
      `, [batchIdentifier]);

      res.json({
        message: "Batch students retrieved successfully",
        batch_identifier: batchIdentifier,
        student_count: students.length,
        students: students
      });
    } catch (error) {
      console.error("Batch students fetch error:", error);
      res.status(500).json({ error: "Failed to fetch batch students" });
    }
  }
);

app.get(
  "/api/batches-with-students",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const [batches] = await pool.execute(`
        SELECT
          co.offering_id,
          co.batch_identifier,
          co.start_date,
          co.end_date,
          co.status,
          co.max_enrollees,
          co.current_enrollees,
          co.location,
          c.course_id,
          c.course_code,
          c.course_name,
          COUNT(se.student_id) as actual_enrolled_count,
          GROUP_CONCAT(
            CONCAT(p.first_name, ' ', p.last_name) 
            ORDER BY p.first_name ASC 
            SEPARATOR ', '
          ) as enrolled_student_names
        FROM course_offerings co
        JOIN courses c ON co.course_id = c.course_id
        INNER JOIN student_enrollments se ON co.offering_id = se.offering_id
          AND se.enrollment_status = 'enrolled'
        INNER JOIN students s ON se.student_id = s.student_id
        INNER JOIN persons p ON s.person_id = p.person_id
        WHERE c.is_active = TRUE
        GROUP BY co.offering_id, co.batch_identifier, co.start_date, co.end_date,
                 co.status, co.max_enrollees, co.current_enrollees, co.location,
                 c.course_id, c.course_code, c.course_name
        HAVING actual_enrolled_count > 0
        ORDER BY c.course_name, co.start_date DESC
      `);

      console.log(`Found ${batches.length} batches with enrolled students`);
      
      res.json({
        success: true,
        message: "Batches with enrolled students retrieved successfully",
        total_batches: batches.length,
        batches: batches.map(batch => ({
          offering_id: batch.offering_id,
          batch_identifier: batch.batch_identifier,
          start_date: batch.start_date,
          end_date: batch.end_date,
          status: batch.status,
          max_enrollees: batch.max_enrollees,
          current_enrollees: batch.current_enrollees,
          actual_enrolled_count: batch.actual_enrolled_count,
          location: batch.location,
          course: {
            course_id: batch.course_id,
            course_code: batch.course_code,
            course_name: batch.course_name,
            display_name: `${batch.course_code} - ${batch.course_name}`
          },
          enrolled_students: batch.enrolled_student_names,
          capacity_utilization: ((batch.actual_enrolled_count / batch.max_enrollees) * 100).toFixed(1)
        }))
      });
    } catch (error) {
      console.error("Batches with students fetch error:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch batches with enrolled students",
        message: error.message 
      });
    }
  }
);

// Alternative endpoint that accepts query parameters for filtering
app.get(
  "/api/batches-with-students/filtered",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { course_id, status, min_enrollees, batch_identifier } = req.query;
      
      let query = `
        SELECT
          co.offering_id,
          co.batch_identifier,
          co.start_date,
          co.end_date,
          co.status,
          co.max_enrollees,
          co.current_enrollees,
          co.location,
          c.course_id,
          c.course_code,
          c.course_name,
          COUNT(se.student_id) as actual_enrolled_count,
          GROUP_CONCAT(
            CONCAT(p.first_name, ' ', p.last_name) 
            ORDER BY p.first_name ASC 
            SEPARATOR ', '
          ) as enrolled_student_names
        FROM course_offerings co
        JOIN courses c ON co.course_id = c.course_id
        INNER JOIN student_enrollments se ON co.offering_id = se.offering_id
          AND se.enrollment_status = 'enrolled'
        INNER JOIN students s ON se.student_id = s.student_id
        INNER JOIN persons p ON s.person_id = p.person_id
        WHERE c.is_active = TRUE
      `;

      const params = [];
      const conditions = [];

      if (course_id) {
        conditions.push("c.course_id = ?");
        params.push(course_id);
      }

      if (status) {
        conditions.push("co.status = ?");
        params.push(status);
      }

      if (batch_identifier) {
        conditions.push("co.batch_identifier LIKE ?");
        params.push(`%${batch_identifier}%`);
      }

      if (conditions.length > 0) {
        query += " AND " + conditions.join(" AND ");
      }

      query += `
        GROUP BY co.offering_id, co.batch_identifier, co.start_date, co.end_date,
                 co.status, co.max_enrollees, co.current_enrollees, co.location,
                 c.course_id, c.course_code, c.course_name
        HAVING actual_enrolled_count > 0
      `;

      if (min_enrollees) {
        query += ` AND actual_enrolled_count >= ${parseInt(min_enrollees)}`;
      }

      query += " ORDER BY c.course_name, co.start_date DESC";

      console.log("Executing filtered batches query:", query);
      console.log("With parameters:", params);

      const [batches] = await pool.execute(query, params);

      res.json({
        success: true,
        message: "Filtered batches with enrolled students retrieved successfully",
        total_batches: batches.length,
        filters_applied: {
          course_id: course_id || null,
          status: status || null,
          min_enrollees: min_enrollees || null,
          batch_identifier: batch_identifier || null
        },
        batches: batches.map(batch => ({
          offering_id: batch.offering_id,
          batch_identifier: batch.batch_identifier,
          start_date: batch.start_date,
          end_date: batch.end_date,
          status: batch.status,
          max_enrollees: batch.max_enrollees,
          current_enrollees: batch.current_enrollees,
          actual_enrolled_count: batch.actual_enrolled_count,
          location: batch.location,
          course: {
            course_id: batch.course_id,
            course_code: batch.course_code,
            course_name: batch.course_name,
            display_name: `${batch.course_code} - ${batch.course_name}`
          },
          enrolled_students: batch.enrolled_student_names,
          capacity_utilization: ((batch.actual_enrolled_count / batch.max_enrollees) * 100).toFixed(1)
        }))
      });
    } catch (error) {
      console.error("Filtered batches with students fetch error:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch filtered batches with enrolled students",
        message: error.message 
      });
    }
  }
);

// POST /api/batches/create - Create a new batch (course offering)
app.post(
  "/api/batches/create",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("course_id").isInt({ min: 1 }).withMessage("Valid course ID is required"),
    body("batch_identifier").trim().isLength({ min: 1 }).withMessage("Batch identifier is required"),
    body("start_date").isISO8601().withMessage("Valid start date is required"),
    body("max_enrollees").isInt({ min: 1 }).withMessage("Maximum enrollees must be at least 1"),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const {
        course_id,
        batch_identifier,
        start_date,
        end_date,
        max_enrollees,
        location = "Online",
        instructor_id
      } = req.body;

      // Check if batch identifier already exists
      const [existingBatch] = await connection.execute(
        "SELECT offering_id FROM course_offerings WHERE batch_identifier = ?",
        [batch_identifier]
      );

      if (existingBatch.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          error: `Batch identifier '${batch_identifier}' already exists`
        });
      }

      // Verify course exists
      const [courseCheck] = await connection.execute(
        "SELECT course_id, course_name, duration_weeks FROM courses WHERE course_id = ? AND is_active = TRUE",
        [course_id]
      );

      if (courseCheck.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          error: "Course not found or inactive"
        });
      }

      const course = courseCheck[0];

      // Calculate end date if not provided
      let calculatedEndDate = end_date;
      if (!calculatedEndDate) {
        const startDateObj = new Date(start_date);
        const endDateObj = new Date(startDateObj);
        endDateObj.setDate(startDateObj.getDate() + (course.duration_weeks * 7));
        calculatedEndDate = endDateObj.toISOString().split('T')[0];
      }

      // Create the new batch
      const [result] = await connection.execute(`
        INSERT INTO course_offerings (
          course_id, batch_identifier, start_date, end_date, max_enrollees,
          current_enrollees, status, location, instructor_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, 'planned', ?, ?, NOW(), NOW())
      `, [course_id, batch_identifier, start_date, calculatedEndDate, max_enrollees, location, instructor_id || null]);

      const offeringId = result.insertId;

      // Copy pricing from the latest offering of the same course
      const [latestPricing] = await connection.execute(`
        SELECT cp.pricing_type, cp.amount, cp.currency
        FROM course_pricing cp
        JOIN course_offerings co ON cp.offering_id = co.offering_id
        WHERE co.course_id = ? AND cp.is_active = TRUE
        ORDER BY cp.effective_date DESC
        LIMIT 5
      `, [course_id]);

      if (latestPricing.length > 0) {
        for (const pricing of latestPricing) {
          await connection.execute(`
            INSERT INTO course_pricing (
              offering_id, pricing_type, amount, currency, effective_date, is_active
            ) VALUES (?, ?, ?, ?, NOW(), TRUE)
          `, [offeringId, pricing.pricing_type, pricing.amount, pricing.currency]);
        }
      } else {
        // Create default pricing
        await connection.execute(`
          INSERT INTO course_pricing (
            offering_id, pricing_type, amount, currency, effective_date, is_active
          ) VALUES (?, 'regular', 0, 'PHP', NOW(), TRUE)
        `, [offeringId]);
      }

      await connection.commit();

      res.status(201).json({
        success: true,
        message: "New batch created successfully",
        batch: {
          offering_id: offeringId,
          course_id: course_id,
          course_name: course.course_name,
          batch_identifier: batch_identifier,
          start_date: start_date,
          end_date: calculatedEndDate,
          max_enrollees: max_enrollees,
          current_enrollees: 0,
          status: 'planned',
          location: location
        }
      });

    } catch (error) {
      await connection.rollback();
      console.error("Batch creation error:", error);
      res.status(500).json({
        error: "Failed to create new batch",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      connection.release();
    }
  }
);

// Backend: Fixed PUT /api/courses/:courseId endpoint
app.put(
  "/api/courses/:courseId",
  [
    authenticateToken,
    authorize(["admin"]),
    body("course_code").optional().trim().isLength({ min: 1, max: 20 }),
    body("course_name").optional().trim().isLength({ min: 1, max: 100 }),
    body("course_description").optional().trim(),
    body("duration_weeks").optional().isInt({ min: 1 }),
    body("credits").optional().isFloat({ min: 0 }),
    body("pricing").optional().isObject(),
    body("competencies").optional().isArray(),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const { courseId } = req.params;
      const {
        course_code,
        course_name,
        course_description,
        duration_weeks,
        credits,
        competencies,
        pricing,
        is_active,
      } = req.body;

      console.log("Update request for course ID:", courseId);
      console.log("Request body:", req.body);

      if (!courseId || isNaN(parseInt(courseId))) {
        await connection.rollback();
        return res.status(400).json({ error: "Invalid course ID" });
      }

      const [existingCourse] = await connection.execute(
        "SELECT course_id FROM courses WHERE course_id = ?",
        [courseId]
      );

      if (existingCourse.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "Course not found" });
      }

      if (course_code) {
        const [duplicateCode] = await connection.execute(
          "SELECT course_id FROM courses WHERE course_code = ? AND course_id != ?",
          [course_code, courseId]
        );

        if (duplicateCode.length > 0) {
          await connection.rollback();
          return res.status(409).json({ error: "Course code already exists" });
        }
      }

      const updateFields = [];
      const updateValues = [];

      if (course_code !== undefined) {
        updateFields.push("course_code = ?");
        updateValues.push(course_code);
      }
      if (course_name !== undefined) {
        updateFields.push("course_name = ?");
        updateValues.push(course_name);
      }
      if (course_description !== undefined) {
        updateFields.push("course_description = ?");
        updateValues.push(course_description);
      }
      if (duration_weeks !== undefined) {
        updateFields.push("duration_weeks = ?");
        updateValues.push(duration_weeks);
      }
      if (credits !== undefined) {
        updateFields.push("credits = ?");
        updateValues.push(credits);
      }
      if (is_active !== undefined) {
        updateFields.push("is_active = ?");
        updateValues.push(is_active);
      }

      if (updateFields.length > 0) {
        updateFields.push("updated_at = CURRENT_TIMESTAMP");
        updateValues.push(courseId);

        await connection.execute(
          `
        UPDATE courses 
        SET ${updateFields.join(", ")}
        WHERE course_id = ?
      `,
          updateValues
        );
      }

      // Get offering_id linked to the course
      const [offeringRows] = await connection.execute(
        "SELECT offering_id FROM course_offerings WHERE course_id = ? LIMIT 1",
        [courseId]
      );

      if (offeringRows.length === 0) {
        await connection.rollback();
        return res
          .status(400)
          .json({ error: "No course offering found for this course ID" });
      }

      const offeringId = offeringRows[0].offering_id;

      // Update pricing if provided
      if (pricing && typeof pricing === "object") {
        await connection.execute(
          "DELETE FROM course_pricing WHERE offering_id = ?",
          [offeringId]
        );

        const pricingEntries = Object.entries(pricing).filter(
          ([_, value]) => value && parseFloat(value) > 0
        );

        if (pricingEntries.length > 0) {
          const pricingValues = pricingEntries.map(([type, price]) => [
            offeringId,
            type,
            parseFloat(price),
            "PHP",
            new Date(),
            null,
            1,
            true,
          ]);

          const pricingPlaceholders = pricingValues
            .map(() => "(?, ?, ?, ?, ?, ?, ?, ?)")
            .join(", ");

          await connection.execute(
            `
          INSERT INTO course_pricing (
            offering_id, pricing_type, amount, currency, effective_date,
            expiry_date, minimum_quantity, is_active
          ) VALUES ${pricingPlaceholders}
        `,
            pricingValues.flat()
          );
        }
      }

      // Update competencies if provided
      if (competencies && Array.isArray(competencies)) {
        await connection.execute(
          "DELETE FROM course_competencies WHERE course_id = ?",
          [courseId]
        );

        if (competencies.length > 0) {
          const competencyValues = competencies.map((compId, index) => [
            courseId,
            compId,
            true,
            index + 1,
            null,
          ]);

          const competencyPlaceholders = competencies
            .map(() => "(?, ?, ?, ?, ?)")
            .join(", ");

          await connection.execute(
            `
          INSERT INTO course_competencies (
            course_id, competency_id, is_required, order_sequence, estimated_hours
          ) VALUES ${competencyPlaceholders}
        `,
            competencyValues.flat()
          );
        }
      }

      await connection.commit();

      // Fetch updated course with all related data
      const [updatedCourse] = await connection.execute(
        `
      SELECT c.*, 
             COUNT(DISTINCT cc.competency_id) as total_competencies,
             GROUP_CONCAT(DISTINCT CONCAT(cp.pricing_type, ':', cp.amount) SEPARATOR '|') as pricing_data
      FROM courses c
      LEFT JOIN course_competencies cc ON c.course_id = cc.course_id
      LEFT JOIN course_offerings co ON c.course_id = co.course_id
      LEFT JOIN course_pricing cp ON co.offering_id = cp.offering_id AND cp.is_active = true
      WHERE c.course_id = ?
      GROUP BY c.course_id
    `,
        [courseId]
      );

      const courseData = updatedCourse[0];
      if (courseData.pricing_data) {
        const pricingObj = {};
        courseData.pricing_data.split("|").forEach((item) => {
          const [type, price] = item.split(":");
          pricingObj[type] = parseFloat(price);
        });
        courseData.pricing = pricingObj;
      } else {
        courseData.pricing = {};
      }
      delete courseData.pricing_data;

      res.json({
        message: "Course updated successfully",
        course: courseData,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Course update error:", error);
      console.error("Error stack:", error.stack);

      res.status(500).json({
        error: "Failed to update course",
        message: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    } finally {
      connection.release();
    }
  }
);

// GET /api/courses/:courseId/competencies - Get competencies for a specific course
app.get(
  "/api/courses/:courseId/competencies",
  authenticateToken,
  async (req, res) => {
    try {
      const { courseId } = req.params;

      const [competencies] = await pool.execute(
        `
      SELECT c.competency_id, c.competency_code, c.competency_name, 
             c.competency_description, ct.type_name as competency_type,
             cc.is_required, cc.order_sequence, cc.estimated_hours
      FROM course_competencies cc
      JOIN competencies c ON cc.competency_id = c.competency_id
      JOIN competency_types ct ON c.competency_type_id = ct.competency_type_id
      WHERE cc.course_id = ?
      ORDER BY cc.order_sequence, ct.type_name, c.competency_name
    `,
        [courseId]
      );

      res.json(competencies);
    } catch (error) {
      console.error("Course competencies fetch error:", error);
      res.status(500).json({ error: "Failed to fetch course competencies" });
    }
  }
);

// Add competency to course
app.post(
  "/api/courses/:courseId/competencies",
  authenticateToken,
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { competency_id, is_required = true, order_sequence = 0, estimated_hours = 0 } = req.body;

      // Check if competency is already assigned to this course
      const [existing] = await pool.execute(
        "SELECT * FROM course_competencies WHERE course_id = ? AND competency_id = ?",
        [courseId, competency_id]
      );

      if (existing.length > 0) {
        return res.status(400).json({ error: "Competency is already assigned to this course" });
      }

      // Check if competency exists
      const [competencyCheck] = await pool.execute(
        "SELECT competency_id FROM competencies WHERE competency_id = ?",
        [competency_id]
      );

      if (competencyCheck.length === 0) {
        return res.status(404).json({ error: "Competency not found" });
      }

      // Get the next order sequence if not provided
      let finalOrderSequence = order_sequence;
      if (finalOrderSequence === 0) {
        const [maxOrder] = await pool.execute(
          "SELECT COALESCE(MAX(order_sequence), 0) + 1 as next_order FROM course_competencies WHERE course_id = ?",
          [courseId]
        );
        finalOrderSequence = maxOrder[0].next_order;
      }

      // Insert the course-competency relationship
      await pool.execute(
        `INSERT INTO course_competencies 
         (course_id, competency_id, is_required, order_sequence, estimated_hours) 
         VALUES (?, ?, ?, ?, ?)`,
        [courseId, competency_id, is_required, finalOrderSequence, estimated_hours]
      );

      res.status(201).json({ 
        message: "Competency assigned to course successfully",
        course_id: courseId,
        competency_id: competency_id
      });
    } catch (error) {
      console.error("Assign competency error:", error);
      res.status(500).json({ error: "Failed to assign competency to course" });
    }
  }
);

// Remove competency from course
app.delete(
  "/api/courses/:courseId/competencies/:competencyId",
  authenticateToken,
  async (req, res) => {
    try {
      const { courseId, competencyId } = req.params;

      // Check if the relationship exists
      const [existing] = await pool.execute(
        "SELECT * FROM course_competencies WHERE course_id = ? AND competency_id = ?",
        [courseId, competencyId]
      );

      if (existing.length === 0) {
        return res.status(404).json({ error: "Competency is not assigned to this course" });
      }

      // Delete the course-competency relationship
      await pool.execute(
        "DELETE FROM course_competencies WHERE course_id = ? AND competency_id = ?",
        [courseId, competencyId]
      );

      res.json({ 
        message: "Competency removed from course successfully",
        course_id: courseId,
        competency_id: competencyId
      });
    } catch (error) {
      console.error("Remove competency error:", error);
      res.status(500).json({ error: "Failed to remove competency from course" });
    }
  }
);

// Optional: Update competency settings in course (for is_required, order_sequence, estimated_hours)
app.put(
  "/api/courses/:courseId/competencies/:competencyId",
  authenticateToken,
  async (req, res) => {
    try {
      const { courseId, competencyId } = req.params;
      const { is_required, order_sequence, estimated_hours } = req.body;

      // Check if the relationship exists
      const [existing] = await pool.execute(
        "SELECT * FROM course_competencies WHERE course_id = ? AND competency_id = ?",
        [courseId, competencyId]
      );

      if (existing.length === 0) {
        return res.status(404).json({ error: "Competency is not assigned to this course" });
      }

      // Build dynamic update query
      const updates = [];
      const values = [];

      if (is_required !== undefined) {
        updates.push("is_required = ?");
        values.push(is_required);
      }
      if (order_sequence !== undefined) {
        updates.push("order_sequence = ?");
        values.push(order_sequence);
      }
      if (estimated_hours !== undefined) {
        updates.push("estimated_hours = ?");
        values.push(estimated_hours);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      values.push(courseId, competencyId);

      await pool.execute(
        `UPDATE course_competencies SET ${updates.join(", ")} WHERE course_id = ? AND competency_id = ?`,
        values
      );

      res.json({ 
        message: "Course competency updated successfully",
        course_id: courseId,
        competency_id: competencyId
      });
    } catch (error) {
      console.error("Update course competency error:", error);
      res.status(500).json({ error: "Failed to update course competency" });
    }
  }
);

// GET /api/courses/:courseId/offering-enrollments
app.get(
  "/api/courses/:courseId/offering-enrollments",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { courseId } = req.params;

      const [rows] = await pool.execute(
        `
      SELECT 
        co.offering_id,
        co.batch_identifier,
        COUNT(DISTINCT se.student_id) AS enrolled_students
      FROM course_offerings co
      LEFT JOIN student_enrollments se ON co.offering_id = se.offering_id
      WHERE co.course_id = ?
      GROUP BY co.offering_id, co.batch_identifier
      ORDER BY co.start_date DESC
    `,
        [courseId]
      );

      res.json(rows);
    } catch (error) {
      console.error("Error fetching enrollment stats by offering:", error);
      res.status(500).json({ error: "Failed to fetch enrollment statistics" });
    }
  }
);

app.post(
  "/api/enrollments",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("student_id").trim().isLength({ min: 1 }),
    body("offering_id").isInt(),
    body("pricing_type").isIn([
      "regular",
      "early_bird",
      "group",
      "scholarship",
      "special",
    ]),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { student_id, offering_id, pricing_type } = req.body;

      const [result] = await pool.execute(
        `
      CALL sp_enroll_student(?, ?, ?, @result);
      SELECT @result as result;
    `,
        [student_id, offering_id, pricing_type]
      );

      const enrollmentResult = result[1][0].result;

      if (enrollmentResult.startsWith("SUCCESS")) {
        res.status(201).json({ message: enrollmentResult });
      } else {
        res.status(400).json({ error: enrollmentResult });
      }
    } catch (error) {
      console.error("Enrollment error:", error);
      res.status(500).json({ error: "Failed to enroll student" });
    }
  }
);

app.get(
  "/api/students/:studentId/enrollments",
  authenticateToken,
  authorize(["admin", "staff", "student"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [enrollments] = await pool.execute(
        `
      SELECT se.enrollment_id, se.enrollment_status, se.enrollment_date, se.completion_date,
             se.final_grade, se.completion_percentage, se.attendance_percentage,
             c.course_code, c.course_name, co.batch_identifier, co.start_date, co.end_date,
             sa.total_due, sa.amount_paid, sa.balance
      FROM student_enrollments se
      JOIN course_offerings co ON se.offering_id = co.offering_id
      JOIN courses c ON co.course_id = c.course_id
      LEFT JOIN student_accounts sa ON se.student_id = sa.student_id AND se.offering_id = sa.offering_id
      WHERE se.student_id = ?
      ORDER BY co.start_date DESC
    `,
        [studentId]
      );

      res.json(enrollments);
    } catch (error) {
      console.error("Student enrollments fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student enrollments" });
    }
  }
);

// ============================================================================
// REFERRAL ROUTES (Fixed)
// ============================================================================

app.get(
  "/api/referrals",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { status, referrer_search } = req.query;

      let query = `
      SELECT sr.referral_id, sr.referrer_name, sr.referrer_contact, sr.referral_date,
             sr.referral_reward, sr.reward_type, sr.reward_paid, sr.conversion_date,
             rs.source_name, rs.source_type,
             s.student_id, per.first_name, per.last_name
      FROM student_referrals sr
      JOIN referral_sources rs ON sr.source_id = rs.source_id
      JOIN students s ON sr.student_id = s.student_id
      JOIN persons per ON s.person_id = per.person_id
      LEFT JOIN students ref_s ON sr.referrer_student_id = ref_s.student_id
      LEFT JOIN persons ref_per ON ref_s.person_id = ref_per.person_id
      WHERE 1=1
    `;
      const params = [];

      if (referrer_search) {
        query +=
          " AND (sr.referrer_name LIKE ? OR ref_per.first_name LIKE ? OR ref_per.last_name LIKE ?)";
        const searchParam = `%${referrer_search}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      query += " ORDER BY sr.referral_date DESC";

      const [referrals] = await pool.execute(query, params);
      res.json(referrals);
    } catch (error) {
      console.error("Referrals fetch error:", error);
      res.status(500).json({ error: "Failed to fetch referrals" });
    }
  }
);

app.post(
  "/api/referrals",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("student_id").trim().isLength({ min: 1 }),
    body("source_id").isInt(),
    body("referrer_name").optional().trim().isLength({ max: 100 }),
    body("referrer_contact").optional().trim().isLength({ max: 100 }),
  ],
  validateInput,
  async (req, res) => {
    try {
      const {
        student_id,
        source_id,
        referrer_name,
        referrer_contact,
        referrer_student_id,
        ib_code,
        campaign_code,
        referral_reward,
        reward_type,
      } = req.body;

      await pool.execute(
        `
      INSERT INTO student_referrals (
        student_id, source_id, referrer_name, referrer_contact, referrer_student_id,
        ib_code, campaign_code, referral_reward, reward_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
        [
          student_id,
          source_id,
          referrer_name || null,
          referrer_contact || null,
          referrer_student_id || null,
          ib_code || null,
          campaign_code || null,
          referral_reward || 0,
          reward_type || "cash",
        ]
      );

      res.status(201).json({ message: "Referral recorded successfully" });
    } catch (error) {
      console.error("Referral creation error:", error);
      res.status(500).json({ error: "Failed to record referral" });
    }
  }
);

// ============================================================================
// UTILITY ROUTES
// ============================================================================

app.get("/api/trading-levels", authenticateToken, async (req, res) => {
  try {
    const [levels] = await pool.execute(`
      SELECT level_id, level_name, level_description, minimum_score, estimated_duration_weeks
      FROM trading_levels
      ORDER BY minimum_score ASC
    `);
    res.json(levels);
  } catch (error) {
    console.error("Trading levels fetch error:", error);
    res.status(500).json({ error: "Failed to fetch trading levels" });
  }
});

app.get("/api/payment-methods", authenticateToken, async (req, res) => {
  try {
    const [methods] = await pool.execute(`
      SELECT method_id, method_name, method_type, processing_fee_percentage
      FROM payment_methods
      WHERE is_active = TRUE
      ORDER BY method_name
    `);
    res.json(methods);
  } catch (error) {
    console.error("Payment methods fetch error:", error);
    res.status(500).json({ error: "Failed to fetch payment methods" });
  }
});

app.get("/api/document-types", authenticateToken, async (req, res) => {
  try {
    const [types] = await pool.execute(`
      SELECT document_type_id, type_name, category, is_required, required_for
      FROM document_types
      WHERE is_active = TRUE
      ORDER BY is_required DESC, type_name
    `);
    res.json(types);
  } catch (error) {
    console.error("Document types fetch error:", error);
    res.status(500).json({ error: "Failed to fetch document types" });
  }
});

app.get("/api/competencies", authenticateToken, async (req, res) => {
  try {
    const [competencies] = await pool.execute(`
      SELECT c.competency_id, c.competency_code, c.competency_name, c.competency_description,
             ct.type_name as competency_type, ct.passing_score
      FROM competencies c
      JOIN competency_types ct ON c.competency_type_id = ct.competency_type_id
      WHERE c.is_active = TRUE
      ORDER BY ct.type_name, c.competency_name
    `);
    res.json(competencies);
  } catch (error) {
    console.error("Competencies fetch error:", error);
    res.status(500).json({ error: "Failed to fetch competencies" });
  }
});

app.post(
  "/api/competencies",
  [
    authenticateToken,
    authorize(["admin"]),
    body("competency_code").trim().isLength({ min: 1, max: 20 }),
    body("competency_name").trim().isLength({ min: 1, max: 100 }),
    body("competency_description").optional().trim(),
    body("competency_type_id").isInt({ min: 1 }),
    body("weight").optional().isFloat({ min: 0 }),
    body("passing_score").optional().isFloat({ min: 0, max: 100 }),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      const {
        competency_code,
        competency_name,
        competency_description,
        competency_type_id,
        weight = 1.0,
        passing_score,
      } = req.body;

      // Check if competency code already exists
      const [existingCompetency] = await connection.execute(
        "SELECT competency_id FROM competencies WHERE competency_code = ?",
        [competency_code]
      );

      if (existingCompetency.length > 0) {
        return res
          .status(409)
          .json({ error: "Competency code already exists" });
      }

      // Get passing score from competency type if not provided
      let finalPassingScore = passing_score;
      if (!finalPassingScore) {
        const [typeData] = await connection.execute(
          "SELECT passing_score FROM competency_types WHERE competency_type_id = ?",
          [competency_type_id]
        );
        finalPassingScore = typeData[0]?.passing_score || 70.0;
      }

      // Insert competency
      const [result] = await connection.execute(
        `
      INSERT INTO competencies (
        competency_type_id, competency_code, competency_name,
        competency_description, weight, is_active
      ) VALUES (?, ?, ?, ?, ?, TRUE)
    `,
        [
          competency_type_id,
          competency_code,
          competency_name,
          competency_description || null,
          weight,
        ]
      );

      // Fetch the created competency with type info
      const [newCompetency] = await connection.execute(
        `
      SELECT c.*, ct.type_name as competency_type, ct.passing_score
      FROM competencies c
      JOIN competency_types ct ON c.competency_type_id = ct.competency_type_id
      WHERE c.competency_id = ?
    `,
        [result.insertId]
      );

      res.status(201).json({
        message: "Competency created successfully",
        competency: newCompetency[0],
      });
    } catch (error) {
      console.error("Competency creation error:", error);
      res.status(500).json({
        error: "Failed to create competency",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      connection.release();
    }
  }
);

// PUT /api/competencies/:competencyId - Update competency
app.put(
  "/api/competencies/:competencyId",
  [
    authenticateToken,
    authorize(["admin"]),
    body("competency_code").optional().trim().isLength({ min: 1, max: 20 }),
    body("competency_name").optional().trim().isLength({ min: 1, max: 100 }),
    body("competency_description").optional().trim(),
    body("competency_type_id").optional().isInt({ min: 1 }),
    body("weight").optional().isFloat({ min: 0 }),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      const { competencyId } = req.params;
      const {
        competency_code,
        competency_name,
        competency_description,
        competency_type_id,
        weight,
      } = req.body;

      // Check if competency exists
      const [existing] = await connection.execute(
        "SELECT competency_id FROM competencies WHERE competency_id = ?",
        [competencyId]
      );

      if (existing.length === 0) {
        return res.status(404).json({ error: "Competency not found" });
      }

      // If updating code, check for duplicates
      if (competency_code) {
        const [duplicateCode] = await connection.execute(
          "SELECT competency_id FROM competencies WHERE competency_code = ? AND competency_id != ?",
          [competency_code, competencyId]
        );

        if (duplicateCode.length > 0) {
          return res
            .status(409)
            .json({ error: "Competency code already exists" });
        }
      }

      // Build update query
      const updateFields = [];
      const updateValues = [];

      if (competency_code !== undefined) {
        updateFields.push("competency_code = ?");
        updateValues.push(competency_code);
      }
      if (competency_name !== undefined) {
        updateFields.push("competency_name = ?");
        updateValues.push(competency_name);
      }
      if (competency_description !== undefined) {
        updateFields.push("competency_description = ?");
        updateValues.push(competency_description);
      }
      if (competency_type_id !== undefined) {
        updateFields.push("competency_type_id = ?");
        updateValues.push(competency_type_id);
      }
      if (weight !== undefined) {
        updateFields.push("weight = ?");
        updateValues.push(weight);
      }

      if (updateFields.length > 0) {
        updateValues.push(competencyId);

        await connection.execute(
          `
        UPDATE competencies 
        SET ${updateFields.join(", ")}
        WHERE competency_id = ?
      `,
          updateValues
        );
      }

      // Fetch updated competency
      const [updatedCompetency] = await connection.execute(
        `
      SELECT c.*, ct.type_name as competency_type, ct.passing_score
      FROM competencies c
      JOIN competency_types ct ON c.competency_type_id = ct.competency_type_id
      WHERE c.competency_id = ?
    `,
        [competencyId]
      );

      res.json({
        message: "Competency updated successfully",
        competency: updatedCompetency[0],
      });
    } catch (error) {
      console.error("Competency update error:", error);
      res.status(500).json({
        error: "Failed to update competency",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      connection.release();
    }
  }
);

// DELETE /api/competencies/:competencyId - Delete competency
app.delete(
  "/api/competencies/:competencyId",
  [authenticateToken, authorize(["admin"])],
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const { competencyId } = req.params;

      // Check if competency is in use
      const [usageCheck] = await connection.execute(
        `
      SELECT COUNT(*) as count 
      FROM course_competencies 
      WHERE competency_id = ?
    `,
        [competencyId]
      );

      if (usageCheck[0].count > 0) {
        await connection.rollback();
        return res.status(400).json({
          error: "Cannot delete competency that is assigned to courses",
        });
      }

      // Check for student progress
      const [progressCheck] = await connection.execute(
        `
      SELECT COUNT(*) as count 
      FROM student_progress 
      WHERE competency_id = ?
    `,
        [competencyId]
      );

      if (progressCheck[0].count > 0) {
        await connection.rollback();
        return res.status(400).json({
          error: "Cannot delete competency that has student progress records",
        });
      }

      // Soft delete by setting is_active to false
      await connection.execute(
        "UPDATE competencies SET is_active = FALSE WHERE competency_id = ?",
        [competencyId]
      );

      await connection.commit();

      res.json({ message: "Competency deleted successfully" });
    } catch (error) {
      await connection.rollback();
      console.error("Competency deletion error:", error);
      res.status(500).json({
        error: "Failed to delete competency",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      connection.release();
    }
  }
);

// Enhanced endpoint to get students with competency progress
app.get(
  "/api/courses/:courseId/students",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { offering_id, competency_id } = req.query;

      let query = `
      SELECT DISTINCT s.student_id, p.first_name, p.last_name, p.email,
             se.enrollment_status, se.completion_percentage, se.attendance_percentage,
             co.batch_identifier, co.offering_id
      FROM student_enrollments se
      JOIN students s ON se.student_id = s.student_id
      JOIN persons p ON s.person_id = p.person_id
      JOIN course_offerings co ON se.offering_id = co.offering_id
      WHERE co.course_id = ?
    `;
      const params = [courseId];

      if (offering_id) {
        query += " AND co.offering_id = ?";
        params.push(offering_id);
      }

      query += " ORDER BY p.last_name, p.first_name";

      const [students] = await pool.execute(query, params);

      // If competency_id is provided, fetch progress for that competency
      if (competency_id && students.length > 0) {
        for (let student of students) {
          const [progress] = await pool.execute(
            `
          SELECT sp.score, sp.max_score, sp.percentage_score, sp.passed, 
                 sp.attempt_number, sp.competency_id
          FROM student_progress sp
          JOIN student_enrollments se ON sp.enrollment_id = se.enrollment_id
          WHERE se.student_id = ? AND se.offering_id = ? AND sp.competency_id = ?
          ORDER BY sp.attempt_date DESC
          LIMIT 1
        `,
            [student.student_id, student.offering_id, competency_id]
          );

          student.competency_progress = progress[0] || null;
        }
      }

      res.json(students);
    } catch (error) {
      console.error("Course students fetch error:", error);
      res.status(500).json({ error: "Failed to fetch course students" });
    }
  }
);

app.get(
  "/api/courses/stats",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const [stats] = await pool.execute(`
      SELECT 
        c.course_id,
        c.course_name,
        c.course_code,
        COUNT(DISTINCT se.student_id) as total_enrolled,
        COUNT(DISTINCT CASE WHEN se.enrollment_status = 'enrolled' THEN se.student_id END) as active_students,
        COUNT(DISTINCT CASE WHEN se.enrollment_status = 'completed' THEN se.student_id END) as completed_students,
        COUNT(DISTINCT CASE WHEN se.enrollment_status = 'dropped' THEN se.student_id END) as dropped_students,
        AVG(se.completion_percentage) as average_completion,
        COUNT(DISTINCT co.offering_id) as total_offerings,
        COUNT(DISTINCT CASE WHEN co.status = 'active' THEN co.offering_id END) as active_offerings,
        MAX(se.enrollment_date) as last_enrollment_date,
        SUM(sa.total_due) as total_revenue_potential,
        SUM(sa.amount_paid) as total_revenue_collected
      FROM courses c
      LEFT JOIN course_offerings co ON c.course_id = co.course_id
      LEFT JOIN student_enrollments se ON co.offering_id = se.offering_id
      LEFT JOIN student_accounts sa ON se.student_id = sa.student_id AND se.offering_id = sa.offering_id
      WHERE c.is_active = TRUE
      GROUP BY c.course_id, c.course_name, c.course_code
      ORDER BY total_enrolled DESC, c.course_name
    `);

      console.log(`Retrieved enrollment stats for ${stats.length} courses`);

      res.json(stats);
    } catch (error) {
      console.error("Course stats fetch error:", error);
      res.status(500).json({ error: "Failed to fetch course statistics" });
    }
  }
);
// ============================================================================
// USER PROFILE ROUTES (Fixed)
// ============================================================================

app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const [userProfile] = await pool.execute(
      `
      SELECT a.account_id, a.account_status,
             p.first_name, p.middle_name, p.last_name, p.birth_date, p.birth_place, p.gender,
             r.role_name, r.permissions
      FROM accounts a
      JOIN account_roles ar ON a.account_id = ar.account_id
      JOIN roles r ON ar.role_id = r.role_id
      LEFT JOIN persons p ON a.account_id = p.person_id
      WHERE a.account_id = ? AND ar.is_active = TRUE
    `,
      [req.user.accountId]
    );

    if (userProfile.length === 0) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const [contacts] = await pool.execute(
      `
      SELECT contact_type, contact_value, is_primary
      FROM contact_info
      WHERE person_id = ?
    `,
      [req.user.personId]
    );

    res.json({
      ...userProfile[0],
      contacts,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// ============================================================================
// COMPETENCY AND PROGRESS ROUTES (Fixed)
// ============================================================================

app.get(
  "/api/competency-assessments",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { competency_type, student_search, passed } = req.query;

      let query = `
      SELECT sp.progress_id, sp.score, sp.max_score, sp.percentage_score, sp.passed, 
             sp.attempt_number, sp.attempt_date, sp.feedback,
             comp.competency_name, ct.type_name as competency_type,
             s.student_id, per.first_name, per.last_name,
             c.course_name, co.batch_identifier,
             staff_per.first_name as assessed_by_first_name, staff_per.last_name as assessed_by_last_name
      FROM student_progress sp
      JOIN student_enrollments se ON sp.enrollment_id = se.enrollment_id
      JOIN students s ON se.student_id = s.student_id
      JOIN persons per ON s.person_id = per.person_id
      JOIN course_offerings co ON se.offering_id = co.offering_id
      JOIN courses c ON co.course_id = c.course_id
      JOIN competencies comp ON sp.competency_id = comp.competency_id
      JOIN competency_types ct ON comp.competency_type_id = ct.competency_type_id
      LEFT JOIN staff st ON sp.assessed_by = st.staff_id
      LEFT JOIN persons staff_per ON st.person_id = staff_per.person_id
      WHERE 1=1
    `;
      const params = [];

      if (competency_type) {
        query += " AND ct.type_name = ?";
        params.push(competency_type);
      }

      if (passed !== undefined) {
        query += " AND sp.passed = ?";
        params.push(passed === "true");
      }

      if (student_search) {
        query +=
          " AND (per.first_name LIKE ? OR per.last_name LIKE ? OR s.student_id LIKE ?)";
        const searchParam = `%${student_search}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      query += " ORDER BY sp.attempt_date DESC";

      const [assessments] = await pool.execute(query, params);
      res.json(assessments);
    } catch (error) {
      console.error("Competency assessments fetch error:", error);
      res.status(500).json({ error: "Failed to fetch competency assessments" });
    }
  }
);

app.post(
  "/api/competency-assessments",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("enrollment_id").isInt(),
    body("competency_id").isInt(),
    body("score").isFloat({ min: 0 }),
    body("max_score").isFloat({ min: 0.01 }),
    body("feedback").optional().trim().isLength({ max: 1000 }),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { enrollment_id, competency_id, score, max_score, feedback } =
        req.body;

      const [attemptRows] = await pool.execute(
        `
      SELECT COALESCE(MAX(attempt_number), 0) + 1 as next_attempt
      FROM student_progress
      WHERE enrollment_id = ? AND competency_id = ?
    `,
        [enrollment_id, competency_id]
      );

      const attempt_number = attemptRows[0].next_attempt;

      const [staffRows] = await pool.execute(
        "SELECT staff_id FROM staff WHERE account_id = ?",
        [req.user.accountId]
      );

      const staffId = staffRows[0]?.staff_id;

      await pool.execute(
        `
      INSERT INTO student_progress (enrollment_id, competency_id, attempt_number, score, max_score, assessed_by, feedback)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
        [
          enrollment_id,
          competency_id,
          attempt_number,
          score,
          max_score,
          staffId,
          feedback || null,
        ]
      );

      res.status(201).json({ message: "Assessment recorded successfully" });
    } catch (error) {
      console.error("Assessment creation error:", error);
      res.status(500).json({ error: "Failed to record assessment" });
    }
  }
);

app.get(
  "/api/students/:studentId/progress",
  authenticateToken,
  authorize(["admin", "staff", "student"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [progress] = await pool.execute(
        `
      SELECT sp.progress_id, sp.score, sp.max_score, sp.percentage_score, sp.passed, 
             sp.attempt_number, sp.attempt_date, sp.feedback,
             comp.competency_name, comp.competency_description,
             ct.type_name as competency_type, ct.passing_score,
             c.course_name, co.batch_identifier
      FROM student_progress sp
      JOIN student_enrollments se ON sp.enrollment_id = se.enrollment_id
      JOIN course_offerings co ON se.offering_id = co.offering_id
      JOIN courses c ON co.course_id = c.course_id
      JOIN competencies comp ON sp.competency_id = comp.competency_id
      JOIN competency_types ct ON comp.competency_type_id = ct.competency_type_id
      WHERE se.student_id = ?
      ORDER BY sp.attempt_date DESC
    `,
        [studentId]
      );

      res.json(progress);
    } catch (error) {
      console.error("Student progress fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student progress" });
    }
  }
);

// ============================================================================
// SCHOLARSHIP ROUTES (Fixed)
// ============================================================================

app.get(
  "/api/scholarships",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const [scholarships] = await pool.execute(`
      SELECT sp.sponsor_id, sp.sponsor_name, sp.contact_person, sp.contact_email, 
             sp.industry, sp.total_commitment, sp.current_commitment, sp.students_sponsored, sp.is_active,
             st.type_name as sponsor_type
      FROM sponsors sp
      JOIN sponsor_types st ON sp.sponsor_type_id = st.sponsor_type_id
      WHERE sp.is_active = TRUE
      ORDER BY sp.sponsor_name
    `);
      res.json(scholarships);
    } catch (error) {
      console.error("Scholarships fetch error:", error);
      res.status(500).json({ error: "Failed to fetch scholarships" });
    }
  }
);

app.post(
  "/api/scholarships",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("sponsor_name").trim().isLength({ min: 1, max: 100 }),
    body("sponsor_type_id").isInt(),
    body("contact_person").trim().isLength({ min: 1, max: 100 }),
    body("contact_email").isEmail(),
    body("total_commitment").isFloat({ min: 0 }),
  ],
  validateInput,
  async (req, res) => {
    try {
      const {
        sponsor_name,
        sponsor_type_id,
        contact_person,
        contact_email,
        contact_phone,
        address,
        website,
        industry,
        total_commitment,
        agreement_details,
        agreement_start_date,
        agreement_end_date,
      } = req.body;

      const sponsor_code = `SP${Date.now()}`;

      await pool.execute(
        `
      INSERT INTO sponsors (
        sponsor_type_id, sponsor_name, sponsor_code, contact_person, contact_email,
        contact_phone, address, website, industry, total_commitment,
        agreement_details, agreement_start_date, agreement_end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
        [
          sponsor_type_id,
          sponsor_name,
          sponsor_code,
          contact_person,
          contact_email,
          contact_phone || null,
          address || null,
          website || null,
          industry || null,
          total_commitment,
          agreement_details || null,
          agreement_start_date || null,
          agreement_end_date || null,
        ]
      );

      res.status(201).json({
        message: "Scholarship sponsor created successfully",
        sponsor_code,
      });
    } catch (error) {
      console.error("Scholarship creation error:", error);
      res.status(500).json({ error: "Failed to create scholarship sponsor" });
    }
  }
);

app.get(
  "/api/students/:studentId/scholarships",
  authenticateToken,
  authorize(["admin", "staff", "student"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [scholarships] = await pool.execute(
        `
      SELECT ss.scholarship_id, ss.scholarship_type, ss.coverage_percentage, ss.coverage_amount,
             ss.scholarship_status, ss.start_date, ss.end_date, ss.gpa_requirement,
             sp.sponsor_name, st.type_name as sponsor_type
      FROM student_scholarships ss
      JOIN sponsors sp ON ss.sponsor_id = sp.sponsor_id
      JOIN sponsor_types st ON sp.sponsor_type_id = st.sponsor_type_id
      WHERE ss.student_id = ?
      ORDER BY ss.start_date DESC
    `,
        [studentId]
      );

      res.json(scholarships);
    } catch (error) {
      console.error("Student scholarships fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student scholarships" });
    }
  }
);

// ============================================================================
// COURSE AND ENROLLMENT ROUTES (Fixed)
// ============================================================================

app.get("/api/courses", authenticateToken, async (req, res) => {
  try {
    const [courses] = await pool.execute(`
      SELECT c.course_id, c.course_code, c.course_name, c.course_description,
             c.duration_weeks, c.credits, c.is_active
      FROM courses c
      WHERE c.is_active = TRUE
      ORDER BY c.course_name
    `);
    res.json(courses);
  } catch (error) {
    console.error("Courses fetch error:", error);
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

// Enhanced GET /api/course-offerings with course_id included
app.get("/api/course-offerings", authenticateToken, async (req, res) => {
  try {
    const { status, course_id } = req.query;

    let query = `
      SELECT co.offering_id, co.course_id, co.batch_identifier, co.start_date, co.end_date, 
             co.status, co.max_enrollees, co.current_enrollees, co.location,
             c.course_code, c.course_name, c.course_description, c.duration_weeks, c.credits,
             AVG(cp.amount) as average_price,
             GROUP_CONCAT(DISTINCT CONCAT(cp.pricing_type, ':', cp.amount) SEPARATOR '|') as pricing_options
      FROM course_offerings co
      JOIN courses c ON co.course_id = c.course_id
      LEFT JOIN course_pricing cp ON co.offering_id = cp.offering_id AND cp.is_active = TRUE
      WHERE c.is_active = TRUE
    `;
    const params = [];

    if (status) {
      query += " AND co.status = ?";
      params.push(status);
    }

    if (course_id) {
      query += " AND co.course_id = ?";
      params.push(course_id);
    }

    query += " GROUP BY co.offering_id ORDER BY co.start_date DESC";

    const [offerings] = await pool.execute(query, params);

    // Parse pricing options for each offering
    const formattedOfferings = offerings.map((offering) => {
      const pricing = {};
      if (offering.pricing_options) {
        offering.pricing_options.split("|").forEach((option) => {
          const [type, price] = option.split(":");
          pricing[type] = parseFloat(price);
        });
      }

      return {
        ...offering,
        pricing_options: pricing,
        start_date: new Date(offering.start_date).toISOString(),
        end_date: new Date(offering.end_date).toISOString(),
      };
    });

    res.json(formattedOfferings);
  } catch (error) {
    console.error("Course offerings fetch error:", error);
    res.status(500).json({ error: "Failed to fetch course offerings" });
  }
});

// GET /api/course-offerings/:offeringId - Get specific course offering details
app.get(
  "/api/course-offerings/:offeringId",
  authenticateToken,
  async (req, res) => {
    try {
      const { offeringId } = req.params;

      const [offerings] = await pool.execute(
        `
      SELECT co.offering_id, co.course_id, co.batch_identifier, co.start_date, co.end_date,
             co.status, co.max_enrollees, co.current_enrollees, co.location, co.instructor_id,
             c.course_code, c.course_name, c.course_description, c.duration_weeks, c.credits,
             COUNT(DISTINCT se.enrollment_id) as actual_enrollees
      FROM course_offerings co
      JOIN courses c ON co.course_id = c.course_id
      LEFT JOIN student_enrollments se ON co.offering_id = se.offering_id AND se.enrollment_status = 'enrolled'
      WHERE co.offering_id = ?
      GROUP BY co.offering_id
    `,
        [offeringId]
      );

      if (offerings.length === 0) {
        return res.status(404).json({ error: "Course offering not found" });
      }

      // Get pricing for this offering
      const [pricing] = await pool.execute(
        `
      SELECT pricing_type, amount, currency, effective_date, expiry_date
      FROM course_pricing
      WHERE offering_id = ? AND is_active = TRUE
      ORDER BY pricing_type
    `,
        [offeringId]
      );

      const offering = offerings[0];
      offering.pricing = pricing.reduce((acc, price) => {
        acc[price.pricing_type] = {
          amount: parseFloat(price.amount),
          currency: price.currency,
          effective_date: price.effective_date,
          expiry_date: price.expiry_date,
        };
        return acc;
      }, {});

      res.json(offering);
    } catch (error) {
      console.error("Course offering fetch error:", error);
      res.status(500).json({ error: "Failed to fetch course offering" });
    }
  }
);

// POST /api/student-accounts - Create student account for course offering
app.post(
  "/api/student-accounts",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("student_id")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Student ID is required"),
    body("offering_id")
      .isInt({ min: 1 })
      .withMessage("Valid offering ID is required"),
    body("pricing_type")
      .isIn(["regular", "early_bird", "group", "scholarship", "special"])
      .withMessage("Valid pricing type is required"),
    body("scheme_id").optional().isInt(),
    body("due_date").optional().isISO8601(),
    body("notes").optional().trim(),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const {
        student_id,
        offering_id,
        pricing_type,
        scheme_id,
        due_date,
        notes,
      } = req.body;

      console.log("Creating student account with data:", {
        student_id,
        offering_id,
        pricing_type,
        scheme_id,
      });

      // Verify student exists
      const [studentCheck] = await connection.execute(
        "SELECT student_id, graduation_status FROM students WHERE student_id = ?",
        [student_id]
      );

      if (studentCheck.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "Student not found" });
      }

      if (studentCheck[0].graduation_status === "suspended") {
        await connection.rollback();
        return res
          .status(400)
          .json({ error: "Cannot create account for suspended student" });
      }

      // Verify course offering exists and get course details
      const [offeringCheck] = await connection.execute(
        `
      SELECT co.offering_id, co.course_id, co.status, co.max_enrollees, co.current_enrollees,
             c.course_name, c.course_code
      FROM course_offerings co
      JOIN courses c ON co.course_id = c.course_id
      WHERE co.offering_id = ?
    `,
        [offering_id]
      );

      if (offeringCheck.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "Course offering not found" });
      }

      const offering = offeringCheck[0];

      if (offering.status === "cancelled") {
        await connection.rollback();
        return res.status(400).json({
          error: "Cannot create account for cancelled course offering",
        });
      }

      if (offering.current_enrollees >= offering.max_enrollees) {
        await connection.rollback();
        return res.status(400).json({ error: "Course offering is full" });
      }

      // Check if student account already exists for this offering
      const [existingAccount] = await connection.execute(
        "SELECT account_id FROM student_accounts WHERE student_id = ? AND offering_id = ?",
        [student_id, offering_id]
      );

      if (existingAccount.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          error: "Student account already exists for this course offering",
        });
      }

      // Get pricing for the selected type
      const [pricingData] = await connection.execute(
        `
      SELECT amount, currency
      FROM course_pricing
      WHERE offering_id = ? AND pricing_type = ? AND is_active = TRUE
      AND (expiry_date IS NULL OR expiry_date > NOW())
    `,
        [offering_id, pricing_type]
      );

      if (pricingData.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          error: `Pricing not available for type: ${pricing_type}`,
        });
      }

      const totalDue = parseFloat(pricingData[0].amount);

      // Calculate due date if not provided
      let calculatedDueDate = due_date;
      if (!calculatedDueDate) {
        const defaultDueDate = new Date();
        defaultDueDate.setDate(defaultDueDate.getDate() + 30); // 30 days from now
        calculatedDueDate = defaultDueDate.toISOString().split("T")[0];
      }

      // Create student account
      const [accountResult] = await connection.execute(
        `
      INSERT INTO student_accounts (
        student_id, offering_id, total_due, amount_paid, scheme_id,
        account_status, due_date, notes, created_at, updated_at
      ) VALUES (?, ?, ?, 0.00, ?, 'active', ?, ?, NOW(), NOW())
    `,
        [
          student_id,
          offering_id,
          totalDue,
          scheme_id || null,
          calculatedDueDate,
          notes || null,
        ]
      );

      const accountId = accountResult.insertId;

      // Create enrollment record if it doesn't exist
      const [existingEnrollment] = await connection.execute(
        "SELECT enrollment_id FROM student_enrollments WHERE student_id = ? AND offering_id = ?",
        [student_id, offering_id]
      );

      let enrollmentId;
      if (existingEnrollment.length === 0) {
        const [enrollmentResult] = await connection.execute(
          `
        INSERT INTO student_enrollments (
          student_id, offering_id, enrollment_date, enrollment_status,
          completion_percentage, attendance_percentage
        ) VALUES (?, ?, NOW(), 'enrolled', 0.00, NULL)
      `,
          [student_id, offering_id]
        );

        enrollmentId = enrollmentResult.insertId;

        // Update current enrollees count in course offering
        await connection.execute(
          `
        UPDATE course_offerings 
        SET current_enrollees = current_enrollees + 1,
            updated_at = NOW()
        WHERE offering_id = ?
      `,
          [offering_id]
        );
      } else {
        enrollmentId = existingEnrollment[0].enrollment_id;
      }

      await connection.commit();

      // Fetch complete account details for response
      const [accountDetails] = await connection.execute(
        `
      SELECT sa.account_id, sa.student_id, sa.offering_id, sa.total_due, 
             sa.amount_paid, sa.balance, sa.account_status, sa.due_date,
             sa.created_at, sa.notes,
             p.first_name, p.last_name, p.email,
             c.course_name, c.course_code, co.batch_identifier,
             ps.scheme_name
      FROM student_accounts sa
      JOIN students s ON sa.student_id = s.student_id
      JOIN persons p ON s.person_id = p.person_id
      JOIN course_offerings co ON sa.offering_id = co.offering_id
      JOIN courses c ON co.course_id = c.course_id
      LEFT JOIN payment_schemes ps ON sa.scheme_id = ps.scheme_id
      WHERE sa.account_id = ?
    `,
        [accountId]
      );

      // Send notification email if email service is available
      let emailSent = false;
      try {
        if (emailTransporter && accountDetails[0].email) {
          const student = accountDetails[0];
          await sendEnrollmentConfirmationEmail(
            student.email,
            student.first_name,
            student.last_name,
            student.course_name,
            student.batch_identifier,
            student.total_due,
            student.due_date
          );
          emailSent = true;
        }
      } catch (emailError) {
        console.error(
          "Failed to send enrollment confirmation email:",
          emailError
        );
      }

      res.status(201).json({
        message: "Student account created successfully",
        account: accountDetails[0],
        enrollment_id: enrollmentId,
        email_sent: emailSent,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Student account creation error:", error);

      if (error.code === "ER_DUP_ENTRY") {
        res.status(409).json({
          error: "Student account already exists for this course offering",
        });
      } else {
        res.status(500).json({
          error: "Failed to create student account",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    } finally {
      connection.release();
    }
  }
);

// GET /api/student-accounts - Get all student accounts with filtering
app.get(
  "/api/student-accounts",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const {
        student_id,
        offering_id,
        course_id,
        account_status,
        overdue_only,
        search,
        page = 1,
        limit = 50,
      } = req.query;

      let query = `
      SELECT sa.account_id, sa.student_id, sa.offering_id, sa.total_due,
             sa.amount_paid, sa.balance, sa.account_status, sa.due_date,
             sa.last_payment_date, sa.payment_reminder_count, sa.created_at,
             p.first_name, p.last_name, p.email,
             c.course_name, c.course_code, co.batch_identifier, co.start_date,
             ps.scheme_name,
             CASE 
               WHEN sa.due_date < CURDATE() AND sa.balance > 0 THEN TRUE
               ELSE FALSE
             END as is_overdue,
             DATEDIFF(CURDATE(), sa.due_date) as days_overdue
      FROM student_accounts sa
      JOIN students s ON sa.student_id = s.student_id
      JOIN persons p ON s.person_id = p.person_id
      JOIN course_offerings co ON sa.offering_id = co.offering_id
      JOIN courses c ON co.course_id = c.course_id
      LEFT JOIN payment_schemes ps ON sa.scheme_id = ps.scheme_id
      WHERE 1=1
    `;

      const params = [];
      const conditions = [];

      if (student_id) {
        conditions.push("sa.student_id = ?");
        params.push(student_id);
      }

      if (offering_id) {
        conditions.push("sa.offering_id = ?");
        params.push(offering_id);
      }

      if (course_id) {
        conditions.push("co.course_id = ?");
        params.push(course_id);
      }

      if (account_status) {
        conditions.push("sa.account_status = ?");
        params.push(account_status);
      }

      if (overdue_only === "true") {
        conditions.push("sa.due_date < CURDATE() AND sa.balance > 0");
      }

      if (search) {
        conditions.push(
          "(p.first_name LIKE ? OR p.last_name LIKE ? OR p.email LIKE ? OR c.course_name LIKE ?)"
        );
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam, searchParam);
      }

      if (conditions.length > 0) {
        query += " AND " + conditions.join(" AND ");
      }

      query += " ORDER BY sa.created_at DESC";

      // Add pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += " LIMIT ? OFFSET ?";
      params.push(parseInt(limit), offset);

      const [accounts] = await pool.execute(query, params);

      // Get total count for pagination
      let countQuery = query.replace(
        /SELECT.*?FROM/,
        "SELECT COUNT(*) as total FROM"
      );
      countQuery = countQuery.replace(/ORDER BY.*?LIMIT.*?OFFSET.*?$/, "");
      const countParams = params.slice(0, -2); // Remove limit and offset params

      const [countResult] = await pool.execute(countQuery, countParams);
      const totalRecords = countResult[0].total;

      res.json({
        accounts,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_records: totalRecords,
          total_pages: Math.ceil(totalRecords / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error("Student accounts fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student accounts" });
    }
  }
);

// GET /api/student-accounts/:accountId - Get specific student account
app.get(
  "/api/student-accounts/:accountId",
  authenticateToken,
  async (req, res) => {
    try {
      const { accountId } = req.params;

      const [accounts] = await pool.execute(
        `
      SELECT sa.*, 
             p.first_name, p.last_name, p.email, p.phone,
             c.course_name, c.course_code, c.duration_weeks,
             co.batch_identifier, co.start_date, co.end_date,
             ps.scheme_name, ps.installment_count
      FROM student_accounts sa
      JOIN students s ON sa.student_id = s.student_id
      JOIN persons p ON s.person_id = p.person_id
      JOIN course_offerings co ON sa.offering_id = co.offering_id
      JOIN courses c ON co.course_id = c.course_id
      LEFT JOIN payment_schemes ps ON sa.scheme_id = ps.scheme_id
      WHERE sa.account_id = ?
    `,
        [accountId]
      );

      if (accounts.length === 0) {
        return res.status(404).json({ error: "Student account not found" });
      }

      res.json(accounts[0]);
    } catch (error) {
      console.error("Student account fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student account" });
    }
  }
);

// Helper function for sending enrollment confirmation emails
async function sendEnrollmentConfirmationEmail(
  email,
  firstName,
  lastName,
  courseName,
  batchId,
  totalDue,
  dueDate
) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || "noreply@8cons.com",
    to: email,
    subject: `Enrollment Confirmation - ${courseName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Enrollment Confirmation</h2>
        
        <p>Dear ${firstName} ${lastName},</p>
        
        <p>Congratulations! You have been successfully enrolled in:</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #2c5282; margin-top: 0;">${courseName}</h3>
          <p><strong>Batch:</strong> ${batchId}</p>
          <p><strong>Total Amount Due:</strong> ₱${parseFloat(
            totalDue
          ).toLocaleString()}</p>
          <p><strong>Payment Due Date:</strong> ${new Date(
            dueDate
          ).toLocaleDateString()}</p>
        </div>
        
        <p>Please ensure payment is made by the due date to secure your enrollment.</p>
        
        <p>If you have any questions, please don't hesitate to contact us.</p>
        
        <p>Best regards,<br>8Cons Trading Academy</p>
      </div>
    `,
  };

  if (emailTransporter) {
    return await emailTransporter.sendMail(mailOptions);
  }
}

app.post(
  "/api/enrollments",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("student_id").trim().isLength({ min: 1 }),
    body("offering_id").isInt(),
    body("pricing_type").isIn([
      "regular",
      "early_bird",
      "group",
      "scholarship",
      "special",
    ]),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { student_id, offering_id, pricing_type } = req.body;

      const [result] = await pool.execute(
        `
      CALL sp_enroll_student(?, ?, ?, @result);
      SELECT @result as result;
    `,
        [student_id, offering_id, pricing_type]
      );

      const enrollmentResult = result[1][0].result;

      if (enrollmentResult.startsWith("SUCCESS")) {
        res.status(201).json({ message: enrollmentResult });
      } else {
        res.status(400).json({ error: enrollmentResult });
      }
    } catch (error) {
      console.error("Enrollment error:", error);
      res.status(500).json({ error: "Failed to enroll student" });
    }
  }
);

// POST /api/student/enroll-course - Enroll student in a course
// FIXED Student Enrollment Endpoint
app.post(
  "/api/student/enroll-course",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("student_id").notEmpty().withMessage("Student ID is required"),
    body("course_id").isInt({ min: 1 }).withMessage("Valid course ID is required"),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const { student_id, course_id, offering_id } = req.body;
      
      // Clean and validate inputs
      const studentId = String(student_id).trim();
      const courseIdInt = parseInt(course_id);

      console.log('🎯 ENROLLMENT REQUEST:', { studentId, courseIdInt, offering_id });

      // Step 1: Verify student exists
      const [studentCheck] = await connection.execute(
        `SELECT s.student_id, s.account_id, s.graduation_status,
                p.first_name, p.last_name, p.email
         FROM students s
         JOIN persons p ON s.person_id = p.person_id
         WHERE s.student_id = ?`,
        [studentId]
      );

      if (studentCheck.length === 0) {
        await connection.rollback();
        
        // Get sample students for debugging
        const [sampleStudents] = await connection.execute(
          `SELECT student_id FROM students ORDER BY student_id LIMIT 3`
        );
        
        return res.status(404).json({ 
          error: `Student '${studentId}' not found`,
          debug: {
            searched_for: studentId,
            sample_student_ids: sampleStudents.map(s => s.student_id),
            suggestion: "Use one of the sample student IDs above"
          }
        });
      }

      const student = studentCheck[0];
      console.log('✅ Student found:', student.first_name, student.last_name);

      // Step 2: Verify course exists and is active
      const [courseCheck] = await connection.execute(
        `SELECT course_id, course_code, course_name, is_active 
         FROM courses 
         WHERE course_id = ? AND is_active = TRUE`,
        [courseIdInt]
      );

      if (courseCheck.length === 0) {
        await connection.rollback();
        
        // Get sample courses for debugging
        const [sampleCourses] = await connection.execute(
          `SELECT course_id, course_code, course_name FROM courses WHERE is_active = TRUE LIMIT 3`
        );
        
        return res.status(404).json({ 
          error: `Course with ID ${courseIdInt} not found or inactive`,
          debug: {
            searched_for: courseIdInt,
            sample_courses: sampleCourses,
            suggestion: "Use one of the sample course IDs above"
          }
        });
      }

      const course = courseCheck[0];
      console.log('✅ Course found:', course.course_code, '-', course.course_name);

      // Step 3: Check for existing enrollment (optional - you can comment this out)
      const [existingEnrollments] = await connection.execute(
        `SELECT se.enrollment_id, se.enrollment_status,
                co.batch_identifier, c.course_code
         FROM student_enrollments se
         JOIN course_offerings co ON se.offering_id = co.offering_id
         JOIN courses c ON co.course_id = c.course_id
         WHERE se.student_id = ? 
         AND c.course_id = ?
         AND se.enrollment_status IN ('enrolled', 'active')`,
        [studentId, courseIdInt]
      );

      if (existingEnrollments.length > 0) {
        console.log('⚠️ Student already enrolled:', existingEnrollments[0]);
        // Uncomment the next 4 lines if you want to prevent duplicate enrollments
        // await connection.rollback();
        // return res.status(409).json({ 
        //   error: `Student is already enrolled in ${course.course_code}`,
        //   existing_enrollment: existingEnrollments[0]
        // });
      }

      // Step 4: Find available course offering
      let targetOffering;
      
      if (offering_id) {
        // Use specific offering if provided
        const [specificOffering] = await connection.execute(
          `SELECT offering_id, batch_identifier, start_date, end_date, 
                  max_enrollees, current_enrollees, status
           FROM course_offerings 
           WHERE offering_id = ? AND course_id = ?`,
          [parseInt(offering_id), courseIdInt]
        );
        
        if (specificOffering.length === 0) {
          await connection.rollback();
          return res.status(404).json({ 
            error: `Course offering ${offering_id} not found for course ${courseIdInt}`
          });
        }
        
        targetOffering = specificOffering[0];
      } else {
        // Find any available offering for this course
        console.log('🔍 Looking for available course offerings...');
        
        // First, get ALL offerings for this course for debugging
        const [allOfferings] = await connection.execute(
          `SELECT offering_id, batch_identifier, status, current_enrollees, 
                  max_enrollees, start_date, end_date,
                  (current_enrollees < max_enrollees) as has_space,
                  (end_date > NOW()) as not_expired,
                  (status IN ('planned', 'active')) as status_ok
           FROM course_offerings 
           WHERE course_id = ?
           ORDER BY start_date ASC`,
          [courseIdInt]
        );

        console.log('📊 All offerings for course:', allOfferings);

        // Try to find the best available offering with relaxed criteria
        const [availableOfferings] = await connection.execute(
          `SELECT offering_id, batch_identifier, start_date, end_date, 
                  max_enrollees, current_enrollees, status
           FROM course_offerings 
           WHERE course_id = ? 
           AND status IN ('planned', 'active', 'open') 
           AND current_enrollees < max_enrollees 
           ORDER BY 
             CASE 
               WHEN status = 'active' THEN 1
               WHEN status = 'planned' THEN 2
               ELSE 3
             END,
             start_date ASC 
           LIMIT 1`,
          [courseIdInt]
        );

        if (availableOfferings.length === 0) {
          // If no available offerings with strict criteria, try more relaxed criteria
          const [relaxedOfferings] = await connection.execute(
            `SELECT offering_id, batch_identifier, start_date, end_date, 
                    max_enrollees, current_enrollees, status
             FROM course_offerings 
             WHERE course_id = ? 
             AND current_enrollees < max_enrollees
             ORDER BY start_date DESC
             LIMIT 1`,
            [courseIdInt]
          );

          if (relaxedOfferings.length === 0) {
            await connection.rollback();
            return res.status(400).json({ 
              error: "No available course offerings found",
              debug: {
                course_id: courseIdInt,
                course_name: course.course_name,
                all_offerings: allOfferings,
                suggestions: [
                  "Create a new course offering for this course",
                  "Increase max_enrollees for existing offerings",
                  "Check offering status and dates"
                ]
              }
            });
          }

          targetOffering = relaxedOfferings[0];
          console.log('⚠️ Using relaxed criteria, found offering:', targetOffering);
        } else {
          targetOffering = availableOfferings[0];
          console.log('✅ Found available offering:', targetOffering);
        }
      }

      // Step 5: Final capacity check
      if (targetOffering.current_enrollees >= targetOffering.max_enrollees) {
        await connection.rollback();
        return res.status(400).json({ 
          error: "Course offering is at maximum capacity",
          offering: {
            batch: targetOffering.batch_identifier,
            current: targetOffering.current_enrollees,
            max: targetOffering.max_enrollees
          }
        });
      }

      console.log('✅ Proceeding with enrollment in offering:', targetOffering.batch_identifier);

      // Step 6: Create the enrollment
      const [enrollmentResult] = await connection.execute(
        `INSERT INTO student_enrollments (
          student_id, offering_id, enrollment_date, enrollment_status, 
          completion_percentage, attendance_percentage
        ) VALUES (?, ?, NOW(), 'enrolled', 0.00, NULL)`,
        [studentId, targetOffering.offering_id]
      );

      console.log('✅ Enrollment created with ID:', enrollmentResult.insertId);

      // Step 7: Update offering enrollment count
      await connection.execute(
        `UPDATE course_offerings 
         SET current_enrollees = current_enrollees + 1,
             updated_at = NOW()
         WHERE offering_id = ?`,
        [targetOffering.offering_id]
      );

      console.log('✅ Updated offering enrollment count');

      // Step 8: Create student account if it doesn't exist
      const [accountCheck] = await connection.execute(
        `SELECT account_id FROM student_accounts 
         WHERE student_id = ? AND offering_id = ?`,
        [studentId, targetOffering.offering_id]
      );

      if (accountCheck.length === 0) {
        // Get course pricing
        const [pricingData] = await connection.execute(
          `SELECT amount FROM course_pricing 
           WHERE offering_id = ? AND pricing_type = 'regular' AND is_active = TRUE
           ORDER BY effective_date DESC LIMIT 1`,
          [targetOffering.offering_id]
        );

        const totalDue = pricingData.length > 0 ? parseFloat(pricingData[0].amount) : 0;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // 30 days from now

        await connection.execute(
          `INSERT INTO student_accounts (
            student_id, offering_id, total_due, amount_paid, balance,
            account_status, due_date, created_at, updated_at
          ) VALUES (?, ?, ?, 0.00, ?, 'active', ?, NOW(), NOW())`,
          [studentId, targetOffering.offering_id, totalDue, totalDue, dueDate]
        );

        console.log('✅ Created student account with total due:', totalDue);
      }

      await connection.commit();
      console.log('🎉 ENROLLMENT SUCCESSFUL!');

      res.status(201).json({
        success: true,
        message: "Student enrolled successfully",
        enrollment: {
          enrollment_id: enrollmentResult.insertId,
          student_id: studentId,
          student_name: `${student.first_name} ${student.last_name}`,
          course: {
            course_id: courseIdInt,
            course_code: course.course_code,
            course_name: course.course_name
          },
          offering: {
            offering_id: targetOffering.offering_id,
            batch_identifier: targetOffering.batch_identifier,
            start_date: targetOffering.start_date,
            end_date: targetOffering.end_date
          }
        }
      });

    } catch (error) {
      await connection.rollback();
      console.error("❌ ENROLLMENT ERROR:", error);
      
      res.status(500).json({
        success: false,
        error: "Failed to enroll student",
        message: error.message,
        debug: process.env.NODE_ENV === "development" ? {
          error_code: error.code,
          error_details: error.message,
          sql_state: error.sqlState
        } : undefined
      });
    } finally {
      connection.release();
    }
  }
);

// GET /api/student/:studentId/enrollments - Get all enrollments for a student
app.get(
  "/api/student/:studentId/enrollments",
  [
    authenticateToken,
    authorize(["admin", "staff", "student"])
  ],
  async (req, res) => {
    try {
      const { studentId } = req.params;

      // If user is a student, make sure they can only access their own data
      if (req.user.role === 'student' && req.user.student_id !== parseInt(studentId)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const [enrollments] = await pool.execute(
        `SELECT 
          se.enrollment_id,
          se.enrollment_date,
          se.enrollment_status,
          se.completion_percentage,
          se.attendance_percentage,
          se.completion_date,
          se.final_grade,
          co.offering_id,
          co.batch_identifier,
          co.start_date,
          co.end_date,
          co.status as offering_status,
          c.course_id,
          c.course_code,
          c.course_name,
          c.course_description,
          c.duration_weeks,
          c.credits,
          sa.total_due,
          sa.amount_paid,
          sa.balance,
          sa.account_status as payment_status
        FROM student_enrollments se
        JOIN course_offerings co ON se.offering_id = co.offering_id
        JOIN courses c ON co.course_id = c.course_id
        LEFT JOIN student_accounts sa ON se.student_id = sa.student_id AND se.offering_id = sa.offering_id
        WHERE se.student_id = ?
        ORDER BY se.enrollment_date DESC`,
        [studentId]
      );

      res.json({
        message: "Student enrollments retrieved successfully",
        enrollments: enrollments
      });

    } catch (error) {
      console.error("Error fetching student enrollments:", error);
      res.status(500).json({
        error: "Failed to fetch student enrollments",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// DELETE /api/student/enrollment/:enrollmentId - Drop/withdraw from a course
app.delete(
  "/api/student/enrollment/:enrollmentId",
  [
    authenticateToken,
    authorize(["admin", "staff"]) // Usually only admin/staff can drop students
  ],
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const { enrollmentId } = req.params;

      // Get enrollment details
      const [enrollment] = await connection.execute(
        `SELECT se.student_id, se.offering_id, se.enrollment_status,
                c.course_code, c.course_name, co.batch_identifier
         FROM student_enrollments se
         JOIN course_offerings co ON se.offering_id = co.offering_id
         JOIN courses c ON co.course_id = c.course_id
         WHERE se.enrollment_id = ?`,
        [enrollmentId]
      );

      if (enrollment.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "Enrollment not found" });
      }

      const enrollmentData = enrollment[0];

      // Update enrollment status to 'dropped'
      await connection.execute(
        "UPDATE student_enrollments SET enrollment_status = 'dropped' WHERE enrollment_id = ?",
        [enrollmentId]
      );

      // Decrease current enrollees count
      await connection.execute(
        "UPDATE course_offerings SET current_enrollees = current_enrollees - 1 WHERE offering_id = ?",
        [enrollmentData.offering_id]
      );

      await connection.commit();

      res.json({
        message: "Student successfully dropped from course",
        enrollment: {
          enrollment_id: enrollmentId,
          student_id: enrollmentData.student_id,
          course: `${enrollmentData.course_code} - ${enrollmentData.course_name}`,
          batch: enrollmentData.batch_identifier
        }
      });

    } catch (error) {
      await connection.rollback();
      console.error("Error dropping student from course:", error);
      res.status(500).json({
        error: "Failed to drop student from course",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      connection.release();
    }
  }
);

// app.get(
//   "/api/students/:studentId/enrollments",
//   authenticateToken,
//   authorize(["admin", "staff", "student"]),
//   authorizeStudentAccess,
//   async (req, res) => {
//     try {
//       const { studentId } = req.params;

//       const [enrollments] = await pool.execute(
//         `
//       SELECT se.enrollment_id, se.enrollment_status, se.enrollment_date, se.completion_date,
//              se.final_grade, se.completion_percentage, se.attendance_percentage,
//              c.course_code, c.course_name, co.batch_identifier, co.start_date, co.end_date,
//              sa.total_due, sa.amount_paid, sa.balance
//       FROM student_enrollments se
//       JOIN course_offerings co ON se.offering_id = co.offering_id
//       JOIN courses c ON co.course_id = c.course_id
//       LEFT JOIN student_accounts sa ON se.student_id = sa.student_id AND se.offering_id = sa.offering_id
//       WHERE se.student_id = ?
//       ORDER BY co.start_date DESC
//     `,
//         [studentId]
//       );

//       res.json(enrollments);
//     } catch (error) {
//       console.error("Student enrollments fetch error:", error);
//       res.status(500).json({ error: "Failed to fetch student enrollments" });
//     }
//   }
// );

// ============================================================================
// REFERRAL ROUTES (Fixed)
// ============================================================================

app.get(
  "/api/referrals",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { status, referrer_search } = req.query;

      let query = `
      SELECT sr.referral_id, sr.referrer_name, sr.referrer_contact, sr.referral_date,
             sr.referral_reward, sr.reward_type, sr.reward_paid, sr.conversion_date,
             rs.source_name, rs.source_type,
             s.student_id, per.first_name, per.last_name
      FROM student_referrals sr
      JOIN referral_sources rs ON sr.source_id = rs.source_id
      JOIN students s ON sr.student_id = s.student_id
      JOIN persons per ON s.person_id = per.person_id
      LEFT JOIN students ref_s ON sr.referrer_student_id = ref_s.student_id
      LEFT JOIN persons ref_per ON ref_s.person_id = ref_per.person_id
      WHERE 1=1
    `;
      const params = [];

      if (referrer_search) {
        query +=
          " AND (sr.referrer_name LIKE ? OR ref_per.first_name LIKE ? OR ref_per.last_name LIKE ?)";
        const searchParam = `%${referrer_search}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      query += " ORDER BY sr.referral_date DESC";

      const [referrals] = await pool.execute(query, params);
      res.json(referrals);
    } catch (error) {
      console.error("Referrals fetch error:", error);
      res.status(500).json({ error: "Failed to fetch referrals" });
    }
  }
);

app.post(
  "/api/referrals",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("student_id").trim().isLength({ min: 1 }),
    body("source_id").isInt(),
    body("referrer_name").optional().trim().isLength({ max: 100 }),
    body("referrer_contact").optional().trim().isLength({ max: 100 }),
  ],
  validateInput,
  async (req, res) => {
    try {
      const {
        student_id,
        source_id,
        referrer_name,
        referrer_contact,
        referrer_student_id,
        ib_code,
        campaign_code,
        referral_reward,
        reward_type,
      } = req.body;

      await pool.execute(
        `
      INSERT INTO student_referrals (
        student_id, source_id, referrer_name, referrer_contact, referrer_student_id,
        ib_code, campaign_code, referral_reward, reward_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
        [
          student_id,
          source_id,
          referrer_name || null,
          referrer_contact || null,
          referrer_student_id || null,
          ib_code || null,
          campaign_code || null,
          referral_reward || 0,
          reward_type || "cash",
        ]
      );

      res.status(201).json({ message: "Referral recorded successfully" });
    } catch (error) {
      console.error("Referral creation error:", error);
      res.status(500).json({ error: "Failed to record referral" });
    }
  }
);

// ============================================================================
// UTILITY ROUTES (Fixed)
// ============================================================================

app.get("/api/trading-levels", authenticateToken, async (req, res) => {
  try {
    const [levels] = await pool.execute(`
      SELECT level_id, level_name, level_description, minimum_score, estimated_duration_weeks
      FROM trading_levels
      ORDER BY minimum_score ASC
    `);
    res.json(levels);
  } catch (error) {
    console.error("Trading levels fetch error:", error);
    res.status(500).json({ error: "Failed to fetch trading levels" });
  }
});

// Enhanced payment upload with receipt

app.post(
  "/api/payments/upload-with-receipt",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    upload.single("receipt"),
    body("account_id").isInt(),
    body("student_id").isString(),
    body("method_id").isInt(),
    body("payment_amount").isFloat({ min: 0.01 }),
    body("reference_number").optional().trim().isLength({ max: 50 }),
    body("notes").optional().trim().isString(),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const {
        account_id,
        student_id,
        method_id,
        payment_amount,
        reference_number,
        notes,
      } = req.body;

      const receiptPath = req.file ? req.file.path.replace(/\\/g, "/") : null;

      // Check if account_id exists
      const [accountRows] = await connection.execute(
        "SELECT account_id FROM student_accounts WHERE account_id = ?",
        [account_id]
      );

      if (accountRows.length === 0) {
        // Insert new student account
        await connection.execute(
          `
          INSERT INTO student_accounts 
          (account_id, student_id, offering_id, total_due, amount_paid, balance, scheme_id, account_status, due_date, created_at, updated_at) 
          VALUES (?, ?, '1', ?, 0, ?, NULL, 'active', CURRENT_DATE, NOW(), NOW())
          `,
          [
            account_id,
            student_id,
            payment_amount, // total_due
            payment_amount, // balance
          ]
        );
      }

      // Get staff_id of logged-in user
      const [staffRows] = await connection.execute(
        "SELECT staff_id FROM staff WHERE account_id = ?",
        [req.user.accountId]
      );
      const staffId = staffRows[0]?.staff_id || null;

      // Get processing fee percentage
      const [methodRows] = await connection.execute(
        "SELECT processing_fee_percentage FROM payment_methods WHERE method_id = ?",
        [method_id]
      );
      const processingFeePercentage =
        methodRows[0]?.processing_fee_percentage || 0;
      const processing_fee = (payment_amount * processingFeePercentage) / 100;

      // Insert payment
      const [paymentResult] = await connection.execute(
        `
        INSERT INTO payments (
          account_id, method_id, payment_amount, processing_fee,
          reference_number, payment_status, processed_by, notes,
          payment_date, receipt_path
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NOW(), ?)
        `,
        [
          account_id,
          method_id,
          payment_amount,
          processing_fee,
          reference_number || null,
          staffId,
          notes || null,
          receiptPath,
        ]
      );

      // Update student account balance + paid
      await connection.execute(
        `
        UPDATE student_accounts
        SET amount_paid = amount_paid + ?,
            balance = total_due - (amount_paid + ?),
            last_payment_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE account_id = ?
        `,
        [payment_amount, payment_amount, account_id]
      );

      await connection.commit();

      res.status(201).json({
        message: "Payment processed successfully",
        payment_id: paymentResult.insertId,
        receipt_uploaded: !!req.file,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Payment creation error:", error);

      // Clean up uploaded file if error occurs
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (fsError) {
          console.error("Failed to clean up uploaded file:", fsError);
        }
      }

      res.status(500).json({ error: "Failed to process payment" });
    } finally {
      connection.release();
    }
  }
);

// GET /api/payment-methods/active - Get active payment methods
app.get("/api/payment-methods/active", authenticateToken, async (req, res) => {
  try {
    const [methods] = await pool.execute(`
      SELECT method_id, method_name, method_type, processing_fee_percentage, method_description
      FROM payment_methods
      WHERE is_active = TRUE
      ORDER BY method_name
    `);
    res.json(methods);
  } catch (error) {
    console.error("Active payment methods fetch error:", error);
    res.status(500).json({ error: "Failed to fetch active payment methods" });
  }
});

app.get(
  "/api/students/:studentId/account-balance",
  authenticateToken,
  authorize(["admin", "staff", "student"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [balanceInfo] = await pool.execute(
        `
      SELECT 
        sa.account_id,
        sa.total_due,
        sa.amount_paid,
        sa.balance,
        sa.due_date,
        c.course_name,
        co.batch_identifier,
        COUNT(p.payment_id) as payment_count,
        MAX(p.payment_date) as last_payment_date
      FROM student_accounts sa
      JOIN course_offerings co ON sa.offering_id = co.offering_id
      JOIN courses c ON co.course_id = c.course_id
      LEFT JOIN payments p ON sa.account_id = p.account_id
      WHERE sa.student_id = ?
      GROUP BY sa.account_id
      ORDER BY sa.created_at DESC
    `,
        [studentId]
      );

      res.json(balanceInfo);
    } catch (error) {
      console.error("Student account balance fetch error:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch student account balance" });
    }
  }
);

app.get(
  "/api/students/:studentId/payments",
  authenticateToken,
  authorize(["admin", "staff", "student"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [payments] = await pool.execute(
        `
      SELECT p.payment_id, p.payment_amount, p.processing_fee, p.payment_date, p.payment_status,
             p.reference_number, pm.method_name,
             sa.total_due, sa.balance,
             c.course_name, co.batch_identifier
      FROM payments p
      JOIN payment_methods pm ON p.method_id = pm.method_id
      JOIN student_accounts sa ON p.account_id = sa.account_id
      JOIN course_offerings co ON sa.offering_id = co.offering_id
      JOIN courses c ON co.course_id = c.course_id
      WHERE sa.student_id = ?
      ORDER BY p.payment_date DESC
    `,
        [studentId]
      );

      res.json(payments);
    } catch (error) {
      console.error("Student payments fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student payments" });
    }
  }
);

app.get("/api/payment-methods", authenticateToken, async (req, res) => {
  try {
    const [methods] = await pool.execute(`
      SELECT method_id, method_name, method_type, processing_fee_percentage
      FROM payment_methods
      WHERE is_active = TRUE
      ORDER BY method_name
    `);
    res.json(methods);
  } catch (error) {
    console.error("Payment methods fetch error:", error);
    res.status(500).json({ error: "Failed to fetch payment methods" });
  }
});

app.get("/api/document-types", authenticateToken, async (req, res) => {
  try {
    const [types] = await pool.execute(`
      SELECT document_type_id, type_name, category, is_required, required_for
      FROM document_types
      WHERE is_active = TRUE
      ORDER BY is_required DESC, type_name
    `);
    res.json(types);
  } catch (error) {
    console.error("Document types fetch error:", error);
    res.status(500).json({ error: "Failed to fetch document types" });
  }
});

app.get("/api/competencies", authenticateToken, async (req, res) => {
  try {
    const [competencies] = await pool.execute(`
      SELECT c.competency_id, c.competency_code, c.competency_name, c.competency_description,
             ct.type_name as competency_type, ct.passing_score
      FROM competencies c
      JOIN competency_types ct ON c.competency_type_id = ct.competency_type_id
      WHERE c.is_active = TRUE
      ORDER BY ct.type_name, c.competency_name
    `);
    res.json(competencies);
  } catch (error) {
    console.error("Competencies fetch error:", error);
    res.status(500).json({ error: "Failed to fetch competencies" });
  }
});

// ============================================================================
// USER PROFILE ROUTES (Fixed)
// ============================================================================

app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const [userProfile] = await pool.execute(
      `
      SELECT a.account_id, a.account_status,
             p.first_name, p.middle_name, p.last_name, p.birth_date, p.birth_place, p.gender,
             r.role_name, r.permissions
      FROM accounts a
      JOIN account_roles ar ON a.account_id = ar.account_id
      JOIN roles r ON ar.role_id = r.role_id
      LEFT JOIN staff st ON a.account_id = st.account_id
      LEFT JOIN students s ON a.account_id = s.account_id
      LEFT JOIN persons p ON (st.person_id = p.person_id OR s.person_id = p.person_id)
      WHERE a.account_id = ? AND ar.is_active = TRUE
    `,
      [req.user.accountId]
    );

    if (userProfile.length === 0) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const [contacts] = await pool.execute(
      `
      SELECT contact_type, contact_value, is_primary
      FROM contact_info
      WHERE person_id = ?
    `,
      [req.user.personId]
    );

    res.json({
      ...userProfile[0],
      contacts,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

app.put(
  "/api/profile",
  [
    authenticateToken,
    body("first_name").optional().trim().isLength({ min: 1, max: 50 }),
    body("last_name").optional().trim().isLength({ min: 1, max: 50 }),
    body("email").optional().isEmail(),
    body("phone").optional().isMobilePhone(),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const { first_name, middle_name, last_name, email, phone, address } =
        req.body;

      // Update person information
      if (first_name || middle_name || last_name) {
        await connection.execute(
          `
        UPDATE persons 
        SET first_name = COALESCE(?, first_name),
            middle_name = COALESCE(?, middle_name),
            last_name = COALESCE(?, last_name)
        WHERE person_id = ?
      `,
          [first_name, middle_name, last_name, req.user.personId]
        );
      }

      // Update or insert contact information
      if (email) {
        await connection.execute(
          `
        INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary)
        VALUES (?, ?, 'email', ?, TRUE)
        ON DUPLICATE KEY UPDATE contact_value = VALUES(contact_value)
      `,
          [req.user.personId, req.user.userId, email]
        );
      }

      if (phone) {
        await connection.execute(
          `
        INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary)
        VALUES (?, ?, 'phone', ?, TRUE)
        ON DUPLICATE KEY UPDATE contact_value = VALUES(contact_value)
      `,
          [req.user.personId, req.user.userId, phone]
        );
      }

      if (address) {
        await connection.execute(
          `
        INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary)
        VALUES (?, ?, 'address', ?, TRUE)
        ON DUPLICATE KEY UPDATE contact_value = VALUES(contact_value)
      `,
          [req.user.personId, req.user.userId, address]
        );
      }

      await connection.commit();
      res.json({ message: "Profile updated successfully" });
    } catch (error) {
      await connection.rollback();
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    } finally {
      connection.release();
    }
  }
);

// ============================================================================
// ADMIN ROUTES (Updated for synced IDs)
// ============================================================================

app.get(
  "/api/admin/accounts",
  authenticateToken,
  authorize(["admin"]),
  async (req, res) => {
    try {
      const [accounts] = await pool.execute(`
      SELECT a.account_id, a.account_status, a.last_login,
             p.first_name, p.last_name, r.role_name,
             COALESCE(s.student_id, st.staff_id) as user_identifier
      FROM accounts a
      JOIN account_roles ar ON a.account_id = ar.account_id
      JOIN roles r ON ar.role_id = r.role_id
      LEFT JOIN staff st ON a.account_id = st.account_id
      LEFT JOIN students s ON a.account_id = s.account_id
      LEFT JOIN persons p ON a.account_id = p.person_id
      WHERE ar.is_active = TRUE
      ORDER BY a.
    `);

      res.json(accounts);
    } catch (error) {
      console.error("Admin accounts fetch error:", error);
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  }
);

app.put(
  "/api/admin/accounts/:accountId/status",
  [
    authenticateToken,
    authorize(["admin"]),
    body("status").isIn(["active", "inactive", "suspended"]),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { accountId } = req.params;
      const { status } = req.body;

      await pool.execute(
        `
      UPDATE accounts 
      SET account_status = ?
      WHERE account_id = ?
    `,
        [status, accountId]
      );

      res.json({ message: "Account status updated successfully" });
    } catch (error) {
      console.error("Account status update error:", error);
      res.status(500).json({ error: "Failed to update account status" });
    }
  }
);

app.post(
  "/api/admin/staff",
  [
    authenticateToken,
    authorize(["admin"]),
    body("first_name").trim().isLength({ min: 1, max: 50 }).escape(),
    body("last_name").trim().isLength({ min: 1, max: 50 }).escape(),
    body("birth_place").trim().isLength({ min: 1, max: 100 }).escape(),
    body("email").isEmail().normalizeEmail(),
    body("education").trim().isLength({ min: 1, max: 100 }).escape(),
    body("").trim().isLength({ min: 3, max: 50 }).escape(),
    body("password").isLength({ min: 6 }),
    body("role").isIn(["staff", "admin"]),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      const {
        first_name,
        middle_name,
        last_name,
        birth_date,
        birth_place,
        gender,
        email,
        education,
        phone,
        password,
        role,
        employee_id,
      } = req.body;

      // Use stored procedure for synced creation
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const [result] = await connection.execute(
        `
      CALL sp_register_user_with_synced_ids(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @account_id, @result)
    `,
        [
          hashedPassword,
          first_name,
          middle_name,
          last_name,
          birth_date,
          birth_place,
          gender || "Other",
          email,
          education,
          phone,
          null,
          role,
        ]
      );

      const [output] = await connection.execute(
        `SELECT @account_id as account_id, @result as result`
      );
      const { account_id, result: procedureResult } = output[0];

      if (!procedureResult.startsWith("SUCCESS")) {
        return res.status(400).json({ error: procedureResult });
      }

      // Update employee_id if provided
      if (employee_id) {
        await connection.execute(
          `
        UPDATE staff 
        SET employee_id = ?
        WHERE account_id = ?
      `,
          [employee_id, account_id]
        );
      }

      res.status(201).json({
        account_id,
        message: "Staff account created successfully",
      });
    } catch (error) {
      console.error("Staff creation error:", error);

      if (error.code === "ER_DUP_ENTRY") {
        res.status(409).json({ error: " already exists" });
      } else {
        res.status(500).json({ error: "Failed to create staff account" });
      }
    } finally {
      connection.release();
    }
  }
);

app.get(
  "/api/admin/staff",
  authenticateToken,
  authorize(["admin"]),
  async (req, res) => {
    try {
      const [staff] = await pool.execute(`
      SELECT 
        s.staff_id,
        s.employee_id,
        s.hire_date,
        p.person_id,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.birth_date,
        p.birth_place,
        p.gender,
        p.email,
        p.education,
        a.account_id,
        a.account_status,
        a.last_login,
        r.role_name,
        GROUP_CONCAT(
          CASE 
            WHEN ci.contact_type = 'phone' THEN ci.contact_value
            ELSE NULL
          END
        ) as phone_numbers,
        GROUP_CONCAT(
          CASE 
            WHEN ci.contact_type = 'email' AND ci.is_primary = TRUE THEN ci.contact_value
            ELSE NULL
          END
        ) as primary_email
      FROM staff s
      JOIN persons p ON s.person_id = p.person_id
      JOIN accounts a ON s.account_id = a.account_id
      JOIN account_roles ar ON a.account_id = ar.account_id
      JOIN roles r ON ar.role_id = r.role_id
      LEFT JOIN contact_info ci ON p.person_id = ci.person_id
      WHERE ar.is_active = TRUE
      GROUP BY s.staff_id, s.employee_id, s.hire_date, p.person_id, 
               p.first_name, p.middle_name, p.last_name, p.birth_date, 
               p.birth_place, p.gender, p.email, p.education, 
               a.account_id, a.account_status, a.last_login, r.role_name
      ORDER BY p.last_name, p.first_name
    `);

      // Format data to match what the React component expects (flat structure)
      const formattedStaff = staff.map((staffMember) => ({
        staff_id: staffMember.staff_id,
        employee_id: staffMember.employee_id,
        hire_date: staffMember.hire_date,
        person_id: staffMember.person_id,
        first_name: staffMember.first_name,
        middle_name: staffMember.middle_name,
        last_name: staffMember.last_name,
        full_name: `${staffMember.first_name} ${
          staffMember.middle_name ? staffMember.middle_name + " " : ""
        }${staffMember.last_name}`,
        birth_date: staffMember.birth_date,
        birth_place: staffMember.birth_place,
        gender: staffMember.gender,
        email: staffMember.email,
        education: staffMember.education,
        account_id: staffMember.account_id,
        account_status: staffMember.account_status,
        last_login: staffMember.last_login,
        role_name: staffMember.role_name, // This is what the component expects
        primary_email: staffMember.primary_email,
        phone_numbers: staffMember.phone_numbers
          ? staffMember.phone_numbers.split(",").filter((phone) => phone)
          : [],
      }));

      console.log("Found " + formattedStaff.length + " staff members");
      res.json(formattedStaff);
    } catch (error) {
      console.error("Admin staff fetch error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch staff data",
      });
    }
  }
);

app.get(
  "/api/admin/verify-relationships",
  [authenticateToken, authorize(["admin"])],
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      const issues = [];
      const repairs = [];

      // Check for students without trading levels
      const [studentsWithoutLevels] = await connection.execute(`
      SELECT s.student_id, p.first_name, p.last_name
      FROM students s
      JOIN persons p ON s.person_id = p.person_id
      LEFT JOIN student_trading_levels stl ON s.student_id = stl.student_id AND stl.is_current = TRUE
      WHERE stl.student_id IS NULL
    `);

      if (studentsWithoutLevels.length > 0) {
        issues.push({
          type: "missing_trading_level",
          count: studentsWithoutLevels.length,
          details: studentsWithoutLevels,
        });

        // Fix missing trading levels
        for (const student of studentsWithoutLevels) {
          await connection.execute(
            `
          INSERT INTO student_trading_levels (student_id, level_id, is_current)
          VALUES (?, 1, TRUE)
        `,
            [student.student_id]
          );

          repairs.push({
            type: "trading_level_added",
            student_id: student.student_id,
            level_id: 1,
          });
        }
      }

      // Check for students without learning preferences
      const [studentsWithoutPreferences] = await connection.execute(`
      SELECT s.student_id, p.first_name, p.last_name
      FROM students s
      JOIN persons p ON s.person_id = p.person_id
      LEFT JOIN learning_preferences lp ON s.student_id = lp.student_id
      WHERE lp.preference_id IS NULL
    `);

      if (studentsWithoutPreferences.length > 0) {
        issues.push({
          type: "missing_learning_preferences",
          count: studentsWithoutPreferences.length,
          details: studentsWithoutPreferences,
        });

        // Fix missing learning preferences
        for (const student of studentsWithoutPreferences) {
          await connection.execute(
            `
          INSERT INTO learning_preferences (student_id, learning_style, delivery_preference, preferred_schedule)
          VALUES (?, 'mixed', 'hybrid', 'flexible')
        `,
            [student.student_id]
          );

          repairs.push({
            type: "learning_preferences_added",
            student_id: student.student_id,
          });
        }
      }

      // Check for students without contact info
      const [studentsWithoutContact] = await connection.execute(`
      SELECT s.student_id, p.first_name, p.last_name, p.email
      FROM students s
      JOIN persons p ON s.person_id = p.person_id
      LEFT JOIN contact_info ci ON s.student_id = ci.student_id AND ci.contact_type = 'email'
      WHERE ci.contact_id IS NULL
    `);

      if (studentsWithoutContact.length > 0) {
        issues.push({
          type: "missing_contact_info",
          count: studentsWithoutContact.length,
          details: studentsWithoutContact,
        });

        // Fix missing contact info
        for (const student of studentsWithoutContact) {
          await connection.execute(
            `
          INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary)
          VALUES (?, ?, 'email', ?, TRUE)
        `,
            [student.person_id, student.student_id, student.email]
          );

          repairs.push({
            type: "contact_info_added",
            student_id: student.student_id,
            contact_type: "email",
          });
        }
      }

      // Check for students without background records
      const [studentsWithoutBackground] = await connection.execute(`
      SELECT s.student_id, p.first_name, p.last_name
      FROM students s
      JOIN persons p ON s.person_id = p.person_id
      LEFT JOIN student_backgrounds sb ON s.student_id = sb.student_id
      WHERE sb.background_id IS NULL
    `);

      if (studentsWithoutBackground.length > 0) {
        issues.push({
          type: "missing_background",
          count: studentsWithoutBackground.length,
          details: studentsWithoutBackground,
        });

        // Fix missing backgrounds
        for (const student of studentsWithoutBackground) {
          await connection.execute(
            `
          INSERT INTO student_backgrounds (student_id, education_level, work_experience_years)
          VALUES (?, 'college', 0)
        `,
            [student.student_id]
          );

          repairs.push({
            type: "background_added",
            student_id: student.student_id,
          });
        }
      }

      // Check for accounts without roles
      const [accountsWithoutRoles] = await connection.execute(`
      SELECT a.account_id, p.first_name, p.last_name
      FROM accounts a
      JOIN persons p ON a.account_id = p.person_id
      LEFT JOIN account_roles ar ON a.account_id = ar.account_id
      WHERE ar.account_id IS NULL
    `);

      if (accountsWithoutRoles.length > 0) {
        issues.push({
          type: "missing_role_assignment",
          count: accountsWithoutRoles.length,
          details: accountsWithoutRoles,
        });
      }

      res.json({
        summary: {
          total_issues: issues.reduce((sum, issue) => sum + issue.count, 0),
          total_repairs: repairs.length,
          issues_found: issues.length > 0,
          repairs_made: repairs.length > 0,
        },
        issues,
        repairs,
      });
    } catch (error) {
      console.error("Relationship verification error:", error);
      res.status(500).json({ error: "Failed to verify relationships" });
    } finally {
      connection.release();
    }
  }
);

// Endpoint to check a specific user's relationships
app.get(
  "/api/admin/check-user-relationships/:accountId",
  [authenticateToken, authorize(["admin"])],
  async (req, res) => {
    const { accountId } = req.params;

    try {
      const relationships = {};

      // Check account
      const [account] = await pool.execute(
        "SELECT * FROM accounts WHERE account_id = ?",
        [accountId]
      );
      relationships.account = account[0] || null;

      // Check person
      const [person] = await pool.execute(
        "SELECT * FROM persons WHERE person_id = ?",
        [accountId]
      );
      relationships.person = person[0] || null;

      // Check role
      const [role] = await pool.execute(
        `
      SELECT ar.*, r.role_name 
      FROM account_roles ar
      JOIN roles r ON ar.role_id = r.role_id
      WHERE ar.account_id = ?
    `,
        [accountId]
      );
      relationships.role = role[0] || null;

      // If student, check student-specific tables
      if (relationships.role?.role_name === "student") {
        const [student] = await pool.execute(
          "SELECT * FROM students WHERE account_id = ?",
          [accountId]
        );
        relationships.student = student[0] || null;

        if (relationships.student) {
          const studentId = relationships.student.student_id;

          // Trading level
          const [tradingLevel] = await pool.execute(
            `
          SELECT stl.*, tl.level_name 
          FROM student_trading_levels stl
          JOIN trading_levels tl ON stl.level_id = tl.level_id
          WHERE stl.student_id = ? AND stl.is_current = TRUE
        `,
            [studentId]
          );
          relationships.trading_level = tradingLevel[0] || null;

          // Learning preferences
          const [preferences] = await pool.execute(
            "SELECT * FROM learning_preferences WHERE student_id = ?",
            [studentId]
          );
          relationships.learning_preferences = preferences[0] || null;

          // Contact info
          const [contacts] = await pool.execute(
            "SELECT * FROM contact_info WHERE student_id = ?",
            [studentId]
          );
          relationships.contacts = contacts;

          // Background
          const [background] = await pool.execute(
            "SELECT * FROM student_backgrounds WHERE student_id = ?",
            [studentId]
          );
          relationships.background = background[0] || null;

          // Goals
          const [goals] = await pool.execute(
            'SELECT * FROM student_goals WHERE student_id = ? AND status = "active"',
            [studentId]
          );
          relationships.goals = goals;

          // Documents
          const [documents] = await pool.execute(
            `
          SELECT sd.*, dt.type_name 
          FROM student_documents sd
          JOIN document_types dt ON sd.document_type_id = dt.document_type_id
          WHERE sd.student_id = ? AND sd.is_current = TRUE
        `,
            [studentId]
          );
          relationships.documents = documents;

          // Enrollments
          const [enrollments] = await pool.execute(
            "SELECT * FROM student_enrollments WHERE student_id = ?",
            [studentId]
          );
          relationships.enrollments = enrollments;
        }
      }

      // If staff, check staff-specific tables
      if (relationships.role?.role_name === "staff") {
        const [staff] = await pool.execute(
          "SELECT * FROM staff WHERE account_id = ?",
          [accountId]
        );
        relationships.staff = staff[0] || null;

        if (relationships.staff) {
          // Staff positions
          const [positions] = await pool.execute(
            `
          SELECT sp.*, p.position_title 
          FROM staff_positions sp
          JOIN positions p ON sp.position_id = p.position_id
          WHERE sp.staff_id = ?
        `,
            [relationships.staff.staff_id]
          );
          relationships.positions = positions;

          // Contact info (using employee_id)
          const [contacts] = await pool.execute(
            "SELECT * FROM contact_info WHERE student_id = ?",
            [relationships.staff.employee_id]
          );
          relationships.contacts = contacts;
        }
      }

      // Activity logs
      const [activities] = await pool.execute(
        "SELECT * FROM activity_logs WHERE account_id = ? ORDER BY created_at DESC LIMIT 10",
        [accountId]
      );
      relationships.recent_activities = activities;

      res.json({
        account_id: accountId,
        relationships,
        missing: {
          account: !relationships.account,
          person: !relationships.person,
          role: !relationships.role,
          student_specific:
            relationships.role?.role_name === "student"
              ? {
                  student_record: !relationships.student,
                  trading_level: !relationships.trading_level,
                  learning_preferences: !relationships.learning_preferences,
                  email_contact: !relationships.contacts?.find(
                    (c) => c.contact_type === "email"
                  ),
                  background: !relationships.background,
                }
              : null,
          staff_specific:
            relationships.role?.role_name === "staff"
              ? {
                  staff_record: !relationships.staff,
                  positions: relationships.positions?.length === 0,
                  email_contact: !relationships.contacts?.find(
                    (c) => c.contact_type === "email"
                  ),
                }
              : null,
        },
      });
    } catch (error) {
      console.error("User relationship check error:", error);
      res.status(500).json({ error: "Failed to check user relationships" });
    }
  }
);

// ============================================================================
// SYSTEM INFORMATION ROUTES (Fixed)
// ============================================================================

app.get(
  "/api/system/stats",
  authenticateToken,
  authorize(["admin"]),
  async (req, res) => {
    try {
      const [stats] = await pool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM students) as total_students,
        (SELECT COUNT(*) FROM staff) as total_staff,
        (SELECT COUNT(*) FROM courses WHERE is_active = TRUE) as total_courses,
        (SELECT COUNT(*) FROM course_offerings WHERE status = 'active') as active_offerings,
        (SELECT COUNT(*) FROM payments WHERE payment_status = 'confirmed') as confirmed_payments,
        (SELECT SUM(payment_amount) FROM payments WHERE payment_status = 'confirmed') as total_revenue,
        (SELECT COUNT(*) FROM student_documents WHERE verification_status = 'pending') as pending_documents,
        (SELECT COUNT(*) FROM student_scholarships WHERE scholarship_status = 'active') as active_scholarships
    `);

      res.json(stats[0]);
    } catch (error) {
      console.error("System stats error:", error);
      res.status(500).json({ error: "Failed to fetch system statistics" });
    }
  }
);

// ============================================================================
// STUDENT BACKGROUND AND PREFERENCES ROUTES (New)
// ============================================================================

app.get(
  "/api/students/:studentId/background",
  authenticateToken,
  authorize(["admin", "staff", "student"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [background] = await pool.execute(
        `
      SELECT sb.background_id, sb.education_level, sb.highest_degree, sb.institution, sb.graduation_year,
             sb.work_experience_years, sb.current_occupation, sb.industry, sb.annual_income_range,
             sb.financial_experience, sb.prior_trading_experience, sb.investment_portfolio_value,
             sb.relevant_skills, sb.certifications
      FROM student_backgrounds sb
      WHERE sb.student_id = ?
    `,
        [studentId]
      );

      res.json(background[0] || {});
    } catch (error) {
      console.error("Student background fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student background" });
    }
  }
);

app.post(
  "/api/students/:studentId/background",
  [
    authenticateToken,
    authorize(["admin", "staff", "student"]),
    authorizeStudentAccess,
    body("education_level")
      .optional()
      .isIn([
        "elementary",
        "high_school",
        "vocational",
        "college",
        "graduate",
        "post_graduate",
      ]),
    body("work_experience_years").optional().isInt({ min: 0 }),
    body("annual_income_range")
      .optional()
      .isIn(["below_100k", "100k_300k", "300k_500k", "500k_1m", "above_1m"]),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const {
        education_level,
        highest_degree,
        institution,
        graduation_year,
        work_experience_years,
        current_occupation,
        industry,
        annual_income_range,
        financial_experience,
        prior_trading_experience,
        investment_portfolio_value,
        relevant_skills,
        certifications,
      } = req.body;

      await pool.execute(
        `
      INSERT INTO student_backgrounds (
        student_id, education_level, highest_degree, institution, graduation_year,
        work_experience_years, current_occupation, industry, annual_income_range,
        financial_experience, prior_trading_experience, investment_portfolio_value,
        relevant_skills, certifications
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        education_level = VALUES(education_level),
        highest_degree = VALUES(highest_degree),
        institution = VALUES(institution),
        graduation_year = VALUES(graduation_year),
        work_experience_years = VALUES(work_experience_years),
        current_occupation = VALUES(current_occupation),
        industry = VALUES(industry),
        annual_income_range = VALUES(annual_income_range),
        financial_experience = VALUES(financial_experience),
        prior_trading_experience = VALUES(prior_trading_experience),
        investment_portfolio_value = VALUES(investment_portfolio_value),
        relevant_skills = VALUES(relevant_skills),
        certifications = VALUES(certifications)
    `,
        [
          studentId,
          education_level,
          highest_degree,
          institution,
          graduation_year,
          work_experience_years,
          current_occupation,
          industry,
          annual_income_range,
          financial_experience,
          prior_trading_experience,
          investment_portfolio_value,
          relevant_skills,
          certifications,
        ]
      );

      res.json({ message: "Student background updated successfully" });
    } catch (error) {
      console.error("Student background update error:", error);
      res.status(500).json({ error: "Failed to update student background" });
    }
  }
);

app.get(
  "/api/students/:studentId/preferences",
  authenticateToken,
  authorize(["admin", "staff", "student"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [preferences] = await pool.execute(
        `
      SELECT lp.preference_id, lp.learning_style, lp.delivery_preference, lp.device_type,
             lp.internet_speed, lp.preferred_schedule, lp.study_hours_per_week, lp.accessibility_needs
      FROM learning_preferences lp
      WHERE lp.student_id = ?
    `,
        [studentId]
      );

      res.json(preferences[0] || {});
    } catch (error) {
      console.error("Student preferences fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student preferences" });
    }
  }
);

app.post(
  "/api/students/:studentId/preferences",
  [
    authenticateToken,
    authorize(["admin", "staff", "student"]),
    authorizeStudentAccess,
    body("learning_style")
      .optional()
      .isIn(["visual", "auditory", "kinesthetic", "reading_writing", "mixed"]),
    body("delivery_preference")
      .optional()
      .isIn(["in-person", "online", "hybrid", "self-paced"]),
    body("preferred_schedule")
      .optional()
      .isIn(["morning", "afternoon", "evening", "weekend", "flexible"]),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const {
        learning_style,
        delivery_preference,
        device_type,
        internet_speed,
        preferred_schedule,
        study_hours_per_week,
        accessibility_needs,
      } = req.body;

      await pool.execute(
        `
      INSERT INTO learning_preferences (
        student_id, learning_style, delivery_preference, device_type, internet_speed,
        preferred_schedule, study_hours_per_week, accessibility_needs
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        learning_style = VALUES(learning_style),
        delivery_preference = VALUES(delivery_preference),
        device_type = VALUES(device_type),
        internet_speed = VALUES(internet_speed),
        preferred_schedule = VALUES(preferred_schedule),
        study_hours_per_week = VALUES(study_hours_per_week),
        accessibility_needs = VALUES(accessibility_needs)
    `,
        [
          studentId,
          learning_style,
          delivery_preference,
          device_type,
          internet_speed,
          preferred_schedule,
          study_hours_per_week,
          accessibility_needs,
        ]
      );

      res.json({ message: "Student preferences updated successfully" });
    } catch (error) {
      console.error("Student preferences update error:", error);
      res.status(500).json({ error: "Failed to update student preferences" });
    }
  }
);

// ============================================================================
// STUDENT GOALS ROUTES (New)
// ============================================================================

app.get(
  "/api/students/:studentId/goals",
  authenticateToken,
  authorize(["admin", "staff", "student"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [goals] = await pool.execute(
        `
      SELECT sg.goal_id, sg.goal_type, sg.goal_title, sg.goal_description, sg.target_date,
             sg.target_amount, sg.priority_level, sg.status, sg.progress_percentage,
             sg.created_at, sg.updated_at
      FROM student_goals sg
      WHERE sg.student_id = ?
      ORDER BY sg.priority_level DESC, sg.created_at DESC
    `,
        [studentId]
      );

      res.json(goals);
    } catch (error) {
      console.error("Student goals fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student goals" });
    }
  }
);

app.post(
  "/api/students/:studentId/goals",
  [
    authenticateToken,
    authorize(["admin", "staff", "student"]),
    authorizeStudentAccess,
    body("goal_type").isIn([
      "career",
      "financial",
      "personal",
      "academic",
      "skill",
    ]),
    body("goal_title").trim().isLength({ min: 1, max: 100 }),
    body("goal_description").trim().isLength({ min: 1, max: 1000 }),
    body("priority_level")
      .optional()
      .isIn(["low", "medium", "high", "critical"]),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const {
        goal_type,
        goal_title,
        goal_description,
        target_date,
        target_amount,
        priority_level,
      } = req.body;

      await pool.execute(
        `
      INSERT INTO student_goals (
        student_id, goal_type, goal_title, goal_description, target_date,
        target_amount, priority_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
        [
          studentId,
          goal_type,
          goal_title,
          goal_description,
          target_date || null,
          target_amount || null,
          priority_level || "medium",
        ]
      );

      res.status(201).json({ message: "Student goal created successfully" });
    } catch (error) {
      console.error("Student goal creation error:", error);
      res.status(500).json({ error: "Failed to create student goal" });
    }
  }
);

app.put(
  "/api/students/:studentId/goals/:goalId",
  [
    authenticateToken,
    authorize(["admin", "staff", "student"]),
    authorizeStudentAccess,
    body("status")
      .optional()
      .isIn(["active", "achieved", "paused", "cancelled", "expired"]),
    body("progress_percentage").optional().isFloat({ min: 0, max: 100 }),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { studentId, goalId } = req.params;
      const { status, progress_percentage, goal_title, goal_description } =
        req.body;

      await pool.execute(
        `
      UPDATE student_goals 
      SET status = COALESCE(?, status),
          progress_percentage = COALESCE(?, progress_percentage),
          goal_title = COALESCE(?, goal_title),
          goal_description = COALESCE(?, goal_description),
          updated_at = CURRENT_TIMESTAMP
      WHERE goal_id = ? AND student_id = ?
    `,
        [
          status,
          progress_percentage,
          goal_title,
          goal_description,
          goalId,
          studentId,
        ]
      );

      res.json({ message: "Student goal updated successfully" });
    } catch (error) {
      console.error("Student goal update error:", error);
      res.status(500).json({ error: "Failed to update student goal" });
    }
  }
);

// ============================================================================
// PASSWORD CHANGE ROUTE (Fixed)
// ============================================================================

app.post(
  "/api/auth/change-password",
  [
    authenticateToken,
    body("currentPassword").isLength({ min: 6 }),
    body("newPassword")
      .isLength({ min: 6 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const accountId = req.user.accountId;

      const [userRows] = await pool.execute(
        "SELECT password_hash FROM accounts WHERE account_id = ?",
        [accountId]
      );

      if (userRows.length === 0) {
        return res.status(404).json({ error: "Account not found" });
      }

      const isValidPassword = await bcrypt.compare(
        currentPassword,
        userRows[0].password_hash
      );
      if (!isValidPassword) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      await pool.execute(
        "UPDATE accounts SET password_hash = ? WHERE account_id = ?",
        [newPasswordHash, accountId]
      );

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ error: "Password change failed" });
    }
  }
);

// ============================================================================
// STUDENT REGISTRATION ENDPOINT (Public - Updated to use stored procedure)
// ============================================================================

app.post(
  "/api/students/register",
  [
    authenticateToken,
    authorize(["admin", "instructor", "staff"]),
    body("first_name")
      .trim()
      .notEmpty()
      .withMessage("First name is required")
      .isLength({ max: 50 }),
    body("last_name")
      .trim()
      .notEmpty()
      .withMessage("Last name is required")
      .isLength({ max: 50 }),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("course_id")
      .isInt({ min: 1 })
      .withMessage("Valid course ID is required"),

    // Optional fields - properly configured to allow null/undefined
    body("middle_name").optional({ checkFalsy: true }).trim(),
    body("birth_date").optional({ checkFalsy: true }).isISO8601(),
    body("birth_place").optional({ checkFalsy: true }).trim(),
    body("gender")
      .optional({ checkFalsy: true })
      .isIn(["Male", "Female", "Other"]),
    body("education").optional({ checkFalsy: true }).trim(),
    body("phone").optional({ checkFalsy: true }).trim(),
    body("address").optional({ checkFalsy: true }).trim(),
    body("trading_level_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
    body("referred_by").optional({ checkFalsy: true }).isInt({ min: 1 }),
    body("device_type").optional({ checkFalsy: true }).isString(),
    body("learning_style").optional({ checkFalsy: true }).isString(),
    body("scheme_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
    body("total_due").optional({ checkFalsy: true }).isFloat({ min: 0 }),
    body("amount_paid").optional({ checkFalsy: true }).isFloat({ min: 0 }),
  ],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const {
        first_name,
        middle_name,
        last_name,
        birth_date,
        birth_place,
        gender,
        email,
        education,
        phone,
        address,
        course_id,
        scheme_id,
        total_due,
        amount_paid,
        referred_by,
        trading_level_id,
        device_type,
        learning_style,
      } = req.body;

      console.log("📝 Received registration data:", {
        first_name,
        last_name,
        email,
        course_id,
        optional_fields: {
          middle_name,
          birth_date,
          birth_place,
          gender,
          education,
          phone,
          address,
        },
      });

      // Step 1: Get course details first
      const [courseInfo] = await connection.execute(`
        SELECT 
          c.course_name, 
          c.duration_weeks, 
          c.course_code, 
          c.course_id
        FROM courses c
        WHERE c.course_id = ?
      `, [course_id]);

      if (courseInfo.length === 0) {
        await connection.rollback();
        return res.status(404).json({ 
          error: 'Course not found' 
        });
      }

      const courseData = courseInfo[0];

      // Step 2: Check for existing enrollment
      const [existing] = await connection.execute(
        `
        SELECT sa.account_id, p.email
        FROM student_accounts sa
        JOIN students s ON sa.student_id = s.student_id
        JOIN persons p ON s.person_id = p.person_id
        JOIN course_offerings co ON sa.offering_id = co.offering_id
        WHERE p.email = ? AND co.course_id = ?
      `,
        [email, course_id]
      );

      if (existing.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          error: "Student with this email is already enrolled in this course.",
        });
      }

      // Step 3: Find available course offerings or create new batch
      let [availableOfferings] = await connection.execute(`
        SELECT co.offering_id, co.course_id, co.batch_identifier, co.start_date, 
               co.end_date, co.max_enrollees, co.current_enrollees, co.status,
               c.course_name, c.duration_weeks, c.course_code
        FROM course_offerings co
        INNER JOIN courses c ON co.course_id = c.course_id
        WHERE co.course_id = ? 
          AND co.status IN ('planned', 'active')
          AND co.current_enrollees < co.max_enrollees
          AND co.end_date > NOW()
        ORDER BY 
          CASE WHEN co.status = 'planned' THEN 1 ELSE 2 END,
          co.start_date ASC
        LIMIT 1
      `, [course_id]);

      let courseOffering;
      let offering_id;
      let isNewBatch = false;

      // Check if we need to create a new batch
      if (availableOfferings.length === 0) {
        console.log('🆕 Creating new batch - no available offerings found...');
        
        // Get the latest batch identifier to generate the next one
        const [latestBatch] = await connection.execute(`
          SELECT batch_identifier, start_date, max_enrollees
          FROM course_offerings
          WHERE course_id = ?
          ORDER BY CAST(SUBSTRING_INDEX(batch_identifier, '-', -1) AS UNSIGNED) DESC,
                   created_at DESC
          LIMIT 1
        `, [course_id]);

        let newBatchIdentifier;
        let newStartDate;
        let maxEnrollees = 30; // Default

        if (latestBatch.length > 0) {
          // Extract batch number and increment
          const latestBatchId = latestBatch[0].batch_identifier;
          const batchPattern = /^(.+)-(\d{4})-(\d+)$/;
          const match = latestBatchId.match(batchPattern);
          
          if (match) {
            const [, coursePrefix, year, batchNum] = match;
            const currentYear = new Date().getFullYear();
            
            // If it's a new year, start from 01, otherwise increment
            if (parseInt(year) < currentYear) {
              newBatchIdentifier = `${coursePrefix}-${currentYear}-01`;
            } else {
              const nextBatchNum = parseInt(batchNum) + 1;
              newBatchIdentifier = `${coursePrefix}-${year}-${String(nextBatchNum).padStart(2, '0')}`;
            }
          } else {
            // Fallback if batch identifier doesn't match expected pattern
            newBatchIdentifier = `${courseData.course_code}-${new Date().getFullYear()}-01`;
          }
          
          // Set start date 2 weeks after the latest batch start date
          const latestStartDate = new Date(latestBatch[0].start_date);
          newStartDate = new Date(latestStartDate);
          newStartDate.setDate(newStartDate.getDate() + 14); // 2 weeks later
          
          maxEnrollees = latestBatch[0].max_enrollees || 30;
        } else {
          // First batch for this course
          newBatchIdentifier = `${courseData.course_code}-${new Date().getFullYear()}-01`;
          newStartDate = new Date();
          newStartDate.setDate(newStartDate.getDate() + 7); // Start next week
        }
        
        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newStartDate.getDate() + (courseData.duration_weeks * 7));

        // Create new course offering
        const [newOfferingResult] = await connection.execute(`
          INSERT INTO course_offerings (
            course_id, batch_identifier, start_date, end_date, 
            max_enrollees, current_enrollees, status, location, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 0, 'planned', 'Online', NOW(), NOW())
        `, [course_id, newBatchIdentifier, newStartDate, newEndDate, maxEnrollees]);

        offering_id = newOfferingResult.insertId;
        isNewBatch = true;

        // Create courseOffering object for the new batch
        courseOffering = {
          offering_id: offering_id,
          course_id: course_id,
          batch_identifier: newBatchIdentifier,
          start_date: newStartDate,
          end_date: newEndDate,
          max_enrollees: maxEnrollees,
          current_enrollees: 0,
          status: 'planned',
          course_name: courseData.course_name,
          duration_weeks: courseData.duration_weeks,
          course_code: courseData.course_code
        };

        // Create default pricing for new batch
        await connection.execute(`
          INSERT INTO course_pricing (
            offering_id, amount, pricing_type, currency, 
            effective_date, is_active
          ) VALUES (?, 0, 'regular', 'PHP', NOW(), 1)
        `, [offering_id]);

        console.log(`✅ Created new batch: ${newBatchIdentifier} for course ${courseData.course_name}`);
      } else {
        // Use existing available offering
        courseOffering = availableOfferings[0];
        offering_id = courseOffering.offering_id;
        
        console.log("📚 Found available course offering:", {
          offering_id,
          course_name: courseOffering.course_name,
          batch: courseOffering.batch_identifier,
        });
      }

      // Step 4: Get pricing information
      const [pricingData] = await connection.execute(`
        SELECT amount FROM course_pricing 
        WHERE offering_id = ? AND pricing_type = 'regular' AND is_active = 1
        ORDER BY effective_date DESC 
        LIMIT 1
      `, [offering_id]);

      const serverCalculatedPrice = pricingData.length > 0 ? parseFloat(pricingData[0].amount) : 0;
      const totalDue = total_due ? parseFloat(total_due) : serverCalculatedPrice;
      const amountPaid = amount_paid ? parseFloat(amount_paid) : 0;
      const balance = totalDue - amountPaid;
      const dueDate = balance > 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;

      // Step 5: Generate and hash password
      const generatedPassword = generateRandomPassword();
      const password_hash = await bcrypt.hash(generatedPassword, 10);

      console.log("🔐 Generated password for student");

      // Step 6: Call stored procedure to create user + student
      await connection.query(
        `
        CALL sp_register_user_with_synced_ids(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @p_account_id, @p_result);
      `,
        [
          password_hash,
          first_name,
          middle_name || null,
          last_name,
          birth_date || null,
          birth_place || null,
          gender || null,
          email,
          education || null,
          phone || null,
          address || null,
          "student",
        ]
      );

      const [selectResult] = await connection.query(`
        SELECT @p_account_id AS account_id, @p_result AS result;
      `);

      const resultRow = selectResult[0];
      const account_id = resultRow.account_id;
      const result = resultRow.result;

      console.log("👤 Stored procedure result:", { account_id, result });

      if (!account_id || !result.startsWith("SUCCESS")) {
        await connection.rollback();
        return res.status(500).json({
          error: "Failed to register student: " + result,
        });
      }

      // Step 7: Get the student_id
      const [studentResult] = await connection.execute(
        `
        SELECT student_id FROM students WHERE account_id = ?
      `,
        [account_id]
      );

      if (studentResult.length === 0) {
        await connection.rollback();
        return res.status(500).json({
          error: "Failed to retrieve student ID after registration",
        });
      }

      const student_id = studentResult[0].student_id;
      console.log("🎓 Student created with ID:", student_id);

      // Step 8: Update trading level if provided
      if (trading_level_id && trading_level_id !== 1) {
        await connection.execute(
          `
          UPDATE student_trading_levels 
          SET is_current = FALSE 
          WHERE student_id = ? AND is_current = TRUE
        `,
          [student_id]
        );

        await connection.execute(
          `
          INSERT INTO student_trading_levels (student_id, level_id, is_current, assigned_by, assigned_date)
          VALUES (?, ?, TRUE, ?, NOW())
        `,
          [student_id, trading_level_id, req.user.staffId || null]
        );

        console.log("📊 Updated trading level:", trading_level_id);
      }

      // Step 9: Update learning preferences if provided
      if (device_type || learning_style) {
        const updateFields = [];
        const updateValues = [];

        if (device_type) {
          updateFields.push("device_type = ?");
          updateValues.push(device_type);
        }

        if (learning_style) {
          updateFields.push("learning_style = ?");
          updateValues.push(learning_style);
        }

        if (updateFields.length > 0) {
          updateValues.push(student_id);
          await connection.execute(
            `
            UPDATE learning_preferences 
            SET ${updateFields.join(", ")}, updated_at = NOW()
            WHERE student_id = ?
          `,
            updateValues
          );

          console.log("🎯 Updated learning preferences");
        }
      }

      // Step 10: Insert into student_accounts
      await connection.execute(
        `
        INSERT INTO student_accounts (
          student_id, offering_id, total_due, amount_paid, balance,
          scheme_id, account_status, due_date, payment_reminder_count,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
        [
          student_id,
          offering_id,
          totalDue,
          amountPaid,
          balance,
          scheme_id ? parseInt(scheme_id) : null,
          balance > 0 ? "pending" : "paid",
          dueDate,
          0,
        ]
      );

      console.log("💰 Created student account with balance:", balance);

      // Step 11: Create enrollment record
      const startDate = new Date(courseOffering.start_date);
      const completionDate = new Date(startDate);
      completionDate.setDate(startDate.getDate() + courseOffering.duration_weeks * 7);

      await connection.execute(
        `
        INSERT INTO student_enrollments(
          student_id, offering_id, enrollment_date, enrollment_status, completion_date,
          final_grade, completion_percentage, attendance_percentage
        ) VALUES (?, ?, NOW(), 'enrolled', ?, ?, ?, ?)
      `,
        [student_id, offering_id, completionDate, null, 0.00, null]
      );

      // Step 12: Add referral if provided
      if (referred_by) {
        try {
          // Verify referrer exists
          const [referrerCheck] = await connection.execute(
            `
            SELECT student_id FROM students WHERE student_id = ?
          `,
            [referred_by]
          );

          if (referrerCheck.length > 0) {
            await connection.execute(
              `
              INSERT INTO student_referrals (
                student_id, referrer_student_id, referral_date, source_id
              ) VALUES (?, ?, NOW(), 1)
            `,
              [student_id, referred_by]
            );

            console.log("👥 Added referral from:", referred_by);
          }
        } catch (referralError) {
          console.warn("⚠️ Failed to add referral:", referralError.message);
          // Don't fail the entire registration for referral issues
        }
      }

      // Step 13: Update course offering
      await connection.execute(
        `
        UPDATE course_offerings
        SET current_enrollees = current_enrollees + 1,
            status = IF(status = 'planned', 'active', status),
            updated_at = NOW()
        WHERE offering_id = ?
      `,
        [offering_id]
      );

      console.log("📈 Updated course offering enrollment count");

      await connection.commit();
      console.log("✅ Transaction committed successfully");

      // Step 14: Send email credentials
      let emailSent = false;
      let emailError = null;

      try {
        if (emailTransporter) {
          emailSent = await sendPasswordEmail(
            email,
            generatedPassword,
            first_name,
            last_name,
            courseOffering.course_name,
            courseOffering.batch_identifier
          );
          console.log("📧 Email sent successfully");
        } else {
          console.log("📧 Email service not configured");
        }
      } catch (err) {
        emailError = err.message;
        console.error("📧 Email sending failed:", err.message);
      }

      // Get updated enrollment count for response
      const [updatedOffering] = await connection.execute(`
        SELECT current_enrollees FROM course_offerings WHERE offering_id = ?
      `, [offering_id]);

      const currentEnrolleeCount = updatedOffering[0]?.current_enrollees || 0;

      // Final response
      res.status(201).json({
        message: isNewBatch 
          ? `Student registered successfully in new batch ${courseOffering.batch_identifier}`
          : "Student registered successfully",
        student_id,
        account_id,
        course_offering: {
          offering_id,
          batch_identifier: courseOffering.batch_identifier,
          course_name: courseOffering.course_name,
          course_code: courseOffering.course_code,
          start_date: courseOffering.start_date,
          end_date: courseOffering.end_date,
          current_enrollees: currentEnrolleeCount,
          max_enrollees: courseOffering.max_enrollees,
          is_new_batch: isNewBatch,
          batch_status: currentEnrolleeCount >= courseOffering.max_enrollees ? 'full' : 'available'
        },
        credentials: {
          email,
          password: generatedPassword,
        },
        financial: {
          total_due: totalDue,
          amount_paid: amountPaid,
          balance: balance,
          due_date: dueDate
        },
        email_sent: emailSent,
        email_error: emailError,
      });
    } catch (err) {
      await connection.rollback();
      console.error("❌ Registration error:", err);
      
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ 
          error: 'Student with this email already exists' 
        });
      }
      
      res.status(500).json({
        error: "Registration failed",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    } finally {
      connection.release();
    }
  }
);

// Helper function to generate random password
function generateRandomPassword(length = 12) {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";

  // Ensure at least one of each type
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";

  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

// Enhanced email function
async function sendPasswordEmail(
  email,
  password,
  firstName,
  lastName,
  courseName,
  batchIdentifier
) {
  if (!emailTransporter) {
    throw new Error("Email service not configured");
  }

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || "Trading Academy"}" <${
      process.env.EMAIL_USER
    }>`,
    to: email,
    subject: `Welcome to ${courseName} - Your Login Credentials`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d4a3d;">Welcome to Trading Academy!</h2>
        <p>Dear ${firstName} ${lastName},</p>
        <p>You have been successfully enrolled in <strong>${courseName}</strong> (Batch: ${batchIdentifier}).</p>
        <div style="background-color: #f5f2e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Your login credentials:</strong></p>
          <ul>
            <li>Email: ${email}</li>
            <li>Password: <code style="background-color: #fff; padding: 2px 4px; border-radius: 3px;">${password}</code></li>
          </ul>
        </div>
        <p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
        <p>You can log in to your account using your email address and the password provided above.</p>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <p>Best regards,<br>Trading Academy Team</p>
      </div>
    `,
  };

  await emailTransporter.sendMail(mailOptions);
  return true;
}

// Additional endpoint to manually enroll a student
app.post(
  "/api/enroll-student",
  [body("student_id").trim().isLength({ min: 1 }), body("offering_id").isInt()],
  validateInput,
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const { student_id, offering_id } = req.body;

      // Check if student exists
      const [studentCheck] = await connection.execute(
        `
      SELECT student_id FROM students WHERE student_id = ?
    `,
        [student_id]
      );

      if (studentCheck.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "Student not found" });
      }

      // Check if already enrolled in this offering
      const [existingEnrollment] = await connection.execute(
        `
      SELECT enrollment_id FROM student_enrollments 
      WHERE student_id = ? AND offering_id = ?
    `,
        [student_id, offering_id]
      );

      if (existingEnrollment.length > 0) {
        await connection.rollback();
        return res
          .status(409)
          .json({ error: "Student already enrolled in this course offering" });
      }

      // Get offering details
      const [offeringDetails] = await connection.execute(
        `
      SELECT 
        co.offering_id,
        co.start_date,
        co.end_date,
        c.duration_weeks,
        co.current_enrollees,
        co.max_enrollees,
        co.status
      FROM course_offerings co
      INNER JOIN courses c ON co.course_id = c.course_id
      WHERE co.offering_id = ?
    `,
        [offering_id]
      );

      if (offeringDetails.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "Course offering not found" });
      }

      const offering = offeringDetails[0];

      // Check if offering is available
      if (offering.status !== "planned" && offering.status !== "active") {
        await connection.rollback();
        return res
          .status(400)
          .json({ error: "Course offering is not available for enrollment" });
      }

      if (offering.current_enrollees >= offering.max_enrollees) {
        await connection.rollback();
        return res.status(400).json({ error: "Course offering is full" });
      }

      // Calculate completion date
      const startDate = new Date(offering.start_date);
      const completionDate = new Date(startDate);
      completionDate.setDate(startDate.getDate() + offering.duration_weeks * 7);

      // Create enrollment
      await connection.execute(
        `
      INSERT INTO student_enrollments (
        student_id, 
        offering_id, 
        enrollment_date, 
        enrollment_status, 
        completion_date, 
        completion_percentage
      ) VALUES (?, ?, CURRENT_TIMESTAMP, 'enrolled', ?, 0.00)
    `,
        [student_id, offering_id, completionDate]
      );

      // Update enrollee count
      await connection.execute(
        `
      UPDATE course_offerings 
      SET current_enrollees = current_enrollees + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE offering_id = ?
    `,
        [offering_id]
      );

      await connection.commit();

      res.status(201).json({
        message: "Student successfully enrolled",
        enrollment: {
          student_id,
          offering_id,
          enrollment_status: "enrolled",
          completion_date: completionDate.toISOString().split("T")[0],
          completion_percentage: 0.0,
          duration_weeks: offering.duration_weeks,
        },
      });
    } catch (error) {
      await connection.rollback();
      console.error("Enrollment error:", error);
      res
        .status(500)
        .json({ error: "Failed to enroll student: " + error.message });
    } finally {
      connection.release();
    }
  }
);

// GET /api/documents - Fetch all documents with filters
app.get(
  "/api/documents",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { verification_status, student_search } = req.query;

      let query = `
      SELECT 
        sd.document_id,
        sd.original_filename,
        sd.stored_filename,
        sd.file_path,
        sd.upload_date,
        sd.verification_status,
        sd.verified_date,
        sd.verification_notes,
        sd.is_current,
        dt.type_name as document_type,
        dt.is_required,
        dt.category,
        s.student_id,
        p.first_name,
        p.last_name,
        p.email,
        staff_p.first_name as verified_by_first_name,
        staff_p.last_name as verified_by_last_name
      FROM student_documents sd
      JOIN document_types dt ON sd.document_type_id = dt.document_type_id
      JOIN students s ON sd.student_id = s.student_id
      JOIN persons p ON s.person_id = p.person_id
      LEFT JOIN staff st ON sd.verified_by = st.staff_id
      LEFT JOIN persons staff_p ON st.person_id = staff_p.person_id
      WHERE sd.is_current = TRUE
    `;

      const params = [];

      // Filter by verification status
      if (verification_status && verification_status !== "all") {
        query += " AND sd.verification_status = ?";
        params.push(verification_status);
      }

      // Search by student name or ID
      if (student_search) {
        query +=
          " AND (p.first_name LIKE ? OR p.last_name LIKE ? OR s.student_id LIKE ?)";
        const searchParam = `%${student_search}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      query += " ORDER BY sd.upload_date DESC";

      console.log("Executing documents query:", query);
      console.log("With parameters:", params);

      const [documents] = await pool.execute(query, params);

      console.log(`Found ${documents.length} documents`);
      res.json(documents);
    } catch (error) {
      console.error("Documents fetch error:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  }
);

app.put(
  "/api/documents/:documentId/verify",
  [
    authenticateToken,
    authorize(["admin", "staff"]),
    body("verification_status").isIn([
      "verified",
      "rejected",
      "requires_update",
    ]),
    body("verification_notes").optional().trim().isLength({ max: 1000 }),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { documentId } = req.params;
      const { verification_status, verification_notes } = req.body;

      const [staffRows] = await pool.execute(
        "SELECT staff_id FROM staff WHERE account_id = ?",
        [req.user.accountId]
      );

      const staffId = staffRows[0]?.staff_id;

      await pool.execute(
        `
      UPDATE student_documents 
      SET verification_status = ?, verified_by = ?, verified_date = NOW(), verification_notes = ?
      WHERE document_id = ?
    `,
        [verification_status, staffId, verification_notes || null, documentId]
      );

      res.json({
        message: "Document verification status updated successfully",
      });
    } catch (error) {
      console.error("Document verification error:", error);
      res.status(500).json({ error: "Failed to update document verification" });
    }
  }
);

app.get(
  "/api/documents/student/:studentId",
  authenticateToken,
  authorize(["admin", "staff"]),
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [documents] = await pool.execute(
        `
      SELECT sd.document_id, sd.original_filename, sd.upload_date, sd.verification_status,
             sd.verified_date, sd.verification_notes, sd.is_current,
             dt.type_name as document_type, dt.is_required, dt.category,
             s.student_id, per.first_name, per.last_name,
             staff_per.first_name as verified_by_first_name, 
             staff_per.last_name as verified_by_last_name
      FROM student_documents sd
      JOIN document_types dt ON sd.document_type_id = dt.document_type_id
      JOIN students s ON sd.student_id = s.student_id
      JOIN persons per ON s.person_id = per.person_id
      LEFT JOIN staff st ON sd.verified_by = st.staff_id
      LEFT JOIN persons staff_per ON st.person_id = staff_per.person_id
      WHERE sd.student_id = ? AND sd.is_current = TRUE
      ORDER BY dt.is_required DESC, sd.upload_date DESC
    `,
        [studentId]
      );

      res.json(documents);
    } catch (error) {
      console.error("Student documents fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student documents" });
    }
  }
);

// Update the existing document upload route to automatically verify if admin uploads
app.post(
  "/api/documents/upload",
  [
    authenticateToken,
    authorize(["admin", "staff", "student"]),
    upload.single("document"),
  ],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { student_id, document_type_id } = req.body;

      // Check if user is admin
      const isAdmin = req.user.role === "admin";

      if (req.user.role === "student") {
        const [studentRows] = await pool.execute(
          "SELECT student_id FROM students WHERE student_id = ? AND account_id = ?",
          [student_id, req.user.accountId]
        );

        if (studentRows.length === 0) {
          fs.unlinkSync(req.file.path);
          return res
            .status(403)
            .json({ error: "Access denied to this student record" });
        }
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      const fileHash = crypto
        .createHash("sha256")
        .update(fileBuffer)
        .digest("hex");

      // Mark previous documents as not current
      await pool.execute(
        `
      UPDATE student_documents 
      SET is_current = FALSE 
      WHERE student_id = ? AND document_type_id = ?
    `,
        [student_id, document_type_id]
      );

      let uploadedBy = null;
      let verifiedBy = null;
      let verificationStatus = "pending";
      let verifiedDate = null;

      // Get staff ID if user is admin or staff
      if (req.user.role !== "student") {
        const [staffRows] = await pool.execute(
          "SELECT staff_id FROM staff WHERE account_id = ?",
          [req.user.accountId]
        );
        uploadedBy = staffRows[0]?.staff_id || null;

        // If admin, automatically verify the document
        if (isAdmin) {
          verifiedBy = uploadedBy;
          verificationStatus = "verified";
          verifiedDate = new Date();
        }
      }

      await pool.execute(
        `
      INSERT INTO student_documents (
        student_id, document_type_id, original_filename, stored_filename, 
        file_path, file_size_bytes, mime_type, file_hash, uploaded_by,
        verification_status, verified_by, verified_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
        [
          student_id,
          document_type_id,
          req.file.originalname,
          req.file.filename,
          req.file.path,
          req.file.size,
          req.file.mimetype,
          fileHash,
          uploadedBy,
          verificationStatus,
          verifiedBy,
          verifiedDate,
        ]
      );

      res.status(201).json({
        message: isAdmin
          ? "Document uploaded and automatically verified successfully"
          : "Document uploaded successfully",
        verification_status: verificationStatus,
      });
    } catch (error) {
      console.error("Document upload error:", error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: "Failed to upload document" });
    }
  }
);

app.get(
  "/api/students/:studentId/documents",
  authenticateToken,
  authorize(["admin", "staff", "student"]),
  authorizeStudentAccess,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const [documents] = await pool.execute(
        `
      SELECT sd.document_id, sd.original_filename, sd.upload_date, sd.verification_status,
             sd.verified_date, sd.verification_notes,
             dt.type_name as document_type, dt.is_required, dt.category
      FROM student_documents sd
      JOIN document_types dt ON sd.document_type_id = dt.document_type_id
      WHERE sd.student_id = ? AND sd.is_current = TRUE
      ORDER BY dt.is_required DESC, sd.upload_date DESC
    `,
        [studentId]
      );

      res.json(documents);
    } catch (error) {
      console.error("Student documents fetch error:", error);
      res.status(500).json({ error: "Failed to fetch student documents" });
    }
  }
);

// ============================================================================
// ERROR HANDLING & 404
// ============================================================================

app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File too large. Maximum size is 10MB." });
    }
    return res.status(400).json({ error: "File upload error" });
  }

  res.status(500).json({ error: "Internal server error" });
});

app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function testDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Database connection successful");
    connection.release();
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    return false;
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  await pool.end();
  process.exit(0);
});

async function startServer() {
  const dbConnected = await testDatabaseConnection();

  if (!dbConnected) {
    console.error("Cannot start server without database connection");
    process.exit(1);
  }

  // Initialize database with ID synchronization
  try {
    await initializeDatabase();
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(
      `📊 Database: ${
        process.env.DB_NAME_EDGE || process.env.DB_NAME || "8cons"
      }`
    );
    console.log(`🔒 Security: Authentication and authorization enabled`);
    console.log(`🆔 ID Sync: account_id and person_id synchronized`);
    console.log(`📁 File uploads: ${path.resolve("uploads")}`);
    console.log(`👤 Default admin: email=admin@gmail.com, password=admin123`);
    console.log("===============================================");
  });
}

startServer();

export default app;
