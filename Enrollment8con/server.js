import express from 'express';
import mysql from 'mysql2/promise';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'schema',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/documents';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Database initialization
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    
    // Create tables if they don't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id VARCHAR(50) UNIQUE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(100),
        contact_number VARCHAR(20),
        address TEXT,
        batch VARCHAR(50),
        competency_level ENUM('basic', 'common', 'core') DEFAULT 'basic',
        graduation_eligible BOOLEAN DEFAULT FALSE,
        enrollment_status ENUM('enrolled', 'graduated', 'dropped') DEFAULT 'enrolled',
        enrollment_date DATE,
        graduation_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT,
        payment_type VARCHAR(100),
        amount DECIMAL(10, 2),
        payment_date DATE,
        status ENUM('complete', 'incomplete', 'pending') DEFAULT 'pending',
        tuition_fee_details TEXT,
        additional_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT,
        document_name VARCHAR(255),
        file_path VARCHAR(500),
        file_type VARCHAR(50),
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        approved_by VARCHAR(100),
        approved_at TIMESTAMP NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS competency_assessments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT,
        competency_type ENUM('basic', 'common', 'core'),
        assessment_date DATE,
        score DECIMAL(5, 2),
        passed BOOLEAN DEFAULT FALSE,
        batch VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS scholarships (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sponsor_name VARCHAR(200),
        sponsor_type VARCHAR(100),
        contact_person VARCHAR(200),
        email VARCHAR(100),
        description TEXT,
        amount DECIMAL(10, 2),
        eligibility_criteria TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS referrals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        referrer_student_id INT,
        referred_student_name VARCHAR(200),
        referred_student_email VARCHAR(100),
        referred_student_phone VARCHAR(20),
        competency_level ENUM('basic', 'common', 'core'),
        status ENUM('pending', 'enrolled', 'rejected') DEFAULT 'pending',
        referral_date DATE,
        notes TEXT,
        FOREIGN KEY (referrer_student_id) REFERENCES students(id)
      )
    `);

    connection.release();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Dashboard Metrics
app.get('/api/dashboard/metrics', async (req, res) => {
  try {
    const [enrolledCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM students WHERE enrollment_status = "enrolled"'
    );
    
    const [graduatedCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM students WHERE enrollment_status = "graduated"'
    );
    
    const [pendingPayments] = await pool.execute(
      'SELECT COUNT(*) as count FROM payments WHERE status = "pending"'
    );
    
    const [totalRevenue] = await pool.execute(
      'SELECT SUM(amount) as total FROM payments WHERE status = "complete"'
    );

    const [monthlyEnrollments] = await pool.execute(`
      SELECT MONTH(enrollment_date) as month, COUNT(*) as count 
      FROM students 
      WHERE YEAR(enrollment_date) = YEAR(CURDATE())
      GROUP BY MONTH(enrollment_date)
      ORDER BY month
    `);

    const [competencyBreakdown] = await pool.execute(`
      SELECT competency_level, COUNT(*) as count 
      FROM students 
      GROUP BY competency_level
    `);

    res.json({
      enrolled_students: enrolledCount[0].count,
      graduated_students: graduatedCount[0].count,
      pending_payments: pendingPayments[0].count,
      total_revenue: totalRevenue[0].total || 0,
      monthly_enrollments: monthlyEnrollments,
      competency_breakdown: competencyBreakdown
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Student Routes
app.get('/api/students', async (req, res) => {
  try {
    const { name_sort, competency, batch } = req.query;
    
    let query = 'SELECT * FROM students WHERE 1=1';
    const params = [];

    if (competency) {
      query += ' AND competency_level = ?';
      params.push(competency);
    }

    if (batch) {
      query += ' AND batch = ?';
      params.push(batch);
    }

    if (name_sort) {
      query += ` ORDER BY first_name ${name_sort === 'ascending' ? 'ASC' : 'DESC'}`;
    }

    const [students] = await pool.execute(query, params);
    res.json(students);
  } catch (error) {
    console.error('Students fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const { first_name, last_name, email, contact_number, address, batch, competency_level } = req.body;
    
    const student_id = `STU${Date.now()}`;
    
    const [result] = await pool.execute(`
      INSERT INTO students (student_id, first_name, last_name, email, contact_number, address, batch, competency_level, enrollment_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())
    `, [student_id, first_name, last_name, email, contact_number, address, batch, competency_level]);

    res.status(201).json({ id: result.insertId, student_id, message: 'Student created successfully' });
  } catch (error) {
    console.error('Student creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/students/:id', async (req, res) => {
  try {
    const { first_name, last_name, email, contact_number, address, batch, competency_level } = req.body;
    
    await pool.execute(`
      UPDATE students 
      SET first_name = ?, last_name = ?, email = ?, contact_number = ?, address = ?, batch = ?, competency_level = ?
      WHERE id = ?
    `, [first_name, last_name, email, contact_number, address, batch, competency_level, req.params.id]);

    res.json({ message: 'Student updated successfully' });
  } catch (error) {
    console.error('Student update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Payment Routes
app.get('/api/payments', async (req, res) => {
  try {
    const { name_sort, status } = req.query;
    
    let query = `
      SELECT p.*, s.student_id, s.first_name, s.last_name
      FROM payments p
      JOIN students s ON p.student_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    if (name_sort) {
      query += ` ORDER BY s.first_name ${name_sort === 'ascending' ? 'ASC' : 'DESC'}`;
    }

    const [payments] = await pool.execute(query, params);
    res.json(payments);
  } catch (error) {
    console.error('Payments fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const { student_id, payment_type, amount, tuition_fee_details, additional_notes } = req.body;
    
    await pool.execute(`
      INSERT INTO payments (student_id, payment_type, amount, payment_date, tuition_fee_details, additional_notes)
      VALUES (?, ?, ?, CURDATE(), ?, ?)
    `, [student_id, payment_type, amount, tuition_fee_details, additional_notes]);

    res.status(201).json({ message: 'Payment recorded successfully' });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Document Routes
app.get('/api/documents', async (req, res) => {
  try {
    const query = `
      SELECT d.*, s.student_id, s.first_name, s.last_name
      FROM documents d
      JOIN students s ON d.student_id = s.id
      ORDER BY d.upload_date DESC
    `;
    
    const [documents] = await pool.execute(query);
    res.json(documents);
  } catch (error) {
    console.error('Documents fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/documents/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { student_id } = req.body;

    await pool.execute(`
      INSERT INTO documents (student_id, document_name, file_path, file_type)
      VALUES (?, ?, ?, ?)
    `, [student_id, req.file.originalname, req.file.path, req.file.mimetype]);

    res.status(201).json({ message: 'Document uploaded successfully' });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/documents/:id/status', async (req, res) => {
  try {
    const { status, approved_by } = req.body;
    const documentId = req.params.id;

    await pool.execute(`
      UPDATE documents 
      SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, approved_by || 'Admin', documentId]);

    res.json({ message: 'Document status updated successfully' });
  } catch (error) {
    console.error('Document status update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Competency Assessment Routes
app.get('/api/competency-assessments', async (req, res) => {
  try {
    const { name_sort, competency, batch } = req.query;
    
    let query = `
      SELECT ca.*, s.student_id, s.first_name, s.last_name
      FROM competency_assessments ca
      JOIN students s ON ca.student_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (competency) {
      query += ' AND ca.competency_type = ?';
      params.push(competency);
    }

    if (batch) {
      query += ' AND ca.batch = ?';
      params.push(batch);
    }

    if (name_sort) {
      query += ` ORDER BY s.first_name ${name_sort === 'ascending' ? 'ASC' : 'DESC'}`;
    }

    const [assessments] = await pool.execute(query, params);
    res.json(assessments);
  } catch (error) {
    console.error('Competency assessments fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/competency-assessments', async (req, res) => {
  try {
    const { student_id, competency_type, score, batch } = req.body;
    const passed = score >= 70; // Passing score is 70

    await pool.execute(`
      INSERT INTO competency_assessments (student_id, competency_type, assessment_date, score, passed, batch)
      VALUES (?, ?, CURDATE(), ?, ?, ?)
    `, [student_id, competency_type, score, passed, batch]);

    res.status(201).json({ message: 'Assessment recorded successfully' });
  } catch (error) {
    console.error('Assessment creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Graduation Eligibility Routes
app.get('/api/graduation-eligibility', async (req, res) => {
  try {
    const { name_sort, eligibility } = req.query;
    
    let query = 'SELECT * FROM students WHERE 1=1';
    const params = [];

    if (eligibility) {
      const eligible = eligibility === 'basic' || eligibility === 'common' || eligibility === 'core';
      query += ' AND graduation_eligible = ?';
      params.push(eligible);
    }

    if (name_sort) {
      query += ` ORDER BY first_name ${name_sort === 'ascending' ? 'ASC' : 'DESC'}`;
    }

    const [students] = await pool.execute(query, params);
    res.json(students);
  } catch (error) {
    console.error('Graduation eligibility fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Scholarship Routes
app.get('/api/scholarships', async (req, res) => {
  try {
    const [scholarships] = await pool.execute(
      'SELECT * FROM scholarships WHERE active = TRUE ORDER BY created_at DESC'
    );
    res.json(scholarships);
  } catch (error) {
    console.error('Scholarships fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/scholarships', async (req, res) => {
  try {
    const { sponsor_name, sponsor_type, contact_person, email, description, amount, eligibility_criteria } = req.body;
    
    await pool.execute(`
      INSERT INTO scholarships (sponsor_name, sponsor_type, contact_person, email, description, amount, eligibility_criteria)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [sponsor_name, sponsor_type, contact_person, email, description, amount, eligibility_criteria]);

    res.status(201).json({ message: 'Scholarship created successfully' });
  } catch (error) {
    console.error('Scholarship creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Referral Routes
app.get('/api/referrals', async (req, res) => {
  try {
    const { name_sort, competency } = req.query;
    
    let query = `
      SELECT r.*, s.student_id, s.first_name as referrer_first_name, s.last_name as referrer_last_name
      FROM referrals r
      JOIN students s ON r.referrer_student_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (competency) {
      query += ' AND r.competency_level = ?';
      params.push(competency);
    }

    if (name_sort) {
      query += ` ORDER BY s.first_name ${name_sort === 'ascending' ? 'ASC' : 'DESC'}`;
    }

    const [referrals] = await pool.execute(query, params);
    res.json(referrals);
  } catch (error) {
    console.error('Referrals fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/referrals', async (req, res) => {
  try {
    const { referrer_student_id, referred_student_name, referred_student_email, referred_student_phone, competency_level, notes } = req.body;
    
    await pool.execute(`
      INSERT INTO referrals (referrer_student_id, referred_student_name, referred_student_email, referred_student_phone, competency_level, referral_date, notes)
      VALUES (?, ?, ?, ?, ?, CURDATE(), ?)
    `, [referrer_student_id, referred_student_name, referred_student_email, referred_student_phone, competency_level, notes]);

    res.status(201).json({ message: 'Referral created successfully' });
  } catch (error) {
    console.error('Referral creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
  });
});

export default app;