-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 29, 2025 at 09:04 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `8cons`
--

DELIMITER $$
--
-- Procedures
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_enroll_student` (IN `p_student_id` VARCHAR(20), IN `p_offering_id` INT, IN `p_pricing_type` VARCHAR(20), OUT `p_result` VARCHAR(200))   BEGIN
  DECLARE v_offering_count INT;
  DECLARE v_existing_enrollment INT;
  DECLARE v_max_enrollees INT;
  DECLARE v_current_enrollees INT;
  DECLARE v_offering_status VARCHAR(20);
  DECLARE v_pricing_amount DECIMAL(10,2);
  DECLARE v_duration_weeks INT;
  DECLARE v_completion_date DATE;
  DECLARE v_start_date DATE;
  
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_result = 'ERROR: Enrollment failed due to database error';
  END;

  START TRANSACTION;

  -- Check if student exists
  SELECT COUNT(*) INTO v_offering_count FROM students WHERE student_id = p_student_id;
  IF v_offering_count = 0 THEN
    SET p_result = 'ERROR: Student not found';
    ROLLBACK;
  ELSE
    -- Check if offering exists and get details
    SELECT 
      max_enrollees, current_enrollees, status, start_date,
      (SELECT duration_weeks FROM courses WHERE course_id = co.course_id) as duration_weeks
    INTO v_max_enrollees, v_current_enrollees, v_offering_status, v_start_date, v_duration_weeks
    FROM course_offerings co
    WHERE offering_id = p_offering_id;
    
    IF v_max_enrollees IS NULL THEN
      SET p_result = 'ERROR: Course offering not found';
      ROLLBACK;
    ELSE
      -- Check if already enrolled
      SELECT COUNT(*) INTO v_existing_enrollment 
      FROM student_enrollments 
      WHERE student_id = p_student_id AND offering_id = p_offering_id;
      
      IF v_existing_enrollment > 0 THEN
        SET p_result = 'ERROR: Student already enrolled in this offering';
        ROLLBACK;
      ELSE
        -- Check capacity
        IF v_current_enrollees >= v_max_enrollees THEN
          SET p_result = 'ERROR: Course offering is full';
          ROLLBACK;
        ELSE
          -- Check offering status
          IF v_offering_status NOT IN ('planned', 'active') THEN
            SET p_result = 'ERROR: Course offering is not available for enrollment';
            ROLLBACK;
          ELSE
            -- Get pricing
            SELECT amount INTO v_pricing_amount
            FROM course_pricing
            WHERE offering_id = p_offering_id 
              AND pricing_type = p_pricing_type 
              AND is_active = TRUE
              AND (expiry_date IS NULL OR expiry_date > NOW())
            LIMIT 1;
            
            IF v_pricing_amount IS NULL THEN
              SET v_pricing_amount = 0;
            END IF;
            
            -- Calculate completion date
            SET v_completion_date = DATE_ADD(v_start_date, INTERVAL v_duration_weeks WEEK);
            
            -- Create enrollment
            INSERT INTO student_enrollments (
              student_id, offering_id, enrollment_date, enrollment_status,
              completion_date, completion_percentage
            ) VALUES (
              p_student_id, p_offering_id, NOW(), 'enrolled',
              v_completion_date, 0.00
            );
            
            -- Create student account if pricing > 0
            IF v_pricing_amount > 0 THEN
              INSERT INTO student_accounts (
                student_id, offering_id, total_due, amount_paid, balance,
                account_status, due_date
              ) VALUES (
                p_student_id, p_offering_id, v_pricing_amount, 0.00, v_pricing_amount,
                'active', DATE_ADD(NOW(), INTERVAL 30 DAY)
              );
            END IF;
            
            -- Update offering enrollment count
            UPDATE course_offerings 
            SET current_enrollees = current_enrollees + 1
            WHERE offering_id = p_offering_id;
            
            SET p_result = 'SUCCESS: Student enrolled successfully';
            COMMIT;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_get_dashboard_kpi_data` ()   BEGIN
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
      END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_register_user_complete` (IN `p_password_hash` VARCHAR(255), IN `p_first_name` VARCHAR(50), IN `p_middle_name` VARCHAR(50), IN `p_last_name` VARCHAR(50), IN `p_birth_date` DATE, IN `p_birth_place` VARCHAR(100), IN `p_gender` ENUM('Male','Female','Other'), IN `p_email` VARCHAR(100), IN `p_education` VARCHAR(100), IN `p_phone_no` VARCHAR(15), IN `p_address` TEXT, IN `p_role_name` VARCHAR(50), IN `p_trading_level` VARCHAR(50), IN `p_device_type` VARCHAR(100), IN `p_learning_style` VARCHAR(100), IN `p_delivery_preference` VARCHAR(50), OUT `p_account_id` INT, OUT `p_student_id` VARCHAR(20), OUT `p_result` VARCHAR(100))   BEGIN
  DECLARE v_role_id INT;
  DECLARE v_level_id INT;
  DECLARE v_six_digit_number VARCHAR(6);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_result = 'ERROR: Complete registration failed';
    SET p_account_id = NULL;
    SET p_student_id = NULL;
  END;
  START TRANSACTION;
  -- Create account first
  INSERT INTO accounts (password_hash, token, account_status)
  VALUES (p_password_hash, '', 'active');
  
  SET p_account_id = LAST_INSERT_ID();
  
  -- Generate 6-digit number (using timestamp modulo + account_id for uniqueness)
  SET v_six_digit_number = LPAD((UNIX_TIMESTAMP(NOW()) % 900000) + 100000 + p_account_id % 1000, 6, '0');
  
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
    
    -- If student role, create student record with complete details
    IF p_role_name = 'student' THEN
      SET p_student_id = CONCAT('8Con-', YEAR(NOW()), '-', v_six_digit_number);
      
      INSERT INTO students (student_id, person_id, account_id)
      VALUES (p_student_id, p_account_id, p_account_id);
      
      -- Add contact information
      IF p_phone_no IS NOT NULL THEN
        INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary)
        VALUES (p_account_id, p_student_id, 'phone', p_phone_no, 1);
      END IF;
      
      IF p_address IS NOT NULL THEN
        INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary)
        VALUES (p_account_id, p_student_id, 'address', p_address, 1);
      END IF;
      
      INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary)
      VALUES (p_account_id, p_student_id, 'email', p_email, 1);
      
      -- Set trading level based on parameter
      IF p_trading_level IS NOT NULL THEN
        SELECT level_id INTO v_level_id FROM trading_levels WHERE level_name = p_trading_level LIMIT 1;
        IF v_level_id IS NULL THEN
          SET v_level_id = 1; -- Default to Beginner
        END IF;
      ELSE
        SET v_level_id = 1; -- Default to Beginner
      END IF;
      
      INSERT INTO student_trading_levels (student_id, level_id, is_current)
      VALUES (p_student_id, v_level_id, 1);
      
      -- Set learning preferences with provided details
      INSERT INTO learning_preferences (
        student_id, 
        delivery_preference, 
        device_type, 
        learning_style
      ) VALUES (
        p_student_id, 
        COALESCE(p_delivery_preference, 'hybrid'),
        p_device_type,
        p_learning_style
      );
      
      -- Create student background record
      INSERT INTO student_backgrounds (student_id, education_level)
      VALUES (p_student_id, 'college');
      
    END IF;
    
    -- If staff role, create staff record
    IF p_role_name = 'staff' THEN
      INSERT INTO staff (person_id, account_id, employee_id, hire_date, employment_status)
      VALUES (p_account_id, p_account_id, CONCAT('Staff-', YEAR(NOW()), '-', v_six_digit_number), CURDATE(), 'active');
    END IF;
    
    SET p_result = 'SUCCESS: Complete user registration successful';
    COMMIT;
  END IF;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_register_user_with_synced_ids` (IN `p_password_hash` VARCHAR(255), IN `p_first_name` VARCHAR(50), IN `p_middle_name` VARCHAR(50), IN `p_last_name` VARCHAR(50), IN `p_birth_date` DATE, IN `p_birth_place` VARCHAR(100), IN `p_gender` ENUM('Male','Female','Other'), IN `p_email` VARCHAR(100), IN `p_education` VARCHAR(100), IN `p_phone_no` VARCHAR(15), IN `p_address` TEXT, IN `p_role_name` VARCHAR(50), OUT `p_account_id` INT, OUT `p_result` VARCHAR(100))   BEGIN
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
              SET v_student_id = CONCAT('8Con-', YEAR(NOW()), '-', v_six_digit_number);
              
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
              VALUES (p_account_id, p_account_id, CONCAT('Staff-', YEAR(NOW()), '-', v_six_digit_number), CURDATE(), 'active');
    		END IF;
            
            SET p_result = 'SUCCESS: User registered successfully';
            COMMIT;
          END IF;
        END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `UpdatePaymentStatus` (IN `p_payment_id` INT, IN `p_status` VARCHAR(20), IN `p_processed_by` INT, IN `p_notes` TEXT)   BEGIN
  DECLARE v_payment_amount DECIMAL(10,2);
  DECLARE v_account_id INT;
  DECLARE v_old_status VARCHAR(20);
  
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
  END;

  START TRANSACTION;

  -- Get current payment details
  SELECT payment_amount, account_id, payment_status
  INTO v_payment_amount, v_account_id, v_old_status
  FROM payments 
  WHERE payment_id = p_payment_id;
  
  -- Update payment status
  UPDATE payments 
  SET payment_status = p_status,
      processed_by = p_processed_by,
      notes = COALESCE(p_notes, notes),
      updated_at = NOW()
  WHERE payment_id = p_payment_id;
  
  -- If confirming payment, update student account
  IF p_status = 'confirmed' AND v_old_status != 'confirmed' THEN
    UPDATE student_accounts
    SET amount_paid = amount_paid + v_payment_amount,
        balance = total_due - (amount_paid + v_payment_amount),
        last_payment_date = CURDATE(),
        updated_at = NOW()
    WHERE account_id = v_account_id;
  END IF;
  
  -- If rejecting previously confirmed payment, reverse the amount
  IF p_status IN ('failed', 'cancelled') AND v_old_status = 'confirmed' THEN
    UPDATE student_accounts
    SET amount_paid = amount_paid - v_payment_amount,
        balance = total_due - (amount_paid - v_payment_amount),
        updated_at = NOW()
    WHERE account_id = v_account_id;
  END IF;
  
  -- Log the activity
  INSERT INTO payment_activity_logs (
    payment_id, action, old_status, new_status, 
    performed_by, notes, created_at
  ) VALUES (
    p_payment_id, 'status_update', v_old_status, p_status,
    p_processed_by, p_notes, NOW()
  );
  
  COMMIT;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `UpdatePaymentStatusWithAmount` (IN `p_payment_id` INT, IN `p_status` VARCHAR(20), IN `p_notes` TEXT, IN `p_amount` DECIMAL(10,2), OUT `p_result` VARCHAR(200))   BEGIN
  DECLARE v_old_amount DECIMAL(10,2);
  DECLARE v_account_id INT;
  DECLARE v_old_status VARCHAR(20);
  DECLARE v_amount_difference DECIMAL(10,2);
  
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_result = 'ERROR: Payment update failed due to database error';
  END;

  START TRANSACTION;

  -- Get current payment details
  SELECT payment_amount, account_id, payment_status
  INTO v_old_amount, v_account_id, v_old_status
  FROM payments 
  WHERE payment_id = p_payment_id;
  
  IF v_old_amount IS NULL THEN
    SET p_result = 'ERROR: Payment not found';
    ROLLBACK;
  ELSE
    -- Calculate amount difference if amount is being updated
    IF p_amount IS NOT NULL AND p_amount != v_old_amount THEN
      SET v_amount_difference = p_amount - v_old_amount;
      
      -- Update payment amount
      UPDATE payments 
      SET payment_amount = p_amount,
          payment_status = p_status,
          notes = COALESCE(p_notes, notes),
          updated_at = NOW()
      WHERE payment_id = p_payment_id;
      
      -- Update student account if payment is confirmed
      IF p_status = 'confirmed' THEN
        UPDATE student_accounts
        SET amount_paid = amount_paid + v_amount_difference,
            balance = total_due - (amount_paid + v_amount_difference),
            last_payment_date = CURDATE(),
            updated_at = NOW()
        WHERE account_id = v_account_id;
      END IF;
    ELSE
      -- Only update status and notes
      UPDATE payments 
      SET payment_status = p_status,
          notes = COALESCE(p_notes, notes),
          updated_at = NOW()
      WHERE payment_id = p_payment_id;
      
      -- Handle status change effects on student account
      IF p_status = 'confirmed' AND v_old_status != 'confirmed' THEN
        UPDATE student_accounts
        SET amount_paid = amount_paid + v_old_amount,
            balance = total_due - (amount_paid + v_old_amount),
            last_payment_date = CURDATE(),
            updated_at = NOW()
        WHERE account_id = v_account_id;
      ELSEIF p_status IN ('failed', 'cancelled') AND v_old_status = 'confirmed' THEN
        UPDATE student_accounts
        SET amount_paid = amount_paid - v_old_amount,
            balance = total_due - (amount_paid - v_old_amount),
            updated_at = NOW()
        WHERE account_id = v_account_id;
      END IF;
    END IF;
    
    -- Log the activity
    INSERT INTO payment_activity_logs (
      payment_id, action, old_status, new_status, 
      notes, created_at
    ) VALUES (
      p_payment_id, 'status_and_amount_update', v_old_status, p_status,
      CONCAT('Amount: ', COALESCE(p_amount, v_old_amount), '. ', COALESCE(p_notes, '')), NOW()
    );
    
    SET p_result = 'SUCCESS: Payment updated successfully';
    COMMIT;
  END IF;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `accounts`
--

CREATE TABLE `accounts` (
  `account_id` int(11) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `account_status` enum('active','inactive','suspended') DEFAULT 'active',
  `last_login` timestamp NULL DEFAULT NULL,
  `failed_login_attempts` int(11) DEFAULT 0,
  `locked_until` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `reset_token` varchar(64) DEFAULT NULL,
  `reset_token_expiry` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `accounts`
--

INSERT INTO `accounts` (`account_id`, `password_hash`, `token`, `account_status`, `last_login`, `failed_login_attempts`, `locked_until`, `created_at`, `updated_at`, `reset_token`, `reset_token_expiry`) VALUES
(10, '$2b$12$oQI.A8XG5pPZtDzyhTQ0J.DSEeNzs7g8qYuG9UP6/ryrb9GLJsf1u', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEwLCJ1c2VybmFtZSI6ImphbmVzbWl0aDIxIiwicm9sZSI6InN0YWZmIiwiaWF0IjoxNzQ5Nzg3MTgxLCJleHAiOjE3NDk4NzM1ODF9.TcZujI-oI3CSWBaTrDsnHEpXY6uBLZXmGoNtqBS_nl8', 'active', NULL, 0, NULL, '2025-06-13 03:59:40', '2025-06-13 03:59:41', NULL, NULL),
(13, '$2b$12$WKbua14t/EIfUOhWgG3vA.nEZfZCyC0RONabHe/0ecJFFqMKwbT7O', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEzLCJ1c2VybmFtZSI6ImpvaG5kb2UxMjMiLCJyb2xlIjoic3R1ZGVudCIsImlhdCI6MTc1MDEzMjQzOCwiZXhwIjoxNzUwMjE4ODM4fQ.VtQea8KITM11m9Mj78ndD7x7g-bP0RRtTSV0yYW2WAU', 'active', '2025-06-17 03:53:58', 0, NULL, '2025-06-13 04:50:42', '2025-06-17 03:53:58', NULL, NULL),
(16, '$2a$10$/F70GT9SOORjVQ.4AAAlVenOR6L/I0RA.Yb58wVYInT2dEShsZUp6', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjE2LCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwMjE2NzUwLCJleHAiOjE3NTAyNDU1NTB9.u3qxvNw84XBsEoEqnkXbm966kQ__Dj2KiU1ot7QWxA8', 'active', '2025-06-18 03:19:10', 1, NULL, '2025-06-17 10:09:13', '2025-06-22 03:58:15', NULL, NULL),
(39, 'dmin<$2a$10$2Au7F.6TM/C5EjosMG7v3egACwDJhEDrImQs/sMyFuq97CJ.1iGpK\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjM5LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTAyNDAxNzQsImV4cCI6MTc1MTUzNjE3NH0.EPaECrVKsrJ6f6d40dFZIbWqmekcCIf5yu4-NZCcMTg', 'active', NULL, 1, NULL, '2025-06-18 09:49:34', '2025-06-18 14:06:06', NULL, NULL),
(40, 'dmin<$2a$10$J9bCwQS275Aroa0McptniOQc0Yf2yRp/zULh2ddn.ngAXzRPCtnv2\0\'\',', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjQwLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTExNjkwOTQsImV4cCI6MTc1MTE5Nzg5NH0.3JaOCSFwsZMoxTgKWbB5JQ1bnGNCPHK30dn833MioKo', 'active', '2025-06-29 05:58:49', 0, NULL, '2025-06-18 09:52:24', '2025-06-29 05:58:49', NULL, NULL),
(41, 'dmin<$2a$10$NIZ4IjzmxVW/WSCf1UrFy.kJ3lxffgOIxATb8Jorn683t8YlE2BvG\0\'\',', '', 'active', '2025-06-18 09:56:48', 0, NULL, '2025-06-18 09:56:48', '2025-06-18 09:58:02', NULL, NULL),
(42, 'dmin<$2a$10$SByKB4anMwqN0OBUHEj31eJHwIce1gI4t/qxOK0agugTfQ9FqHxh.\0ers', '', 'active', '2025-06-18 09:58:03', 0, NULL, '2025-06-18 09:58:03', '2025-06-18 10:50:23', NULL, NULL),
(43, '$2a$12$tdom3.AwPWMPBSe82BnbX.ERE0eUYted7tWJAu40aoWH5rTZIcFje', '', 'active', NULL, 0, NULL, '2025-06-18 10:29:05', '2025-06-18 10:29:05', NULL, NULL),
(44, 'dmin<$2a$10$nIXa5gFcterlGdCcPSsdlun4C2UB/wgib/XkQ5W1Qc1ZnlxbVss7S\0\'\',', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjQ0LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTAyNDM4MjcsImV4cCI6MTc1MDI3MjYyN30.f6LGZF-eBAeGJ-yuYhbEwKVV3w3EfSPONY6JQRp8tHw', 'active', '2025-06-18 10:50:27', 0, NULL, '2025-06-18 10:50:27', '2025-06-18 10:50:27', NULL, NULL),
(45, 'dmin<$2a$10$idV/IeavE.ADuidz4a3mG.1J.UFcV7r0vsrTX/7SufHgwVa.94uHa\0\'\',', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjQ1LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTAyNTUxNDMsImV4cCI6MTc1MDI4Mzk0M30.ZVyhjf5CqHwWueikwyOmw1u1vHEAdK6F3KfQUk3vULs', 'active', NULL, 0, NULL, '2025-06-18 13:59:03', '2025-06-18 13:59:03', NULL, NULL),
(46, 'dmin<$2a$10$TTmTXBsJzhAWwEPt5oWfT.ev3T2OL11d61FG/nkA2P.F5zhgXlPki\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjQ2LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTAyNTUxNDUsImV4cCI6MTc1MDI4Mzk0NX0.wcmbwO9DdPG92A-L2pm_mjck1Bde-y9mFaTCfBGMMoE', 'active', NULL, 0, NULL, '2025-06-18 13:59:05', '2025-06-18 13:59:05', NULL, NULL),
(47, 'dmin<$2a$10$VQnPiYl4nAUKBy1pCgX0LeYmXLotmBMbkKDFecqHCVcYtL4ayazBC\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjQ3LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTAyNTUxNjAsImV4cCI6MTc1MDI4Mzk2MH0.N7Lrm0_kDaX5usk31ajzlbwIZTcihaGTD4f49SajzIA', 'active', NULL, 0, NULL, '2025-06-18 13:59:20', '2025-06-18 13:59:20', NULL, NULL),
(48, 'dmin<$2a$10$dMHlUUS6eGnvgeaDOufQce8kvvTeMSeTshQ1RqKpkntspw8L7u6ye\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjQ4LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTAyNTU0NTIsImV4cCI6MTc1MDI4NDI1Mn0.MMxp0zIEqJXXoCurZaYNVQgIDh0QqmQ82oHnQB8KbWI', 'active', NULL, 0, NULL, '2025-06-18 14:04:12', '2025-06-18 14:04:12', NULL, NULL),
(49, 'dmin<$2a$10$6Qh79kIBGvLLijNcNP0pjeNSM29TZdl.2IF3p7o0ewe4yBjd1dhDm\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjQ5LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTAyNTU2ODMsImV4cCI6MTc1MDI4NDQ4M30.GnrDConenEX0V_0cWulB5SpZ4BQn_7ugUs0bdiJf5A4', 'active', NULL, 0, NULL, '2025-06-18 14:08:03', '2025-06-18 14:08:03', NULL, NULL),
(50, 'dmin<$2a$10$ahsY19btoYPHocwK/H3DoOSQ7u46xBlYa40jRBlf765vlZwwUIYaa\0\'\',', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjUwLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTAyNTU2OTksImV4cCI6MTc1MDI4NDQ5OX0.ap8Jg394bS6GlavklgMYaYm6BJSHiJlALW4ziW9XeTo', 'active', '2025-06-18 14:08:19', 0, NULL, '2025-06-18 14:08:19', '2025-06-18 14:08:19', NULL, NULL),
(51, 'dmin<$2a$10$Gxu1nKsqOdg65dMsrSMPyuAXjiFmvAcNPbjBpV/exIncnduwiqWVq\0\'\',', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjUxLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTAzMDEyMjAsImV4cCI6MTc1MDMzMDAyMH0.Z3W1_GiHcEU_BkwifNcBjAoeHVUWDNY_h99AHgxfF6E', 'active', '2025-06-19 02:47:00', 0, NULL, '2025-06-19 02:47:00', '2025-06-19 02:47:00', NULL, NULL),
(52, '$2a$12$OtUJuJ8t6Q3tjX72qcYi3eJVjJRlfC1pdNJaa2/voKvItFRYbqMey', '', 'active', NULL, 0, NULL, '2025-06-19 03:17:25', '2025-06-19 03:17:25', NULL, NULL),
(53, '$2a$12$UyxBl24ssULjxcI0HUr5q.7OzbCLLEXWFWQvnM9rWQX2TvICmYwk2', '', 'active', NULL, 0, NULL, '2025-06-19 07:45:41', '2025-06-19 07:45:41', NULL, NULL),
(54, '$2a$12$nvgEXiB2dIvWWXVBTYA8se/zpGcm4Fp9ek2gzIkpkHI8NUl0rH/0S', '', 'active', NULL, 0, NULL, '2025-06-19 10:11:52', '2025-06-19 10:11:52', NULL, NULL),
(58, 'dmin<$2a$10$RshJWnCmmEjKIlgGK/StOeKkBFzTvr8eCI1Gujlg1i0T0UolFCYJm\0\'\',', '', 'active', '2025-06-19 11:25:33', 0, NULL, '2025-06-19 11:25:33', '2025-06-19 11:33:58', NULL, NULL),
(59, 'dmin<$2a$10$0sicBwCDgFtRZYh95o/9Pev/.1BhyngjC53j5ilKmO2T93PAaY84O\0\'\',', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjU5LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTAzMzI4MzksImV4cCI6MTc1MDM2MTYzOX0.0tFvkuz7YVq1KbPPAcqce4gSjIcew8b2PiqrmWoD4YA', 'active', '2025-06-19 11:33:59', 0, NULL, '2025-06-19 11:33:59', '2025-06-19 11:33:59', NULL, NULL),
(62, 'dmin<$2a$10$O8mug9aKZJ3waggAq7TvG.CE5.puu4s/663YU5b4sSbGdVgeahBpK\0\'\',', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjYyLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTA0Nzc5MjksImV4cCI6MTc1MDUwNjcyOX0.2W8GcA8uVrMqf8FBID9Xc8PeEI-lFaiwLbcACKnM9CI', 'active', '2025-06-21 03:52:10', 0, NULL, '2025-06-21 03:52:09', '2025-06-21 03:52:10', NULL, NULL),
(64, 'dmin<$2a$10$Gyn7LDvDYQjhnznMCOS9Oefhk5P.ixK.zezjhZvfD9MZYrFrXcZmm\0\'\',', '', 'active', '2025-06-21 08:28:25', 0, NULL, '2025-06-21 08:28:25', '2025-06-21 08:39:32', NULL, NULL),
(69, 'dmin<$2a$10$CCwaq5AwG2cT180Aww2sLebKwiFUcJ/JKHCOLPKJR4Hl.s08lGSNO\0\'\',', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjY5LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTA0OTUxNzQsImV4cCI6MTc1MDUyMzk3NH0.AQKUhIj21k3BtnYyUNlmo2nfuCOng3rMkdwgIqYOH2E', 'active', '2025-06-21 08:39:34', 0, NULL, '2025-06-21 08:39:34', '2025-06-21 08:39:34', NULL, NULL),
(88, '$2a$10$28LwhcNOFfZEwSY5WmpRFeevxhrKYTs3DfntLbuVR8puvjPyrsPzy', '', 'active', NULL, 0, NULL, '2025-06-21 09:10:42', '2025-06-21 09:10:42', NULL, NULL),
(89, 'dmin<$2a$10$L/ATbjjvaOK/P2XWmxaS2e.zFEUiTUlKw/0qqB6pS/a2/MLvAgs2q\0\'\',', '', 'active', '2025-06-22 03:25:38', 0, NULL, '2025-06-22 03:25:38', '2025-06-22 03:52:13', NULL, NULL),
(90, 'dmin<$2a$10$qHavUF7ik1QYwUeOIUNiF.vcnzy8kX597IiNtyaQYe8LQV3wQbnda\0\'\',', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjkwLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTA1NjQ3MDksImV4cCI6MTc1MDU5MzUwOX0.0WbWab6j-gNPcU3JqmMBGtucZPs1-vZt8hLaD_eH5ko', 'active', '2025-06-22 03:58:29', 0, NULL, '2025-06-22 03:58:29', '2025-06-22 03:58:29', NULL, NULL),
(91, 'dmin<$2a$10$qQgDu1DXUyLAWEsN4FbqrO7iFeog0MKNiX1HTAPSYG5DFdRFyUZGO\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjkxLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTA1NjQ3MTIsImV4cCI6MTc1MDU5MzUxMn0.NJwTy5f6g4rMcXFPuALk-sAEUvD-0oJc7-uQjzae_gI', 'active', '2025-06-22 03:58:32', 0, NULL, '2025-06-22 03:58:32', '2025-06-22 03:58:32', NULL, NULL),
(92, 'dmin<$2a$10$3/Wfl7jk.gdTjpEh0M7kDunKbXscaCOlPstaMsrUHO6EbXtOBfkhC\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjkyLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTA1NjQ3MTMsImV4cCI6MTc1MDU5MzUxM30.NoypQtZy3MlkeFulfRSVOm9R4lSfDjG0SNBMvT9UwOU', 'active', '2025-06-22 03:58:33', 0, NULL, '2025-06-22 03:58:33', '2025-06-22 03:58:33', NULL, NULL),
(93, 'dmin<$2a$10$mLenbRyV485XZHTswsPCO.op8P9QCyzBDUkTWv27Rgy2u6BBZF.iK\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjkzLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTA1NjQ3MTMsImV4cCI6MTc1MDU5MzUxM30.y2OtVQX5NrExRiOIA5hR-GYOUIydGPsLNtE83DaDOAc', 'active', '2025-06-22 03:58:33', 0, NULL, '2025-06-22 03:58:33', '2025-06-22 03:58:33', NULL, NULL),
(94, 'dmin<$2a$10$H9zGWW9EFpUIK0K3Z91poOsGray7y6U7iN4ZcezOWAOZV/vNzGemW\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjk0LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTA1NjQ3MTMsImV4cCI6MTc1MDU5MzUxM30.G1OIisE4vK_zR8wgnOBJbP1R2LAfRN_gTJf12gsN-Kg', 'active', '2025-06-22 03:58:33', 0, NULL, '2025-06-22 03:58:33', '2025-06-22 03:58:33', NULL, NULL),
(95, 'dmin<$2a$10$8TsQHRePIw9zuxzZR5fxWORMn4HvXwUDfUkbk9pwVChzCA9eXwMWa\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjk1LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTA1NjQ3MTQsImV4cCI6MTc1MDU5MzUxNH0.zYh94pxJZtmMRUT07r7URQi4kCRBT_JCXmA306Fri0Y', 'active', '2025-06-22 03:58:34', 0, NULL, '2025-06-22 03:58:34', '2025-06-22 03:58:34', NULL, NULL),
(96, 'dmin<$2a$10$V7wL1r.C3H6LVzQTHBhW6e7bR8RPnKrHjyyGajFlyyh.OGJ1bGTr6\0\'\',', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjk2LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTA1NjQ3MjMsImV4cCI6MTc1MDU5MzUyM30.SbMS-LBurcgwmr5pYHSzq9M0eNZmgcDrI4TIfNUyhUM', 'active', '2025-06-22 03:58:43', 0, NULL, '2025-06-22 03:58:43', '2025-06-22 03:58:43', NULL, NULL),
(97, 'dmin<$2a$10$gHgo3eCQ69jiXDuYENLO4OOFu9jlVHDhBZ85..fv5yE5CQoUX5QZq\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjk3LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTA1NjQ3MzAsImV4cCI6MTc1MDU5MzUzMH0.0rTv3z4V0BvqNyDosEKODOvJ7sWUURHeXHUAeLoTBJM', 'active', '2025-06-22 03:58:50', 0, NULL, '2025-06-22 03:58:50', '2025-06-22 03:58:50', NULL, NULL),
(98, 'dmin<$2a$10$y3E8ODOQPD/6mJDBue/S7uxAp7Lt4ZhPePYyd0/Pek8rDpemmei2K\0ers', '', 'active', '2025-06-22 03:58:52', 0, NULL, '2025-06-22 03:58:52', '2025-06-22 04:00:29', NULL, NULL),
(99, 'dmin<$2a$10$Yq1Zk3qvLpNn8G4BjoXare3M64jD3MfV6kulLuR8.SZxQ4Vf91MOi\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjk5LCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTA1NjQ5MzUsImV4cCI6MTc1MDU5MzczNX0.44clTvdZYLSXITA7EGs8mCs9YYU5rMDr6Bbq9jlw5xY', 'active', '2025-06-22 04:02:15', 0, NULL, '2025-06-22 04:02:15', '2025-06-22 04:02:15', NULL, NULL),
(100, 'dmin<$2a$10$96fk8MbqrPJUc6QVIJvSaO1hdtiTiX90XC2/2pu9/7TrP1BfA74E6\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEwMCwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY0OTM4LCJleHAiOjE3NTA1OTM3Mzh9.cBrAm2DF4Qfjqc9fpq1kUmRSwIOzfQf9i5TZ1axZO-8', 'active', '2025-06-22 04:02:18', 0, NULL, '2025-06-22 04:02:18', '2025-06-22 04:02:18', NULL, NULL),
(101, 'dmin<$2a$10$chukkENO18ise9CSZEAW/.PN5Za7IAvUCTuzOJZn5kjLfNKniolZS\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEwMSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY0OTY2LCJleHAiOjE3NTA1OTM3NjZ9.ucUjDeBDwEni6LyTkc2eCJ73jw0QmSGd1m_ASUpae4w', 'active', '2025-06-22 04:02:46', 0, NULL, '2025-06-22 04:02:46', '2025-06-22 04:02:46', NULL, NULL),
(102, 'dmin<$2a$10$YF48swvh3PoKfZywge498upa.j/.q9vnSj2aKnLEUVeInkQ3JfQrK\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEwMiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY0OTY2LCJleHAiOjE3NTA1OTM3NjZ9.iTqYGgzDp5Zy1GuekiApRPHrYwMy0IB86c4FvtSTr5s', 'active', '2025-06-22 04:02:46', 0, NULL, '2025-06-22 04:02:46', '2025-06-22 04:02:46', NULL, NULL),
(103, 'dmin<$2a$10$rTjDaE2YWLo.0jvMm6k9jeRkFLCn0FnV4.kS0R5YNswQh0A3bS8wm\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEwMywicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY0OTY3LCJleHAiOjE3NTA1OTM3Njd9.1vye0hj9KR4b49ixECtE_-SaGKcKKk-Puy98FyWAymc', 'active', '2025-06-22 04:02:47', 0, NULL, '2025-06-22 04:02:47', '2025-06-22 04:02:47', NULL, NULL),
(104, 'dmin<$2a$10$389hGud3s0JCT25.efpJwuk6IixgD0gz/oh.ilRZXwHhFl5fC/FOe\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEwNCwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY0OTc0LCJleHAiOjE3NTA1OTM3NzR9.Xly_5_KYbO3va6IY1wZF7pxsZVb9PAhvNMgkEjChA8w', 'active', '2025-06-22 04:02:54', 0, NULL, '2025-06-22 04:02:54', '2025-06-22 04:02:54', NULL, NULL),
(105, 'dmin<$2a$10$8F.Yl./2.Dw9Y.2qGP9GOemEpuUH.267W.UgmkAewQJu6AkGQDKsy\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEwNSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY0OTg1LCJleHAiOjE3NTA1OTM3ODV9.fGRjnXab2GvhkVJo4ezPtkh1AJq8gtAh0LoLyQdfB0M', 'active', '2025-06-22 04:03:05', 0, NULL, '2025-06-22 04:03:05', '2025-06-22 04:03:05', NULL, NULL),
(106, 'dmin<$2a$10$gXHnsnko8Ulqxvajf8FpYOglQtjMj0JHEobEmFFsaJ1iPYjzZuePO\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEwNiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY0OTg2LCJleHAiOjE3NTA1OTM3ODZ9.lyEXalvtEvWAJzlVfOC37VK0oy-jCcCwBZVj1lD8sc8', 'active', '2025-06-22 04:03:06', 0, NULL, '2025-06-22 04:03:06', '2025-06-22 04:03:06', NULL, NULL),
(107, 'dmin<$2a$10$o89UY50PbvdbgWiQvkmvKe92FetRRMad5PGmREPlPOPiEclq1tRnS\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEwNywicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY0OTg3LCJleHAiOjE3NTA1OTM3ODd9.cIahpsqH6lk4esX89DS3xIwErevRrLNqrYh33IEr1as', 'active', '2025-06-22 04:03:07', 0, NULL, '2025-06-22 04:03:07', '2025-06-22 04:03:07', NULL, NULL),
(108, 'dmin<$2a$10$n.El4S2Hs9SmXfu3GrC.3OR1XrQv2Rx1YvUdTjezwbywuo6DK9G6q\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEwOCwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY1MDEwLCJleHAiOjE3NTA1OTM4MTB9.e9kv4bZtRKsw_fwWmS7c-V3pY9oBbDTutU9RZOuc8l0', 'active', '2025-06-22 04:03:30', 0, NULL, '2025-06-22 04:03:30', '2025-06-22 04:03:30', NULL, NULL),
(109, 'dmin<$2a$10$MuJm8nLmn72PMpeDM1WgaOnxUUrn0XX4XPR0MHsT3jWUWHEotnDVi\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEwOSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY1MDgyLCJleHAiOjE3NTA1OTM4ODJ9.cuA6hVH-Qti8-nWoCi13cVGbSubrHfyZtUlp25M0htc', 'active', '2025-06-22 04:04:42', 0, NULL, '2025-06-22 04:04:42', '2025-06-22 04:04:42', NULL, NULL),
(110, 'dmin<$2a$10$IbU12L4CD1ie6SBr5yBqvObrnFmzgqDtrOvknwT3OUFsVu2jQ9I7K\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjExMCwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY1MzY2LCJleHAiOjE3NTA1OTQxNjZ9.f8FV0HOZceJqo-eE2A2NkAhfUNA1YX9AWy2jgoB4roY', 'active', '2025-06-22 04:09:26', 0, NULL, '2025-06-22 04:09:26', '2025-06-22 04:09:26', NULL, NULL),
(111, 'dmin<$2a$10$cK7OCmQX0UJC07zRkKWhaOT5xqppwuhopW0kD5QsYlt8MZKYTV26W\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjExMSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY1Mzc0LCJleHAiOjE3NTA1OTQxNzR9.j5CufoEuT9YVPXrE3x1XNoZAVojCrH6mwu04A-kOkvg', 'active', '2025-06-22 04:09:35', 0, NULL, '2025-06-22 04:09:34', '2025-06-22 04:09:35', NULL, NULL),
(112, 'dmin<$2a$10$8yf1rj7XW1EMKeO9vFGpJOIA/kjwXb7O0v14ui.69f6WAvNZTYQ7.\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjExMiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY1MzgxLCJleHAiOjE3NTA1OTQxODF9.JdbCYvl6ASfG1BfP9riW2wyrFs4HrqvkyBqZQ2lreok', 'active', '2025-06-22 04:09:41', 0, NULL, '2025-06-22 04:09:41', '2025-06-22 04:09:41', NULL, NULL),
(113, 'dmin<$2a$10$x6CljPVha6FRjKmKp3STVeUmoZU/riCMh8i79XM.QNNLCAMM9yDvi\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjExMywicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY1NDE3LCJleHAiOjE3NTA1OTQyMTd9.HD4QA8tOZS3GX2NY6aFQjZR63aPf8WKLf1XY9HKtZEY', 'active', '2025-06-22 04:10:17', 0, NULL, '2025-06-22 04:10:17', '2025-06-22 04:10:17', NULL, NULL),
(114, 'dmin<$2a$10$4N1ktsgN2vyMANERt6au8esehwfTcC3kqazlac87EksvM7Ygms/Wa\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjExNCwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY1NDE3LCJleHAiOjE3NTA1OTQyMTd9.M2GP6LKM92vv-jxrbgyKk-7e7H5KXrWBVaVMSLWeCzU', 'active', '2025-06-22 04:10:17', 0, NULL, '2025-06-22 04:10:17', '2025-06-22 04:10:17', NULL, NULL),
(115, 'dmin<$2a$10$8i0PastNdXAgVx.r835l/.A/p.8Tcu5COVSSDAU3O1pflQCTNnWqy\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjExNSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY1NDE4LCJleHAiOjE3NTA1OTQyMTh9.UKdni0yHkvLSyq5OuD-_hbABTBih8hXHNbQeDXsanfM', 'active', '2025-06-22 04:10:18', 0, NULL, '2025-06-22 04:10:18', '2025-06-22 04:10:18', NULL, NULL),
(116, 'dmin<$2a$10$uJfpcAsW6lLrCvQYhTH/zOng.Zf3tOWF7qxK2TrJoleBPedtI8DlC\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjExNiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY1NDE4LCJleHAiOjE3NTA1OTQyMTh9.4L-4QwoESbf0FfWErSJiMDZw-mJAybkeSdcek9OA3Uc', 'active', '2025-06-22 04:10:18', 0, NULL, '2025-06-22 04:10:18', '2025-06-22 04:10:18', NULL, NULL),
(117, 'dmin<$2a$10$O6hT8NForS0Op9K4wPfqXeIeqWq1XY8BoFnfstBeay5q95nvR4wGG\0ers', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjExNywicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwNTY1NDE4LCJleHAiOjE3NTA1OTQyMTh9.hSM9_84Q_1X0JbdfrIeRREvwu5svV9rXhY-PmEYZ9eE', 'active', '2025-06-22 04:10:18', 0, NULL, '2025-06-22 04:10:18', '2025-06-22 04:10:18', NULL, NULL),
(141, '$2a$10$XER1Q/kV8Q47OiKImW4z4uv3NhPififneY3o6K70ktmA4TOhF4DSO', '', 'active', NULL, 0, NULL, '2025-06-23 05:59:05', '2025-06-23 05:59:05', NULL, NULL),
(143, '$2a$10$Fy3w7U1N7UbSw.I8MjY7HOwXy.q07E1wnVyJcdYVg52OhE6X0FFTe', '', 'active', NULL, 0, NULL, '2025-06-23 08:46:49', '2025-06-23 08:46:49', NULL, NULL),
(150, '$2a$12$sampleHash1234567890abcdef', '', 'active', NULL, 0, NULL, '2025-06-23 08:56:27', '2025-06-23 08:56:27', NULL, NULL),
(151, '$2a$12$sampleHash1234567890abcdef', '', 'active', NULL, 0, NULL, '2025-06-23 08:56:27', '2025-06-23 08:56:27', NULL, NULL),
(152, '$2a$12$sampleHash1234567890abcdef', '', 'active', NULL, 0, NULL, '2025-06-23 08:56:27', '2025-06-23 08:56:27', NULL, NULL),
(153, '$2a$12$sampleHash1234567890abcdef', '', 'active', NULL, 0, NULL, '2025-06-23 08:56:27', '2025-06-23 08:56:27', NULL, NULL),
(154, '$2a$12$sampleHash1234567890abcdef', '', 'active', NULL, 0, NULL, '2025-06-23 08:56:27', '2025-06-23 08:56:27', NULL, NULL),
(155, '$2a$12$sampleHash1234567890abcdef', '', 'active', NULL, 0, NULL, '2025-06-23 08:56:27', '2025-06-23 08:56:27', NULL, NULL),
(156, '$2a$12$sampleHash1234567890abcdef', '', 'active', NULL, 0, NULL, '2025-06-23 08:56:27', '2025-06-23 08:56:27', NULL, NULL),
(157, '$2a$12$sampleHash1234567890abcdef', '', 'active', NULL, 0, NULL, '2025-06-23 08:56:27', '2025-06-23 08:56:27', NULL, NULL),
(158, '$2a$12$sampleHash1234567890abcdef', '', 'active', NULL, 0, NULL, '2025-06-23 08:56:27', '2025-06-23 08:56:27', NULL, NULL),
(159, '$2a$12$sampleHash1234567890abcdef', '', 'active', NULL, 0, NULL, '2025-06-23 08:56:27', '2025-06-23 08:56:27', NULL, NULL),
(160, '$2a$10$RUFrByDqAORC1/WC4yH5PufaG4c7F31o71f1Lo4wyOacNOtKlItCG', '', 'active', NULL, 0, NULL, '2025-06-23 09:34:01', '2025-06-23 09:34:01', NULL, NULL),
(161, '$2a$10$d7XbbJkqTnrIEw0YVtzd8eE4Zo.RcYTdrG24Ax0XzOSpaLtnPUCqe', '', 'active', NULL, 0, NULL, '2025-06-23 10:12:53', '2025-06-23 10:12:53', NULL, NULL),
(162, '$2a$10$VyZ671ZKYaB5o6pySmoYUeEtSFxFJ11HZgRQoZCJpQ0er63HKb.62', '', 'active', NULL, 0, NULL, '2025-06-23 10:24:35', '2025-06-23 10:24:35', NULL, NULL),
(163, '$2a$10$a667OBtYkFIHRJrzL00PXeETDGfKZ9t9JfLGQSdogtQdTEO.m4T7.', '', 'active', NULL, 0, NULL, '2025-06-23 10:25:52', '2025-06-23 10:25:52', NULL, NULL),
(164, '$2a$10$EQJzCMMhqs2Avhq6z93JRerbbjRo.V0PqCEQljvXml6rK5IS.dm5G', '', 'active', NULL, 0, NULL, '2025-06-23 10:27:54', '2025-06-23 10:27:54', NULL, NULL),
(165, '$2a$10$rn638JujOn3V0X76BD7nReyJzfgZKjdzj9OglwnBMxqE5HBGB3A42', '', 'active', NULL, 0, NULL, '2025-06-23 10:35:13', '2025-06-23 10:35:13', NULL, NULL),
(166, '$2a$10$LSiXJu53ZiUF2tzwF5IZV.fzlIgme8Tnohxgpzw0jYUapcH6iBnxW', '', 'active', NULL, 0, NULL, '2025-06-24 08:40:15', '2025-06-24 08:40:15', NULL, NULL),
(168, '$2a$10$xa2QkEfXHaCswMZ9Da.jiewnKHIK3i0b384HF4f.dKIJ.eaZ/8JbO', '', 'active', NULL, 0, NULL, '2025-06-25 04:42:04', '2025-06-25 04:42:04', NULL, NULL),
(169, '$2a$10$PONTBUcHxdt/8aMJQrNS3OqiE63868m.7Rlsskg5Ibt8WOx44AbJ.', '', 'active', NULL, 0, NULL, '2025-06-25 04:58:18', '2025-06-25 04:58:18', NULL, NULL),
(170, '$2a$10$PJYB6Qq8RKLaPGsw4PcQzeoZ3GzXadI64M8lqzVpakX5kMI..T3fi', '', 'active', NULL, 0, NULL, '2025-06-25 08:26:12', '2025-06-25 08:26:12', NULL, NULL),
(171, '$2a$10$KT/rlBbvNv.4ZbtGx9lm2u8zOaML4PLHq5TGq2cfsJmZpv33gjRce', '', 'active', NULL, 0, NULL, '2025-06-25 09:06:02', '2025-06-25 09:06:02', NULL, NULL),
(172, '$2a$10$7RkaMT7d9HlYU9GN.nWO3uJ.aLedONeVzk0mREWnL9ISwlAYVwUN.', '', 'active', NULL, 0, NULL, '2025-06-25 09:24:14', '2025-06-25 09:24:14', NULL, NULL),
(173, '$2a$10$DbPXQv6XQg3D76RKsXAHN.tobukypdOA2m03v.Ub..3YFGJD37eDe', '', 'active', NULL, 0, NULL, '2025-06-25 09:34:47', '2025-06-25 09:34:47', NULL, NULL),
(174, '$2a$10$A9asOwQlsbeaaXWIYg0aiu9iCA5S/weq6nOBezF35S5HOXGP1RTQy', '', 'active', NULL, 0, NULL, '2025-06-25 13:51:36', '2025-06-25 13:51:36', NULL, NULL),
(175, '$2a$10$d/QeJcRLXfrrKVxa9qWwI.lS1kydvkAZLoqBhiM3g2lqTf8H7PZCO', '', 'active', NULL, 0, NULL, '2025-06-27 04:37:36', '2025-06-27 04:37:36', NULL, NULL),
(176, '$2a$10$qsjtjLfHfZZA1SexrWS9B.U3oA.byyBuZQQ3FX3pKmvcOqZTBA5O.', '', 'active', NULL, 0, NULL, '2025-06-27 04:38:50', '2025-06-27 04:38:50', NULL, NULL),
(177, '$2a$10$8uUKSO7ctvEY/C4YzSisse2hdcyF468IMzwcUJXOXYkbfKfezVVg2', '', 'active', NULL, 0, NULL, '2025-06-27 04:39:38', '2025-06-27 04:39:38', NULL, NULL),
(178, '$2a$10$oNpBRDsls33d5QcK82DKguFQk8wMGjoJTK4BXJt15kCokbgvAuoYS', '', 'active', NULL, 0, NULL, '2025-06-27 04:41:23', '2025-06-27 04:41:23', NULL, NULL),
(179, '$2a$10$YitPHUC5eSuVv2RyJfnZn.yeLVgGlESC..e8Q/jc6e7o6F1xGndmS', '', 'active', NULL, 0, NULL, '2025-06-27 04:42:47', '2025-06-27 04:42:47', NULL, NULL),
(180, '$2a$10$EaPIbbBVefsRhh8f5i0BW..EI7BqY6SBPEeCvX7CRWVqXPnSEnDwC', '', 'active', NULL, 0, NULL, '2025-06-27 04:43:54', '2025-06-27 04:43:54', NULL, NULL),
(181, '$2a$10$GQQdgHsh4TjsHab4qnzQrenHv5jEV86LS9Y/2R/AwzGzRXdD47WWu', '', 'active', NULL, 0, NULL, '2025-06-27 04:44:51', '2025-06-27 04:44:51', NULL, NULL),
(182, '$2a$10$E8ixN.hhman.x4wg5qz5HO.h0i6piWfhwkrHDwF6xTbQPnUIqIdZu', '', 'active', NULL, 0, NULL, '2025-06-27 04:46:11', '2025-06-27 04:46:11', NULL, NULL),
(183, '$2a$10$TMNM6eojsaIjuaiZ0T6JdeLDmFrdaR3S.PprPL/4dhhRpj2FjrE7W', '', 'active', NULL, 0, NULL, '2025-06-27 04:48:01', '2025-06-27 04:48:01', NULL, NULL),
(184, '$2a$10$Er4mCvf64eC18QlctcLks.e8ZdjtiJsfkoBLiGw/UzXKnp42nYYpi', '', 'active', NULL, 0, NULL, '2025-06-27 04:49:10', '2025-06-27 04:49:10', NULL, NULL),
(185, '$2a$10$uGUtYowhYN766DNcqPa7D.oQ3NLjzRsckFMg1bSjGZwkfKtMfxn0.', '', 'active', NULL, 0, NULL, '2025-06-27 04:50:15', '2025-06-27 04:50:15', NULL, NULL),
(186, '$2a$10$0RupRsxhJLBbROKw3mEYFO3/bi5ylmKoO3Gw52hwgIfh/58Lr5so.', '', 'active', NULL, 0, NULL, '2025-06-27 04:51:35', '2025-06-27 04:51:35', NULL, NULL),
(187, '$2a$10$mDLhvE0aUm7gLOVGL9yqJeklDFfnxogfffZsdKlY0cSn8G.suk.5G', '', 'active', NULL, 0, NULL, '2025-06-27 04:52:57', '2025-06-27 04:52:57', NULL, NULL),
(188, '$2a$10$thhBG9.SgEBkyE8YLkadxuia2BJSViIyMAvSzF0m3sHlTlxD7kXVu', '', 'active', NULL, 0, NULL, '2025-06-27 04:53:49', '2025-06-27 04:53:49', NULL, NULL),
(189, '$2a$10$N8Ekcljwq1cxqDx7IqzzVOHGu1UP5o98uWwyX.CVZwntJZjTwYV3C', '', 'active', NULL, 0, NULL, '2025-06-27 04:54:59', '2025-06-27 04:54:59', NULL, NULL),
(190, '$2a$10$t.5Eu52NaYqEuv7/HKNl.eEObGW1SIvC/ueBfVCWoWzrZxbM7MYyK', '', 'active', NULL, 0, NULL, '2025-06-27 04:56:05', '2025-06-27 04:56:05', NULL, NULL),
(191, '$2a$10$rpNcvRiOOJa6aqQw5Q5gbu.kAEWDTUgp0.p51PWwp7/EWOm.VqdYa', '', 'active', NULL, 0, NULL, '2025-06-27 04:57:19', '2025-06-27 04:57:19', NULL, NULL),
(192, '$2a$10$BJZOTJg9eKjC4xlXZuj1Fe0S2FgwLZpeKgrVsC3Z9KYRjT0qwteQq', '', 'active', NULL, 0, NULL, '2025-06-27 04:58:14', '2025-06-27 04:58:14', NULL, NULL),
(193, '$2a$10$NAG4XIl6FPafBx/m4Ur8rOVqKSSk575BPETG00K81a9VyNu3DrR3O', '', 'active', NULL, 0, NULL, '2025-06-27 04:59:04', '2025-06-27 04:59:04', NULL, NULL),
(194, '$2a$10$qFhFZuwNRdYpPOh3pc60eeL/5QVRI1LEM5wG/Id7nV1QvXuKlApcq', '', 'active', NULL, 0, NULL, '2025-06-27 05:01:37', '2025-06-27 05:01:37', NULL, NULL),
(195, '$2a$10$KVlLnFuaisWAXChEHuidouBjpX70hMO7pIlj5n270KghBqGHxpnKC', '', 'active', NULL, 0, NULL, '2025-06-27 05:02:45', '2025-06-27 05:02:45', NULL, NULL),
(196, '$2a$10$FoQeJdKczpS08B4RNR/w9u5JIMP0Jp/Mr08bfPy6ptKWHYxXmXKY.', '', 'active', NULL, 0, NULL, '2025-06-27 05:03:48', '2025-06-27 05:03:48', NULL, NULL),
(197, '$2a$10$Ry60hF0gsAitUluJqN8Ry.y5N5gZ6Tsk2sZtgnkgi0U3uZ/nNxdk2', '', 'active', NULL, 0, NULL, '2025-06-27 05:05:42', '2025-06-27 05:05:42', NULL, NULL),
(198, '$2a$10$g0Szi4g1X37KJt/rkzOND..tg0yu9Dfw07Lh3utO9UueELsrDQLia', '', 'active', NULL, 0, NULL, '2025-06-27 05:06:36', '2025-06-27 05:06:36', NULL, NULL),
(199, '$2a$10$dvGujqIX8mMjM4TDYS3B/uDNrRT6VCdvNV1iUQwNRQw61T0NH3Ize', '', 'active', NULL, 0, NULL, '2025-06-27 05:07:45', '2025-06-27 05:07:45', NULL, NULL),
(200, '$2a$10$FbfC1/Q3ECFs0WgdLRUzPeVQPhFFLyI.sXNrXejO7JdcAl7/8ZhBi', '', 'active', NULL, 0, NULL, '2025-06-27 05:08:37', '2025-06-27 05:08:37', NULL, NULL),
(201, '$2a$10$RFuhn6eWW544hXNxwOVRDe4EA1CNTo2CERuYz3P6VYd0xgC3OdQIS', '', 'active', NULL, 0, NULL, '2025-06-27 06:45:33', '2025-06-27 06:45:33', NULL, NULL),
(202, '$2a$10$Qzm5BaFI520qYKZBHzuPvu.THoJqKOLA8I1jwrtBxrrtCtcl/daFe', '', 'active', NULL, 0, NULL, '2025-06-27 07:58:08', '2025-06-27 07:58:08', NULL, NULL),
(203, '$2a$12$nEleknprrS/BbwEZfgceDuqnMKVwhm8rD9Gv6m9KQBiMivlJGvEHm', '', 'active', NULL, 0, NULL, '2025-06-27 09:43:48', '2025-06-27 09:43:48', NULL, NULL),
(204, '$2a$12$s5qefVGvUE5YGjjCq5YmnegNEdCMk8AnqDSKfp46NGTqOHfVQtKVy', '', 'active', NULL, 0, NULL, '2025-06-29 05:33:20', '2025-06-29 05:33:20', NULL, NULL),
(205, '$2a$10$mhn91gp1qSNUuQX0ze4Q2e3yVBahzVkv/C3xl0jUr7d1r7/IIY6wW', '', 'active', NULL, 0, NULL, '2025-06-29 06:18:42', '2025-06-29 06:18:42', NULL, NULL),
(206, '$2a$10$HOqJY59TfP3aTHR69ySvTunN8qYbTzRslGLcU3AbWItEY9dmxTj6e', '', 'active', NULL, 0, NULL, '2025-06-29 06:21:05', '2025-06-29 06:21:05', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `account_roles`
--

CREATE TABLE `account_roles` (
  `account_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `assigned_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `assigned_by` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `expiry_date` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `account_roles`
--

INSERT INTO `account_roles` (`account_id`, `role_id`, `assigned_date`, `assigned_by`, `is_active`, `expiry_date`) VALUES
(10, 2, '2025-06-13 03:59:40', NULL, 1, NULL),
(13, 3, '2025-06-13 04:50:42', NULL, 1, NULL),
(16, 1, '2025-06-17 10:09:13', NULL, 1, NULL),
(39, 1, '2025-06-18 09:49:34', NULL, 1, NULL),
(40, 1, '2025-06-18 09:52:24', NULL, 1, NULL),
(41, 1, '2025-06-18 09:56:48', NULL, 1, NULL),
(42, 1, '2025-06-18 09:58:03', NULL, 1, NULL),
(43, 3, '2025-06-18 10:29:05', NULL, 1, NULL),
(44, 1, '2025-06-18 10:50:27', NULL, 1, NULL),
(45, 1, '2025-06-18 13:59:03', NULL, 1, NULL),
(46, 1, '2025-06-18 13:59:05', NULL, 1, NULL),
(47, 1, '2025-06-18 13:59:20', NULL, 1, NULL),
(48, 1, '2025-06-18 14:04:12', NULL, 1, NULL),
(49, 1, '2025-06-18 14:08:03', NULL, 1, NULL),
(50, 1, '2025-06-18 14:08:19', NULL, 1, NULL),
(51, 1, '2025-06-19 02:47:00', NULL, 1, NULL),
(52, 3, '2025-06-19 03:17:25', NULL, 1, NULL),
(53, 3, '2025-06-19 07:45:41', NULL, 1, NULL),
(54, 3, '2025-06-19 10:11:53', NULL, 1, NULL),
(58, 1, '2025-06-19 11:25:33', NULL, 1, NULL),
(59, 1, '2025-06-19 11:33:59', NULL, 1, NULL),
(62, 1, '2025-06-21 03:52:09', NULL, 1, NULL),
(64, 1, '2025-06-21 08:28:25', NULL, 1, NULL),
(69, 1, '2025-06-21 08:39:34', NULL, 1, NULL),
(88, 3, '2025-06-21 09:10:42', NULL, 1, NULL),
(89, 1, '2025-06-22 03:25:38', NULL, 1, NULL),
(90, 1, '2025-06-22 03:58:29', NULL, 1, NULL),
(91, 1, '2025-06-22 03:58:32', NULL, 1, NULL),
(92, 1, '2025-06-22 03:58:33', NULL, 1, NULL),
(93, 1, '2025-06-22 03:58:33', NULL, 1, NULL),
(94, 1, '2025-06-22 03:58:33', NULL, 1, NULL),
(95, 1, '2025-06-22 03:58:34', NULL, 1, NULL),
(96, 1, '2025-06-22 03:58:43', NULL, 1, NULL),
(97, 1, '2025-06-22 03:58:50', NULL, 1, NULL),
(98, 1, '2025-06-22 03:58:52', NULL, 1, NULL),
(99, 1, '2025-06-22 04:02:15', NULL, 1, NULL),
(100, 1, '2025-06-22 04:02:18', NULL, 1, NULL),
(101, 1, '2025-06-22 04:02:46', NULL, 1, NULL),
(102, 1, '2025-06-22 04:02:46', NULL, 1, NULL),
(103, 1, '2025-06-22 04:02:47', NULL, 1, NULL),
(104, 1, '2025-06-22 04:02:54', NULL, 1, NULL),
(105, 1, '2025-06-22 04:03:05', NULL, 1, NULL),
(106, 1, '2025-06-22 04:03:06', NULL, 1, NULL),
(107, 1, '2025-06-22 04:03:07', NULL, 1, NULL),
(108, 1, '2025-06-22 04:03:30', NULL, 1, NULL),
(109, 1, '2025-06-22 04:04:42', NULL, 1, NULL),
(110, 1, '2025-06-22 04:09:26', NULL, 1, NULL),
(111, 1, '2025-06-22 04:09:34', NULL, 1, NULL),
(112, 1, '2025-06-22 04:09:41', NULL, 1, NULL),
(113, 1, '2025-06-22 04:10:17', NULL, 1, NULL),
(114, 1, '2025-06-22 04:10:17', NULL, 1, NULL),
(115, 1, '2025-06-22 04:10:18', NULL, 1, NULL),
(116, 1, '2025-06-22 04:10:18', NULL, 1, NULL),
(117, 1, '2025-06-22 04:10:18', NULL, 1, NULL),
(141, 3, '2025-06-23 05:59:05', NULL, 1, NULL),
(143, 3, '2025-06-23 08:46:49', NULL, 1, NULL),
(160, 3, '2025-06-23 09:34:01', NULL, 1, NULL),
(161, 3, '2025-06-23 10:12:53', NULL, 1, NULL),
(162, 3, '2025-06-23 10:24:35', NULL, 1, NULL),
(163, 3, '2025-06-23 10:25:52', NULL, 1, NULL),
(164, 3, '2025-06-23 10:27:54', NULL, 1, NULL),
(165, 3, '2025-06-23 10:35:13', NULL, 1, NULL),
(166, 3, '2025-06-24 08:40:15', NULL, 1, NULL),
(168, 3, '2025-06-25 04:42:04', NULL, 1, NULL),
(169, 3, '2025-06-25 04:58:18', NULL, 1, NULL),
(170, 3, '2025-06-25 08:26:12', NULL, 1, NULL),
(171, 3, '2025-06-25 09:06:02', NULL, 1, NULL),
(172, 3, '2025-06-25 09:24:14', NULL, 1, NULL),
(173, 3, '2025-06-25 09:34:47', NULL, 1, NULL),
(174, 3, '2025-06-25 13:51:36', NULL, 1, NULL),
(175, 3, '2025-06-27 04:37:36', NULL, 1, NULL),
(176, 3, '2025-06-27 04:38:50', NULL, 1, NULL),
(177, 3, '2025-06-27 04:39:38', NULL, 1, NULL),
(178, 3, '2025-06-27 04:41:23', NULL, 1, NULL),
(179, 3, '2025-06-27 04:42:47', NULL, 1, NULL),
(180, 3, '2025-06-27 04:43:54', NULL, 1, NULL),
(181, 3, '2025-06-27 04:44:51', NULL, 1, NULL),
(182, 3, '2025-06-27 04:46:11', NULL, 1, NULL),
(183, 3, '2025-06-27 04:48:01', NULL, 1, NULL),
(184, 3, '2025-06-27 04:49:10', NULL, 1, NULL),
(185, 3, '2025-06-27 04:50:15', NULL, 1, NULL),
(186, 3, '2025-06-27 04:51:35', NULL, 1, NULL),
(187, 3, '2025-06-27 04:52:57', NULL, 1, NULL),
(188, 3, '2025-06-27 04:53:49', NULL, 1, NULL),
(189, 3, '2025-06-27 04:54:59', NULL, 1, NULL),
(190, 3, '2025-06-27 04:56:05', NULL, 1, NULL),
(191, 3, '2025-06-27 04:57:19', NULL, 1, NULL),
(192, 3, '2025-06-27 04:58:14', NULL, 1, NULL),
(193, 3, '2025-06-27 04:59:04', NULL, 1, NULL),
(194, 3, '2025-06-27 05:01:37', NULL, 1, NULL),
(195, 3, '2025-06-27 05:02:45', NULL, 1, NULL),
(196, 3, '2025-06-27 05:03:48', NULL, 1, NULL),
(197, 3, '2025-06-27 05:05:42', NULL, 1, NULL),
(198, 3, '2025-06-27 05:06:36', NULL, 1, NULL),
(199, 3, '2025-06-27 05:07:45', NULL, 1, NULL),
(200, 3, '2025-06-27 05:08:37', NULL, 1, NULL),
(201, 3, '2025-06-27 06:45:33', NULL, 1, NULL),
(202, 3, '2025-06-27 07:58:08', NULL, 1, NULL),
(203, 3, '2025-06-27 09:43:48', NULL, 1, NULL),
(204, 3, '2025-06-29 05:33:20', NULL, 1, NULL),
(205, 3, '2025-06-29 06:18:42', NULL, 1, NULL),
(206, 3, '2025-06-29 06:21:05', NULL, 1, NULL);

-- --------------------------------------------------------

--
-- Stand-in structure for view `active_user_sessions`
-- (See below for the actual view)
--
CREATE TABLE `active_user_sessions` (
`id` int(11)
,`session_id` varchar(128)
,`account_id` int(11)
,`name` varchar(100)
,`username` varchar(50)
,`email` varchar(100)
,`ip_address` varchar(45)
,`user_agent` text
,`last_activity` timestamp
,`expires_at` datetime
,`created_at` timestamp
);

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` int(11) NOT NULL,
  `account_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `activity_logs`
--

INSERT INTO `activity_logs` (`id`, `account_id`, `action`, `description`, `ip_address`, `user_agent`, `metadata`, `created_at`) VALUES
(1, 13, 'profile_updated', 'User profile was updated', NULL, NULL, NULL, '2025-06-16 08:27:38'),
(2, 13, 'profile_updated', 'User profile was updated', NULL, NULL, NULL, '2025-06-16 08:28:42'),
(3, 13, 'profile_updated', 'User profile was updated', NULL, NULL, NULL, '2025-06-16 08:28:50'),
(4, 13, 'profile_updated', 'User profile was updated', NULL, NULL, NULL, '2025-06-16 08:28:58'),
(5, 13, 'profile_updated', 'User profile was updated', NULL, NULL, NULL, '2025-06-16 08:41:06'),
(6, 13, 'profile_updated', 'User profile was updated', NULL, NULL, NULL, '2025-06-16 09:01:43'),
(7, 52, 'account_created', 'New student account created', NULL, NULL, '{\"role\": \"student\", \"email\": \"albertbgonzaga8con@gmail.com\", \"created_by\": \"system\"}', '2025-06-19 03:17:25'),
(8, 53, 'account_created', 'New student account created', NULL, NULL, '{\"role\": \"student\", \"email\": \"buenaventurapatrickian@gmail.com\", \"created_by\": \"system\"}', '2025-06-19 07:45:41'),
(9, 54, 'account_created', 'New student account created', NULL, NULL, '{\"role\": \"student\", \"email\": \"navalesmarkrennier8con@gmail.com\", \"created_by\": \"system\"}', '2025-06-19 10:11:53');

-- --------------------------------------------------------

--
-- Table structure for table `audit_log`
--

CREATE TABLE `audit_log` (
  `log_id` bigint(20) NOT NULL,
  `table_name` varchar(64) NOT NULL,
  `operation_type` enum('INSERT','UPDATE','DELETE') NOT NULL,
  `primary_key_value` varchar(50) NOT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `changed_by` int(11) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `session_id` varchar(128) DEFAULT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `audit_log`
--

INSERT INTO `audit_log` (`log_id`, `table_name`, `operation_type`, `primary_key_value`, `old_values`, `new_values`, `changed_by`, `ip_address`, `user_agent`, `session_id`, `timestamp`) VALUES
(1, 'students', 'INSERT', 'S1749790242780_13', NULL, '{\"student_id\": \"S1749790242780_13\", \"person_id\": 13, \"account_id\": 15, \"graduation_status\": \"enrolled\"}', 15, NULL, NULL, NULL, '2025-06-13 04:50:42'),
(2, 'students', 'UPDATE', 'S1749790242780_13', '{\"graduation_status\": \"enrolled\", \"gpa\": null, \"academic_standing\": \"good\"}', '{\"graduation_status\": \"enrolled\", \"gpa\": null, \"academic_standing\": \"good\"}', 13, NULL, NULL, NULL, '2025-06-16 07:35:21'),
(3, 'students', 'UPDATE', 'S1749790242780_13', '{\"graduation_status\": \"enrolled\", \"gpa\": null, \"academic_standing\": \"good\"}', '{\"graduation_status\": \"enrolled\", \"gpa\": null, \"academic_standing\": \"good\"}', 13, NULL, NULL, NULL, '2025-06-16 07:36:12'),
(4, 'students', 'INSERT', 'S1750170945832', NULL, '{\"student_id\": \"S1750170945832\", \"person_id\": 16, \"account_id\": 17, \"graduation_status\": \"enrolled\"}', 17, NULL, NULL, NULL, '2025-06-17 14:35:45'),
(5, 'students', 'INSERT', 'S1750171298927', NULL, '{\"student_id\": \"S1750171298927\", \"person_id\": 17, \"account_id\": 18, \"graduation_status\": \"enrolled\"}', 18, NULL, NULL, NULL, '2025-06-17 14:41:38'),
(6, 'students', 'UPDATE', 'S1749790242780_13', '{\"graduation_status\": \"enrolled\", \"gpa\": null, \"academic_standing\": \"good\"}', '{\"graduation_status\": \"enrolled\", \"gpa\": null, \"academic_standing\": \"good\"}', 13, NULL, NULL, NULL, '2025-06-18 03:18:47'),
(7, 'students', 'UPDATE', 'S1750171298927', '{\"graduation_status\": \"enrolled\", \"gpa\": null, \"academic_standing\": \"good\"}', '{\"graduation_status\": \"enrolled\", \"gpa\": null, \"academic_standing\": \"good\"}', 18, NULL, NULL, NULL, '2025-06-18 03:18:47'),
(8, 'students', 'INSERT', 'S1750217014000_19', NULL, '{\"student_id\": \"S1750217014000_19\", \"person_id\": 19, \"account_id\": 19, \"graduation_status\": \"enrolled\"}', 19, NULL, NULL, NULL, '2025-06-18 03:23:34'),
(9, 'students', 'INSERT', 'S1750217164000_20', NULL, '{\"student_id\": \"S1750217164000_20\", \"person_id\": 20, \"account_id\": 20, \"graduation_status\": \"enrolled\"}', 20, NULL, NULL, NULL, '2025-06-18 03:26:04'),
(10, 'students', 'INSERT', 'S1750242545000_43', NULL, '{\"student_id\": \"S1750242545000_43\", \"person_id\": 43, \"account_id\": 43, \"graduation_status\": \"enrolled\"}', 43, NULL, NULL, NULL, '2025-06-18 10:29:05'),
(11, 'students', 'INSERT', 'S1750303045000_52', NULL, '{\"student_id\": \"S1750303045000_52\", \"person_id\": 52, \"account_id\": 52, \"graduation_status\": \"enrolled\"}', 52, NULL, NULL, NULL, '2025-06-19 03:17:25'),
(12, 'students', 'INSERT', '8Con1750319141000_53', NULL, '{\"student_id\": \"8Con1750319141000_53\", \"person_id\": 53, \"account_id\": 53, \"graduation_status\": \"enrolled\"}', 53, NULL, NULL, NULL, '2025-06-19 07:45:41'),
(13, 'students', 'INSERT', '8Con-1750327913000_5', NULL, '{\"student_id\": \"8Con-1750327913000_5\", \"person_id\": 54, \"account_id\": 54, \"graduation_status\": \"enrolled\"}', 54, NULL, NULL, NULL, '2025-06-19 10:11:53'),
(22, 'students', 'INSERT', '8Con-1750333336000_6', NULL, '{\"student_id\": \"8Con-1750333336000_6\", \"person_id\": 60, \"account_id\": 60, \"graduation_status\": \"enrolled\"}', 60, NULL, NULL, NULL, '2025-06-19 11:42:16'),
(23, 'students', 'INSERT', 'S1750496764000_85', NULL, '{\"student_id\": \"S1750496764000_85\", \"person_id\": 85, \"account_id\": 85, \"graduation_status\": \"enrolled\"}', 85, NULL, NULL, NULL, '2025-06-21 09:06:04'),
(24, 'students', 'INSERT', 'S1750497042000_88', NULL, '{\"student_id\": \"S1750497042000_88\", \"person_id\": 88, \"account_id\": 88, \"graduation_status\": \"enrolled\"}', 88, NULL, NULL, NULL, '2025-06-21 09:10:42'),
(25, 'students', 'INSERT', 'S1750573548000_134', NULL, '{\"student_id\": \"S1750573548000_134\", \"person_id\": 134, \"account_id\": 134, \"graduation_status\": \"enrolled\"}', 134, NULL, NULL, NULL, '2025-06-22 06:25:48'),
(26, 'students', 'INSERT', 'S1750647862000_138', NULL, '{\"student_id\": \"S1750647862000_138\", \"person_id\": 138, \"account_id\": 138, \"graduation_status\": \"enrolled\"}', 138, NULL, NULL, NULL, '2025-06-23 03:04:22'),
(27, 'students', 'INSERT', 'S1750658345000_141', NULL, '{\"student_id\": \"S1750658345000_141\", \"person_id\": 141, \"account_id\": 141, \"graduation_status\": \"enrolled\"}', 141, NULL, NULL, NULL, '2025-06-23 05:59:05'),
(28, 'students', 'INSERT', 'S1750668409000_143', NULL, '{\"student_id\": \"S1750668409000_143\", \"person_id\": 143, \"account_id\": 143, \"graduation_status\": \"enrolled\"}', 143, NULL, NULL, NULL, '2025-06-23 08:46:49'),
(29, 'students', 'INSERT', 'S1750671241000_160', NULL, '{\"student_id\": \"S1750671241000_160\", \"person_id\": 160, \"account_id\": 160, \"graduation_status\": \"enrolled\"}', 160, NULL, NULL, NULL, '2025-06-23 09:34:01'),
(30, 'students', 'INSERT', 'S1750673573000_161', NULL, '{\"student_id\": \"S1750673573000_161\", \"person_id\": 161, \"account_id\": 161, \"graduation_status\": \"enrolled\"}', 161, NULL, NULL, NULL, '2025-06-23 10:12:53'),
(31, 'students', 'INSERT', 'S1750674275000_162', NULL, '{\"student_id\": \"S1750674275000_162\", \"person_id\": 162, \"account_id\": 162, \"graduation_status\": \"enrolled\"}', 162, NULL, NULL, NULL, '2025-06-23 10:24:35'),
(32, 'students', 'INSERT', 'S1750674352000_163', NULL, '{\"student_id\": \"S1750674352000_163\", \"person_id\": 163, \"account_id\": 163, \"graduation_status\": \"enrolled\"}', 163, NULL, NULL, NULL, '2025-06-23 10:25:52'),
(33, 'students', 'INSERT', 'S1750674474000_164', NULL, '{\"student_id\": \"S1750674474000_164\", \"person_id\": 164, \"account_id\": 164, \"graduation_status\": \"enrolled\"}', 164, NULL, NULL, NULL, '2025-06-23 10:27:54'),
(34, 'students', 'INSERT', 'S1750674913000_165', NULL, '{\"student_id\": \"S1750674913000_165\", \"person_id\": 165, \"account_id\": 165, \"graduation_status\": \"enrolled\"}', 165, NULL, NULL, NULL, '2025-06-23 10:35:13'),
(35, 'students', 'INSERT', '8Con1750754415000_16', NULL, '{\"student_id\": \"8Con1750754415000_16\", \"person_id\": 166, \"account_id\": 166, \"graduation_status\": \"enrolled\"}', 166, NULL, NULL, NULL, '2025-06-24 08:40:15'),
(36, 'students', 'INSERT', '8Con1750754536000_16', NULL, '{\"student_id\": \"8Con1750754536000_16\", \"person_id\": 167, \"account_id\": 167, \"graduation_status\": \"enrolled\"}', 167, NULL, NULL, NULL, '2025-06-24 08:42:16'),
(37, 'students', 'INSERT', '8Con-2025-000168', NULL, '{\"student_id\": \"8Con-2025-000168\", \"person_id\": 168, \"account_id\": 168, \"graduation_status\": \"enrolled\"}', 168, NULL, NULL, NULL, '2025-06-25 04:42:04'),
(38, 'students', 'INSERT', '8Con-2025-000169', NULL, '{\"student_id\": \"8Con-2025-000169\", \"person_id\": 169, \"account_id\": 169, \"graduation_status\": \"enrolled\"}', 169, NULL, NULL, NULL, '2025-06-25 04:58:18'),
(39, 'students', 'INSERT', '8Con-2025-000170', NULL, '{\"student_id\": \"8Con-2025-000170\", \"person_id\": 170, \"account_id\": 170, \"graduation_status\": \"enrolled\"}', 170, NULL, NULL, NULL, '2025-06-25 08:26:12'),
(40, 'students', 'INSERT', '8Con-2025-000171', NULL, '{\"student_id\": \"8Con-2025-000171\", \"person_id\": 171, \"account_id\": 171, \"graduation_status\": \"enrolled\"}', 171, NULL, NULL, NULL, '2025-06-25 09:06:02'),
(41, 'students', 'INSERT', '8Con-2025-000172', NULL, '{\"student_id\": \"8Con-2025-000172\", \"person_id\": 172, \"account_id\": 172, \"graduation_status\": \"enrolled\"}', 172, NULL, NULL, NULL, '2025-06-25 09:24:14'),
(42, 'students', 'INSERT', '8Con-2025-000173', NULL, '{\"student_id\": \"8Con-2025-000173\", \"person_id\": 173, \"account_id\": 173, \"graduation_status\": \"enrolled\"}', 173, NULL, NULL, NULL, '2025-06-25 09:34:47'),
(43, 'students', 'INSERT', '8Con-2025-000174', NULL, '{\"student_id\": \"8Con-2025-000174\", \"person_id\": 174, \"account_id\": 174, \"graduation_status\": \"enrolled\"}', 174, NULL, NULL, NULL, '2025-06-25 13:51:36'),
(44, 'payments', 'INSERT', '1', NULL, '{\"payment_id\": 1, \"account_id\": 26, \"payment_amount\": 10000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-26 03:31:47'),
(45, 'payments', 'INSERT', '2', NULL, '{\"payment_id\": 2, \"account_id\": 25, \"payment_amount\": 10000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-26 03:37:36'),
(46, 'payments', 'INSERT', '3', NULL, '{\"payment_id\": 3, \"account_id\": 26, \"payment_amount\": 10000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-26 03:42:19'),
(47, 'payments', 'INSERT', '4', NULL, '{\"payment_id\": 4, \"account_id\": 19, \"payment_amount\": 10000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-26 03:59:26'),
(48, 'payments', 'INSERT', '5', NULL, '{\"payment_id\": 5, \"account_id\": 26, \"payment_amount\": 5000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-26 04:02:28'),
(49, 'payments', 'INSERT', '6', NULL, '{\"payment_id\": 6, \"account_id\": 19, \"payment_amount\": 1000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-26 04:08:13'),
(50, 'payments', 'INSERT', '7', NULL, '{\"payment_id\": 7, \"account_id\": 19, \"payment_amount\": 100.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-26 04:11:17'),
(51, 'payments', 'INSERT', '8', NULL, '{\"payment_id\": 8, \"account_id\": 26, \"payment_amount\": 100.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-26 04:51:33'),
(52, 'payments', 'INSERT', '9', NULL, '{\"payment_id\": 9, \"account_id\": 22, \"payment_amount\": 2000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-26 10:51:19'),
(53, 'payments', 'INSERT', '10', NULL, '{\"payment_id\": 10, \"account_id\": 21, \"payment_amount\": 1000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-26 10:51:54'),
(54, 'students', 'INSERT', '8Con-2025-000175', NULL, '{\"student_id\": \"8Con-2025-000175\", \"person_id\": 175, \"account_id\": 175, \"graduation_status\": \"enrolled\"}', 175, NULL, NULL, NULL, '2025-06-27 04:37:36'),
(55, 'students', 'INSERT', '8Con-2025-000176', NULL, '{\"student_id\": \"8Con-2025-000176\", \"person_id\": 176, \"account_id\": 176, \"graduation_status\": \"enrolled\"}', 176, NULL, NULL, NULL, '2025-06-27 04:38:50'),
(56, 'students', 'INSERT', '8Con-2025-000177', NULL, '{\"student_id\": \"8Con-2025-000177\", \"person_id\": 177, \"account_id\": 177, \"graduation_status\": \"enrolled\"}', 177, NULL, NULL, NULL, '2025-06-27 04:39:38'),
(57, 'students', 'INSERT', '8Con-2025-000178', NULL, '{\"student_id\": \"8Con-2025-000178\", \"person_id\": 178, \"account_id\": 178, \"graduation_status\": \"enrolled\"}', 178, NULL, NULL, NULL, '2025-06-27 04:41:23'),
(58, 'students', 'INSERT', '8Con-2025-000179', NULL, '{\"student_id\": \"8Con-2025-000179\", \"person_id\": 179, \"account_id\": 179, \"graduation_status\": \"enrolled\"}', 179, NULL, NULL, NULL, '2025-06-27 04:42:47'),
(59, 'students', 'INSERT', '8Con-2025-000180', NULL, '{\"student_id\": \"8Con-2025-000180\", \"person_id\": 180, \"account_id\": 180, \"graduation_status\": \"enrolled\"}', 180, NULL, NULL, NULL, '2025-06-27 04:43:54'),
(60, 'students', 'INSERT', '8Con-2025-000181', NULL, '{\"student_id\": \"8Con-2025-000181\", \"person_id\": 181, \"account_id\": 181, \"graduation_status\": \"enrolled\"}', 181, NULL, NULL, NULL, '2025-06-27 04:44:51'),
(61, 'students', 'INSERT', '8Con-2025-000182', NULL, '{\"student_id\": \"8Con-2025-000182\", \"person_id\": 182, \"account_id\": 182, \"graduation_status\": \"enrolled\"}', 182, NULL, NULL, NULL, '2025-06-27 04:46:11'),
(62, 'students', 'INSERT', '8Con-2025-000183', NULL, '{\"student_id\": \"8Con-2025-000183\", \"person_id\": 183, \"account_id\": 183, \"graduation_status\": \"enrolled\"}', 183, NULL, NULL, NULL, '2025-06-27 04:48:01'),
(63, 'students', 'INSERT', '8Con-2025-000184', NULL, '{\"student_id\": \"8Con-2025-000184\", \"person_id\": 184, \"account_id\": 184, \"graduation_status\": \"enrolled\"}', 184, NULL, NULL, NULL, '2025-06-27 04:49:10'),
(64, 'students', 'INSERT', '8Con-2025-000185', NULL, '{\"student_id\": \"8Con-2025-000185\", \"person_id\": 185, \"account_id\": 185, \"graduation_status\": \"enrolled\"}', 185, NULL, NULL, NULL, '2025-06-27 04:50:15'),
(65, 'students', 'INSERT', '8Con-2025-000186', NULL, '{\"student_id\": \"8Con-2025-000186\", \"person_id\": 186, \"account_id\": 186, \"graduation_status\": \"enrolled\"}', 186, NULL, NULL, NULL, '2025-06-27 04:51:35'),
(66, 'students', 'INSERT', '8Con-2025-000187', NULL, '{\"student_id\": \"8Con-2025-000187\", \"person_id\": 187, \"account_id\": 187, \"graduation_status\": \"enrolled\"}', 187, NULL, NULL, NULL, '2025-06-27 04:52:57'),
(67, 'students', 'INSERT', '8Con-2025-000188', NULL, '{\"student_id\": \"8Con-2025-000188\", \"person_id\": 188, \"account_id\": 188, \"graduation_status\": \"enrolled\"}', 188, NULL, NULL, NULL, '2025-06-27 04:53:49'),
(68, 'students', 'INSERT', '8Con-2025-000189', NULL, '{\"student_id\": \"8Con-2025-000189\", \"person_id\": 189, \"account_id\": 189, \"graduation_status\": \"enrolled\"}', 189, NULL, NULL, NULL, '2025-06-27 04:54:59'),
(69, 'students', 'INSERT', '8Con-2025-000190', NULL, '{\"student_id\": \"8Con-2025-000190\", \"person_id\": 190, \"account_id\": 190, \"graduation_status\": \"enrolled\"}', 190, NULL, NULL, NULL, '2025-06-27 04:56:05'),
(70, 'students', 'INSERT', '8Con-2025-000191', NULL, '{\"student_id\": \"8Con-2025-000191\", \"person_id\": 191, \"account_id\": 191, \"graduation_status\": \"enrolled\"}', 191, NULL, NULL, NULL, '2025-06-27 04:57:19'),
(71, 'students', 'INSERT', '8Con-2025-000192', NULL, '{\"student_id\": \"8Con-2025-000192\", \"person_id\": 192, \"account_id\": 192, \"graduation_status\": \"enrolled\"}', 192, NULL, NULL, NULL, '2025-06-27 04:58:14'),
(72, 'students', 'INSERT', '8Con-2025-000193', NULL, '{\"student_id\": \"8Con-2025-000193\", \"person_id\": 193, \"account_id\": 193, \"graduation_status\": \"enrolled\"}', 193, NULL, NULL, NULL, '2025-06-27 04:59:04'),
(73, 'students', 'INSERT', '8Con-2025-000194', NULL, '{\"student_id\": \"8Con-2025-000194\", \"person_id\": 194, \"account_id\": 194, \"graduation_status\": \"enrolled\"}', 194, NULL, NULL, NULL, '2025-06-27 05:01:37'),
(74, 'students', 'INSERT', '8Con-2025-000195', NULL, '{\"student_id\": \"8Con-2025-000195\", \"person_id\": 195, \"account_id\": 195, \"graduation_status\": \"enrolled\"}', 195, NULL, NULL, NULL, '2025-06-27 05:02:45'),
(75, 'students', 'INSERT', '8Con-2025-000196', NULL, '{\"student_id\": \"8Con-2025-000196\", \"person_id\": 196, \"account_id\": 196, \"graduation_status\": \"enrolled\"}', 196, NULL, NULL, NULL, '2025-06-27 05:03:48'),
(76, 'students', 'INSERT', '8Con-2025-000197', NULL, '{\"student_id\": \"8Con-2025-000197\", \"person_id\": 197, \"account_id\": 197, \"graduation_status\": \"enrolled\"}', 197, NULL, NULL, NULL, '2025-06-27 05:05:42'),
(77, 'students', 'INSERT', '8Con-2025-000198', NULL, '{\"student_id\": \"8Con-2025-000198\", \"person_id\": 198, \"account_id\": 198, \"graduation_status\": \"enrolled\"}', 198, NULL, NULL, NULL, '2025-06-27 05:06:36'),
(78, 'students', 'INSERT', '8Con-2025-000199', NULL, '{\"student_id\": \"8Con-2025-000199\", \"person_id\": 199, \"account_id\": 199, \"graduation_status\": \"enrolled\"}', 199, NULL, NULL, NULL, '2025-06-27 05:07:45'),
(79, 'students', 'INSERT', '8Con-2025-000200', NULL, '{\"student_id\": \"8Con-2025-000200\", \"person_id\": 200, \"account_id\": 200, \"graduation_status\": \"enrolled\"}', 200, NULL, NULL, NULL, '2025-06-27 05:08:37'),
(80, 'students', 'INSERT', '8Con-2025-000201', NULL, '{\"student_id\": \"8Con-2025-000201\", \"person_id\": 201, \"account_id\": 201, \"graduation_status\": \"enrolled\"}', 201, NULL, NULL, NULL, '2025-06-27 06:45:33'),
(81, 'students', 'INSERT', '8Con-2025-000202', NULL, '{\"student_id\": \"8Con-2025-000202\", \"person_id\": 202, \"account_id\": 202, \"graduation_status\": \"enrolled\"}', 202, NULL, NULL, NULL, '2025-06-27 07:58:08'),
(82, 'students', 'INSERT', '8Con-2025-000203', NULL, '{\"student_id\": \"8Con-2025-000203\", \"person_id\": 203, \"account_id\": 203, \"graduation_status\": \"enrolled\"}', 203, NULL, NULL, NULL, '2025-06-27 09:43:48'),
(83, 'payments', 'INSERT', '11', NULL, '{\"payment_id\": 11, \"account_id\": 29, \"payment_amount\": 10000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-27 10:31:34'),
(84, 'students', 'INSERT', 'S1751175200000_204', NULL, '{\"student_id\": \"S1751175200000_204\", \"person_id\": 204, \"account_id\": 204, \"graduation_status\": \"enrolled\"}', 204, NULL, NULL, NULL, '2025-06-29 05:33:20'),
(85, 'students', 'INSERT', 'S1751177922000_205', NULL, '{\"student_id\": \"S1751177922000_205\", \"person_id\": 205, \"account_id\": 205, \"graduation_status\": \"enrolled\"}', 205, NULL, NULL, NULL, '2025-06-29 06:18:42'),
(86, 'students', 'INSERT', 'S1751178065000_206', NULL, '{\"student_id\": \"S1751178065000_206\", \"person_id\": 206, \"account_id\": 206, \"graduation_status\": \"enrolled\"}', 206, NULL, NULL, NULL, '2025-06-29 06:21:05'),
(87, 'payments', 'INSERT', '12', NULL, '{\"payment_id\": 12, \"account_id\": 58, \"payment_amount\": 3400.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-29 06:28:32'),
(88, 'payments', 'INSERT', '13', NULL, '{\"payment_id\": 13, \"account_id\": 30, \"payment_amount\": 1000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-29 07:02:24');

-- --------------------------------------------------------

--
-- Table structure for table `competencies`
--

CREATE TABLE `competencies` (
  `competency_id` int(11) NOT NULL,
  `competency_type_id` int(11) NOT NULL,
  `competency_code` varchar(20) NOT NULL,
  `competency_name` varchar(100) NOT NULL,
  `competency_description` text DEFAULT NULL,
  `learning_objectives` text DEFAULT NULL,
  `assessment_criteria` text DEFAULT NULL,
  `weight` decimal(5,2) DEFAULT 1.00,
  `prerequisite_competency_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `competencies`
--

INSERT INTO `competencies` (`competency_id`, `competency_type_id`, `competency_code`, `competency_name`, `competency_description`, `learning_objectives`, `assessment_criteria`, `weight`, `prerequisite_competency_id`, `is_active`) VALUES
(1, 1, 'BASIC001', 'Trading Fundamentals', 'Understanding basic trading concepts and terminology', NULL, NULL, 1.00, NULL, 0),
(2, 1, 'BASIC002', 'Market Analysis', 'Introduction to technical and fundamental analysis', NULL, NULL, 1.00, NULL, 0),
(3, 2, 'COMM001', 'Risk Management', 'Understanding and implementing risk management strategies', NULL, NULL, 1.00, NULL, 0),
(4, 2, 'COMM002', 'Portfolio Construction', 'Building and managing investment portfolios', NULL, NULL, 1.00, NULL, 0),
(5, 3, 'CORE001', 'Advanced Strategies', 'Complex trading strategies and execution', NULL, NULL, 1.00, NULL, 0),
(6, 3, 'CORE002', 'Quantitative Analysis', 'Statistical and mathematical analysis methods', NULL, NULL, 1.00, NULL, 0),
(11, 1, 'BASIC003', 'Market Psychology', 'Understanding market sentiment and psychology', 'Recognize psychological factors in trading', 'Behavioral analysis and emotional control', 1.00, 1, 0),
(12, 1, 'COMP001', 'Analysis', 'Analysis', NULL, NULL, 1.00, NULL, 0),
(13, 2, 'BSC1', 'Analysis', 'Analysis', NULL, NULL, 1.00, NULL, 1),
(14, 1, 'BAO-01', 'Business', 'adasaa', NULL, NULL, 1.00, NULL, 1),
(15, 1, 'BSC01', 'Basic Course', 'Introduction to Forex Trading and Market Analysis', NULL, NULL, 1.00, NULL, 1),
(16, 2, 'COM02', 'Common Course', 'Start Trading and Conducting Market Analysis', NULL, NULL, 1.00, NULL, 1),
(17, 3, 'COR3', 'Core Course', 'Trading', NULL, NULL, 1.00, NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `competency_progress`
--

CREATE TABLE `competency_progress` (
  `progress_id` int(11) NOT NULL,
  `student_id` varchar(20) DEFAULT NULL,
  `competency_type` enum('Basic','Common','Core') DEFAULT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `passed` tinyint(1) DEFAULT NULL,
  `exam_status` enum('Not taken','Pass','Retake') DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `competency_types`
--

CREATE TABLE `competency_types` (
  `competency_type_id` int(11) NOT NULL,
  `type_name` varchar(50) NOT NULL,
  `type_description` text DEFAULT NULL,
  `passing_score` decimal(5,2) DEFAULT 70.00,
  `max_attempts` int(11) DEFAULT 3,
  `weight` decimal(5,2) DEFAULT 1.00,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `competency_types`
--

INSERT INTO `competency_types` (`competency_type_id`, `type_name`, `type_description`, `passing_score`, `max_attempts`, `weight`, `is_active`) VALUES
(1, 'Basic', 'Fundamental trading concepts and terminology', 70.00, 3, 1.00, 1),
(2, 'Common', 'Standard trading skills and analysis techniques', 75.00, 3, 1.00, 1),
(3, 'Core', 'Advanced trading strategies and portfolio management', 80.00, 3, 1.00, 1);

-- --------------------------------------------------------

--
-- Table structure for table `contact_info`
--

CREATE TABLE `contact_info` (
  `contact_id` int(11) NOT NULL,
  `person_id` int(11) NOT NULL,
  `student_id` varchar(50) NOT NULL,
  `contact_type` enum('email','phone','address') NOT NULL,
  `contact_value` varchar(255) NOT NULL,
  `is_primary` tinyint(1) DEFAULT 0,
  `is_verified` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `contact_info`
--

INSERT INTO `contact_info` (`contact_id`, `person_id`, `student_id`, `contact_type`, `contact_value`, `is_primary`, `is_verified`, `created_at`, `updated_at`) VALUES
(55, 160, 'S1750671241000_160', 'phone', '09704918692', 1, 0, '2025-06-23 09:34:01', '2025-06-23 09:34:01'),
(56, 160, 'S1750671241000_160', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-23 09:34:01', '2025-06-23 09:34:01'),
(57, 160, 'S1750671241000_160', 'email', 'gonzagaalbertpdm@gmail.com', 1, 0, '2025-06-23 09:34:01', '2025-06-23 09:34:01'),
(58, 161, 'S1750673573000_161', 'phone', '09207866094', 1, 0, '2025-06-23 10:12:54', '2025-06-23 10:12:54'),
(59, 161, 'S1750673573000_161', 'address', 'Marilao', 1, 0, '2025-06-23 10:12:54', '2025-06-23 10:12:54'),
(60, 161, 'S1750673573000_161', 'email', 'macabatajhamesandrew8con@gmail.com', 1, 0, '2025-06-23 10:12:54', '2025-06-23 10:12:54'),
(61, 162, 'S1750674275000_162', 'phone', '09704918693', 1, 0, '2025-06-23 10:24:35', '2025-06-23 10:24:35'),
(62, 162, 'S1750674275000_162', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-23 10:24:35', '2025-06-23 10:24:35'),
(63, 162, 'S1750674275000_162', 'email', 'gonzagaalbertb8con@gmail.com', 1, 0, '2025-06-23 10:24:35', '2025-06-23 10:24:35'),
(64, 163, 'S1750674352000_163', 'phone', '09704918693', 1, 0, '2025-06-23 10:25:52', '2025-06-23 10:25:52'),
(65, 163, 'S1750674352000_163', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-23 10:25:52', '2025-06-23 10:25:52'),
(66, 163, 'S1750674352000_163', 'email', 'cj123@gmail.com', 1, 0, '2025-06-23 10:25:52', '2025-06-23 10:25:52'),
(67, 164, 'S1750674474000_164', 'phone', '09704918693', 1, 0, '2025-06-23 10:27:54', '2025-06-23 10:27:54'),
(68, 164, 'S1750674474000_164', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-23 10:27:54', '2025-06-23 10:27:54'),
(69, 164, 'S1750674474000_164', 'email', 'cj1233@gmail.com', 1, 0, '2025-06-23 10:27:54', '2025-06-23 10:27:54'),
(70, 165, 'S1750674913000_165', 'phone', '09704918693', 1, 0, '2025-06-23 10:35:13', '2025-06-23 10:35:13'),
(71, 165, 'S1750674913000_165', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-23 10:35:13', '2025-06-23 10:35:13'),
(72, 165, 'S1750674913000_165', 'email', 'cj1233s@gmail.com', 1, 0, '2025-06-23 10:35:13', '2025-06-23 10:35:13'),
(73, 166, '8Con1750754415000_16', 'phone', '09704918693', 1, 0, '2025-06-24 08:40:15', '2025-06-24 08:40:15'),
(74, 166, '8Con1750754415000_16', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-24 08:40:15', '2025-06-24 08:40:15'),
(75, 166, '8Con1750754415000_16', 'email', 'gonzagaalbertbpdm@gmail.com', 1, 0, '2025-06-24 08:40:15', '2025-06-24 08:40:15'),
(79, 168, '8Con-2025-000168', 'phone', '09704918693', 1, 0, '2025-06-25 04:42:04', '2025-06-25 04:42:04'),
(80, 168, '8Con-2025-000168', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-25 04:42:04', '2025-06-25 04:42:04'),
(81, 168, '8Con-2025-000168', 'email', 'manzanojoshuaphilip8con@gmail.com', 1, 0, '2025-06-25 04:42:04', '2025-06-25 04:42:04'),
(82, 169, '8Con-2025-000169', 'phone', '09704918693', 1, 0, '2025-06-25 04:58:18', '2025-06-25 04:58:18'),
(83, 169, '8Con-2025-000169', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-25 04:58:18', '2025-06-25 04:58:18'),
(84, 169, '8Con-2025-000169', 'email', 'albertgonzaga8con@gmail.com', 1, 0, '2025-06-25 04:58:18', '2025-06-25 04:58:18'),
(85, 170, '8Con-2025-000170', 'phone', '09704918693', 1, 0, '2025-06-25 08:26:12', '2025-06-25 08:26:12'),
(86, 170, '8Con-2025-000170', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-25 08:26:12', '2025-06-25 08:26:12'),
(87, 170, '8Con-2025-000170', 'email', 'marksaa@gmail.com', 1, 0, '2025-06-25 08:26:12', '2025-06-25 08:26:12'),
(88, 171, '8Con-2025-000171', 'phone', '09704918693', 1, 0, '2025-06-25 09:06:02', '2025-06-25 09:06:02'),
(89, 171, '8Con-2025-000171', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-25 09:06:02', '2025-06-25 09:06:02'),
(90, 171, '8Con-2025-000171', 'email', 'emnacenjohnmathew8con@gmail.com', 1, 0, '2025-06-25 09:06:02', '2025-06-25 09:06:02'),
(91, 172, '8Con-2025-000172', 'phone', '09704918693', 1, 0, '2025-06-25 09:24:14', '2025-06-25 09:24:14'),
(92, 172, '8Con-2025-000172', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-25 09:24:14', '2025-06-25 09:24:14'),
(93, 172, '8Con-2025-000172', 'email', 'gonzagaalbertbpdm@gmail.com', 1, 0, '2025-06-25 09:24:14', '2025-06-25 09:24:14'),
(94, 173, '8Con-2025-000173', 'phone', '09704918693', 1, 0, '2025-06-25 09:34:47', '2025-06-25 09:34:47'),
(95, 173, '8Con-2025-000173', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-25 09:34:47', '2025-06-25 09:34:47'),
(96, 173, '8Con-2025-000173', 'email', 'gonzagaalbertbpdm@gmail.com', 1, 0, '2025-06-25 09:34:47', '2025-06-25 09:34:47'),
(97, 174, '8Con-2025-000174', 'phone', '09704918693', 1, 0, '2025-06-25 13:51:37', '2025-06-25 13:51:37'),
(98, 174, '8Con-2025-000174', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-25 13:51:37', '2025-06-25 13:51:37'),
(99, 174, '8Con-2025-000174', 'email', 'emnacenjohnmathewcon@gmail.com', 1, 0, '2025-06-25 13:51:37', '2025-06-25 13:51:37'),
(100, 175, '8Con-2025-000175', 'phone', '09965678907', 1, 0, '2025-06-27 04:37:36', '2025-06-27 04:37:36'),
(101, 175, '8Con-2025-000175', 'address', '173 Zinya St., Sta. Rosa 2, Marilao, Bulacan', 1, 0, '2025-06-27 04:37:36', '2025-06-27 04:37:36'),
(102, 175, '8Con-2025-000175', 'email', 'aaa@gmail.com', 1, 0, '2025-06-27 04:37:36', '2025-06-27 04:37:36'),
(103, 176, '8Con-2025-000176', 'phone', '09789674567', 1, 0, '2025-06-27 04:38:50', '2025-06-27 04:38:50'),
(104, 176, '8Con-2025-000176', 'address', 'esteban north', 1, 0, '2025-06-27 04:38:50', '2025-06-27 04:38:50'),
(105, 176, '8Con-2025-000176', 'email', 'bbb@gmail.com', 1, 0, '2025-06-27 04:38:50', '2025-06-27 04:38:50'),
(106, 177, '8Con-2025-000177', 'phone', '09427184388', 1, 0, '2025-06-27 04:39:38', '2025-06-27 04:39:38'),
(107, 177, '8Con-2025-000177', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-27 04:39:38', '2025-06-27 04:39:38'),
(108, 177, '8Con-2025-000177', 'email', 'crajeextremeyt@gmail.com', 1, 0, '2025-06-27 04:39:38', '2025-06-27 04:39:38'),
(109, 178, '8Con-2025-000178', 'phone', '09704918693', 1, 0, '2025-06-27 04:41:23', '2025-06-27 04:41:23'),
(110, 178, '8Con-2025-000178', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-27 04:41:23', '2025-06-27 04:41:23'),
(111, 178, '8Con-2025-000178', 'email', 'manzanojoshuaphilip@gmail.com', 1, 0, '2025-06-27 04:41:23', '2025-06-27 04:41:23'),
(112, 179, '8Con-2025-000179', 'phone', '09789806543', 1, 0, '2025-06-27 04:42:47', '2025-06-27 04:42:47'),
(113, 179, '8Con-2025-000179', 'address', 'Marilao', 1, 0, '2025-06-27 04:42:47', '2025-06-27 04:42:47'),
(114, 179, '8Con-2025-000179', 'email', 'ryouki@gmail.com', 1, 0, '2025-06-27 04:42:47', '2025-06-27 04:42:47'),
(115, 180, '8Con-2025-000180', 'phone', '09347656789', 1, 0, '2025-06-27 04:43:54', '2025-06-27 04:43:54'),
(116, 180, '8Con-2025-000180', 'address', 'Blk 12 Lot 31 Urban Deca Homes, Magnolia St., Brgy. Abangan Norte, Marilao, Bulacan', 1, 0, '2025-06-27 04:43:54', '2025-06-27 04:43:54'),
(117, 180, '8Con-2025-000180', 'email', 'sevilla@gmail.com', 1, 0, '2025-06-27 04:43:54', '2025-06-27 04:43:54'),
(118, 181, '8Con-2025-000181', 'phone', '09786542345', 1, 0, '2025-06-27 04:44:51', '2025-06-27 04:44:51'),
(119, 181, '8Con-2025-000181', 'address', 'Megalodon, Marilao, Bulacan', 1, 0, '2025-06-27 04:44:51', '2025-06-27 04:44:51'),
(120, 181, '8Con-2025-000181', 'email', 'venus@gmail.com', 1, 0, '2025-06-27 04:44:51', '2025-06-27 04:44:51'),
(121, 182, '8Con-2025-000182', 'phone', '09907864567', 1, 0, '2025-06-27 04:46:11', '2025-06-27 04:46:11'),
(122, 182, '8Con-2025-000182', 'address', '173 Zinya St., Sta. Rosa 2, Marilao, Bulacan', 1, 0, '2025-06-27 04:46:11', '2025-06-27 04:46:11'),
(123, 182, '8Con-2025-000182', 'email', 'bene@gmail.com', 1, 0, '2025-06-27 04:46:11', '2025-06-27 04:46:11'),
(124, 183, '8Con-2025-000183', 'phone', '09896781234', 1, 0, '2025-06-27 04:48:01', '2025-06-27 04:48:01'),
(125, 183, '8Con-2025-000183', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-27 04:48:01', '2025-06-27 04:48:01'),
(126, 183, '8Con-2025-000183', 'email', 'ray@gmail.com', 1, 0, '2025-06-27 04:48:01', '2025-06-27 04:48:01'),
(127, 184, '8Con-2025-000184', 'phone', '09097864567', 1, 0, '2025-06-27 04:49:10', '2025-06-27 04:49:10'),
(128, 184, '8Con-2025-000184', 'address', 'esteban north', 1, 0, '2025-06-27 04:49:10', '2025-06-27 04:49:10'),
(129, 184, '8Con-2025-000184', 'email', 'katen@gmail.com', 1, 0, '2025-06-27 04:49:10', '2025-06-27 04:49:10'),
(130, 185, '8Con-2025-000185', 'phone', '09346542345', 1, 0, '2025-06-27 04:50:15', '2025-06-27 04:50:15'),
(131, 185, '8Con-2025-000185', 'address', 'Megalodon, Marilao, Bulacan', 1, 0, '2025-06-27 04:50:15', '2025-06-27 04:50:15'),
(132, 185, '8Con-2025-000185', 'email', 'sena@gmail.com', 1, 0, '2025-06-27 04:50:15', '2025-06-27 04:50:15'),
(133, 186, '8Con-2025-000186', 'phone', '09785679876', 1, 0, '2025-06-27 04:51:35', '2025-06-27 04:51:35'),
(134, 186, '8Con-2025-000186', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-27 04:51:35', '2025-06-27 04:51:35'),
(135, 186, '8Con-2025-000186', 'email', 'frost@gmail.com', 1, 0, '2025-06-27 04:51:35', '2025-06-27 04:51:35'),
(136, 187, '8Con-2025-000187', 'phone', '09034546567', 1, 0, '2025-06-27 04:52:57', '2025-06-27 04:52:57'),
(137, 187, '8Con-2025-000187', 'address', 'Megalodon, Marilao, Bulacan', 1, 0, '2025-06-27 04:52:57', '2025-06-27 04:52:57'),
(138, 187, '8Con-2025-000187', 'email', 'flash@gmail.com', 1, 0, '2025-06-27 04:52:57', '2025-06-27 04:52:57'),
(139, 188, '8Con-2025-000188', 'phone', '09907865647', 1, 0, '2025-06-27 04:53:49', '2025-06-27 04:53:49'),
(140, 188, '8Con-2025-000188', 'address', '173 Zinya St., Sta. Rosa 2, Marilao, Bulacan', 1, 0, '2025-06-27 04:53:49', '2025-06-27 04:53:49'),
(141, 188, '8Con-2025-000188', 'email', 'vibe@gmail.com', 1, 0, '2025-06-27 04:53:49', '2025-06-27 04:53:49'),
(142, 189, '8Con-2025-000189', 'phone', '09789877980', 1, 0, '2025-06-27 04:54:59', '2025-06-27 04:54:59'),
(143, 189, '8Con-2025-000189', 'address', 'esteban north', 1, 0, '2025-06-27 04:54:59', '2025-06-27 04:54:59'),
(144, 189, '8Con-2025-000189', 'email', 'ame@gmail.com', 1, 0, '2025-06-27 04:54:59', '2025-06-27 04:54:59'),
(145, 190, '8Con-2025-000190', 'phone', '09789783425', 1, 0, '2025-06-27 04:56:05', '2025-06-27 04:56:05'),
(146, 190, '8Con-2025-000190', 'address', 'Marilao', 1, 0, '2025-06-27 04:56:05', '2025-06-27 04:56:05'),
(147, 190, '8Con-2025-000190', 'email', 'killer@gmail.com', 1, 0, '2025-06-27 04:56:05', '2025-06-27 04:56:05'),
(148, 191, '8Con-2025-000191', 'phone', '09896582345', 1, 0, '2025-06-27 04:57:19', '2025-06-27 04:57:19'),
(149, 191, '8Con-2025-000191', 'address', 'Blk 12 Lot 31 Urban Deca Homes, Magnolia St., Brgy. Abangan Norte, Marilao, Bulacan', 1, 0, '2025-06-27 04:57:19', '2025-06-27 04:57:19'),
(150, 191, '8Con-2025-000191', 'email', 'zoom@gmail.com', 1, 0, '2025-06-27 04:57:19', '2025-06-27 04:57:19'),
(151, 192, '8Con-2025-000192', 'phone', '09984506750', 1, 0, '2025-06-27 04:58:14', '2025-06-27 04:58:14'),
(152, 192, '8Con-2025-000192', 'address', 'Megalodon, Marilao, Bulacan', 1, 0, '2025-06-27 04:58:14', '2025-06-27 04:58:14'),
(153, 192, '8Con-2025-000192', 'email', 'dem@gmail.com', 1, 0, '2025-06-27 04:58:14', '2025-06-27 04:58:14'),
(154, 193, '8Con-2025-000193', 'phone', '09905434390', 1, 0, '2025-06-27 04:59:04', '2025-06-27 04:59:04'),
(155, 193, '8Con-2025-000193', 'address', 'Megalodon, Marilao, Bulacan', 1, 0, '2025-06-27 04:59:04', '2025-06-27 04:59:04'),
(156, 193, '8Con-2025-000193', 'email', 'luci@gmail.com', 1, 0, '2025-06-27 04:59:04', '2025-06-27 04:59:04'),
(157, 194, '8Con-2025-000194', 'phone', '09562501033', 1, 0, '2025-06-27 05:01:37', '2025-06-27 05:01:37'),
(158, 194, '8Con-2025-000194', 'address', 'esteban north', 1, 0, '2025-06-27 05:01:37', '2025-06-27 05:01:37'),
(159, 194, '8Con-2025-000194', 'email', 'yeah@gmail.com', 1, 0, '2025-06-27 05:01:37', '2025-06-27 05:01:37'),
(160, 195, '8Con-2025-000195', 'phone', '09890097069', 1, 0, '2025-06-27 05:02:45', '2025-06-27 05:02:45'),
(161, 195, '8Con-2025-000195', 'address', 'Megalodon, Marilao, Bulacan', 1, 0, '2025-06-27 05:02:45', '2025-06-27 05:02:45'),
(162, 195, '8Con-2025-000195', 'email', 'cap@gmail.com', 1, 0, '2025-06-27 05:02:45', '2025-06-27 05:02:45'),
(163, 196, '8Con-2025-000196', 'phone', '09679097676', 1, 0, '2025-06-27 05:03:48', '2025-06-27 05:03:48'),
(164, 196, '8Con-2025-000196', 'address', 'esteban north', 1, 0, '2025-06-27 05:03:48', '2025-06-27 05:03:48'),
(165, 196, '8Con-2025-000196', 'email', 'it@gmail.com', 1, 0, '2025-06-27 05:03:48', '2025-06-27 05:03:48'),
(166, 197, '8Con-2025-000197', 'phone', '09982223454', 1, 0, '2025-06-27 05:05:42', '2025-06-27 05:05:42'),
(167, 197, '8Con-2025-000197', 'address', 'Marilao', 1, 0, '2025-06-27 05:05:42', '2025-06-27 05:05:42'),
(168, 197, '8Con-2025-000197', 'email', 'jj@gmail.com', 1, 0, '2025-06-27 05:05:42', '2025-06-27 05:05:42'),
(169, 198, '8Con-2025-000198', 'phone', '09677689807', 1, 0, '2025-06-27 05:06:36', '2025-06-27 05:06:36'),
(170, 198, '8Con-2025-000198', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-27 05:06:36', '2025-06-27 05:06:36'),
(171, 198, '8Con-2025-000198', 'email', 'bp@gmail.com', 1, 0, '2025-06-27 05:06:36', '2025-06-27 05:06:36'),
(172, 199, '8Con-2025-000199', 'phone', '09090099809', 1, 0, '2025-06-27 05:07:45', '2025-06-27 05:07:45'),
(173, 199, '8Con-2025-000199', 'address', 'Megalodon, Marilao, Bulacan', 1, 0, '2025-06-27 05:07:45', '2025-06-27 05:07:45'),
(174, 199, '8Con-2025-000199', 'email', 'sw@gmail.com', 1, 0, '2025-06-27 05:07:45', '2025-06-27 05:07:45'),
(175, 200, '8Con-2025-000200', 'phone', '09787687896', 1, 0, '2025-06-27 05:08:37', '2025-06-27 05:08:37'),
(176, 200, '8Con-2025-000200', 'address', '173 Zinya St., Sta. Rosa 2, Marilao, Bulacan', 1, 0, '2025-06-27 05:08:37', '2025-06-27 05:08:37'),
(177, 200, '8Con-2025-000200', 'email', 'qs@gmail.com', 1, 0, '2025-06-27 05:08:37', '2025-06-27 05:08:37'),
(178, 201, '8Con-2025-000201', 'phone', '09092343234', 1, 0, '2025-06-27 06:45:33', '2025-06-27 06:45:33'),
(179, 201, '8Con-2025-000201', 'address', 'esteban north', 1, 0, '2025-06-27 06:45:33', '2025-06-27 06:45:33'),
(180, 201, '8Con-2025-000201', 'email', 'hulk12@gmail.com', 1, 0, '2025-06-27 06:45:33', '2025-06-27 06:45:33'),
(181, 202, '8Con-2025-000202', 'phone', '09704918691', 1, 0, '2025-06-27 07:58:08', '2025-06-27 07:58:08'),
(182, 202, '8Con-2025-000202', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-27 07:58:08', '2025-06-27 07:58:08'),
(183, 202, '8Con-2025-000202', 'email', 'gonzalbertbpdm@gmail.com', 1, 0, '2025-06-27 07:58:08', '2025-06-27 07:58:08'),
(184, 203, '8Con-2025-000203', 'phone', '09092343234', 1, 0, '2025-06-27 09:43:48', '2025-06-27 09:43:48'),
(185, 203, '8Con-2025-000203', 'address', 'esteban north', 1, 0, '2025-06-27 09:43:48', '2025-06-27 09:43:48'),
(186, 203, '8Con-2025-000203', 'email', 'hulkakosssasds@gmail.com', 1, 0, '2025-06-27 09:43:48', '2025-06-27 09:43:48'),
(187, 204, 'S1751175200000_204', 'phone', '09092343234', 1, 0, '2025-06-29 05:33:20', '2025-06-29 05:33:20'),
(188, 204, 'S1751175200000_204', 'address', 'esteban north', 1, 0, '2025-06-29 05:33:20', '2025-06-29 05:33:20'),
(189, 204, 'S1751175200000_204', 'email', 'hulsds@gmail.com', 1, 0, '2025-06-29 05:33:20', '2025-06-29 05:33:20'),
(190, 205, 'S1751177922000_205', 'phone', '09092343234', 1, 0, '2025-06-29 06:18:42', '2025-06-29 06:18:42'),
(191, 205, 'S1751177922000_205', 'address', 'esteban north', 1, 0, '2025-06-29 06:18:42', '2025-06-29 06:18:42'),
(192, 205, 'S1751177922000_205', 'email', 'hus@gmail.com', 1, 0, '2025-06-29 06:18:42', '2025-06-29 06:18:42'),
(193, 206, 'S1751178065000_206', 'phone', '09704918693', 1, 0, '2025-06-29 06:21:05', '2025-06-29 06:21:05'),
(194, 206, 'S1751178065000_206', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-06-29 06:21:05', '2025-06-29 06:21:05'),
(195, 206, 'S1751178065000_206', 'email', 'manzano8con@gmail.com', 1, 0, '2025-06-29 06:21:05', '2025-06-29 06:21:05');

-- --------------------------------------------------------

--
-- Table structure for table `courses`
--

CREATE TABLE `courses` (
  `course_id` int(11) NOT NULL,
  `course_code` varchar(20) NOT NULL,
  `course_name` varchar(100) NOT NULL,
  `course_description` text DEFAULT NULL,
  `duration_weeks` int(11) DEFAULT 12,
  `credits` decimal(3,1) DEFAULT 3.0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `courses`
--

INSERT INTO `courses` (`course_id`, `course_code`, `course_name`, `course_description`, `duration_weeks`, `credits`, `is_active`, `created_at`, `updated_at`) VALUES
(3, 'BA001', 'Business Analytics', 'having to start a business', 12, 3.0, 1, '2025-06-23 05:55:01', '2025-06-24 06:24:54'),
(4, 'FTD01', 'Forex Trading Derivates', 'Trading is the key', 12, 3.0, 1, '2025-06-23 06:38:35', '2025-06-25 08:24:17'),
(8, 'FX101', 'Marketing', 'Marketing', 12, 3.0, 1, '2025-06-25 07:43:30', '2025-06-25 07:43:30');

-- --------------------------------------------------------

--
-- Table structure for table `course_competencies`
--

CREATE TABLE `course_competencies` (
  `course_id` int(11) NOT NULL,
  `competency_id` int(11) NOT NULL,
  `is_required` tinyint(1) DEFAULT 1,
  `order_sequence` int(11) DEFAULT NULL,
  `estimated_hours` decimal(5,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `course_competencies`
--

INSERT INTO `course_competencies` (`course_id`, `competency_id`, `is_required`, `order_sequence`, `estimated_hours`) VALUES
(3, 13, 1, 1, NULL),
(3, 14, 1, 2, 0.00),
(4, 15, 1, 1, 0.00),
(4, 16, 1, 2, 0.00),
(4, 17, 1, 3, 0.00);

-- --------------------------------------------------------

--
-- Table structure for table `course_eligibility_requirements`
--

CREATE TABLE `course_eligibility_requirements` (
  `course_id` int(11) NOT NULL,
  `criteria_id` int(11) NOT NULL,
  `minimum_score` decimal(5,2) DEFAULT NULL,
  `weight_override` decimal(5,2) DEFAULT NULL,
  `is_required` tinyint(1) DEFAULT 1,
  `exemption_conditions` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `course_offerings`
--

CREATE TABLE `course_offerings` (
  `offering_id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `batch_identifier` varchar(50) NOT NULL,
  `start_date` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `end_date` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `max_enrollees` int(11) DEFAULT 30,
  `current_enrollees` int(11) DEFAULT 0,
  `status` enum('planned','active','completed','cancelled') DEFAULT 'planned',
  `instructor_id` int(11) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `course_offerings`
--

INSERT INTO `course_offerings` (`offering_id`, `course_id`, `batch_identifier`, `start_date`, `end_date`, `max_enrollees`, `current_enrollees`, `status`, `instructor_id`, `location`, `created_at`, `updated_at`) VALUES
(2, 3, 'BA001-2025-01', '2025-06-27 08:46:28', '2025-09-15 05:55:01', 30, 30, 'active', NULL, 'Online', '2025-06-23 05:55:01', '2025-06-27 08:46:28'),
(3, 4, 'FTD01-2025-01', '2025-06-29 06:18:42', '2025-09-15 06:38:35', 30, 12, 'active', NULL, 'Online', '2025-06-23 06:38:35', '2025-06-29 06:18:42'),
(7, 8, 'FX101-2025-01', '2025-06-27 06:45:33', '2025-09-17 07:43:30', 30, 5, 'active', NULL, 'Online', '2025-06-25 07:43:30', '2025-06-27 06:45:33'),
(10, 3, 'BA001-2025-02', '2025-06-29 05:59:42', '2025-10-03 08:46:28', 30, 2, 'planned', NULL, 'Online', '2025-06-27 09:43:47', '2025-06-29 05:59:42'),
(11, 3, 'BA001-2025-03', '2025-06-29 06:21:05', '2025-10-04 09:20:43', 30, 2, 'active', NULL, 'Online', '2025-06-29 05:33:20', '2025-06-29 06:21:05');

-- --------------------------------------------------------

--
-- Table structure for table `course_pricing`
--

CREATE TABLE `course_pricing` (
  `pricing_id` int(11) NOT NULL,
  `offering_id` int(11) NOT NULL,
  `pricing_type` enum('regular','early_bird','group','scholarship','special') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'PHP',
  `effective_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `expiry_date` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `minimum_quantity` int(11) DEFAULT 1,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `course_pricing`
--

INSERT INTO `course_pricing` (`pricing_id`, `offering_id`, `pricing_type`, `amount`, `currency`, `effective_date`, `expiry_date`, `minimum_quantity`, `is_active`) VALUES
(24, 3, '', 65000.00, 'PHP', '2025-06-23 06:38:53', '2025-06-23 06:38:53', 1, 1),
(25, 2, '', 650000.00, 'PHP', '2025-06-24 06:24:54', '2025-06-24 06:24:54', 1, 1),
(29, 7, 'regular', 20000.00, 'PHP', '2025-06-25 07:43:30', '2025-06-25 07:43:30', 1, 1),
(30, 10, 'regular', 0.00, 'PHP', '2025-06-27 09:43:47', '0000-00-00 00:00:00', 1, 1),
(31, 11, 'regular', 0.00, 'PHP', '2025-06-29 05:33:20', '0000-00-00 00:00:00', 1, 1);

-- --------------------------------------------------------

--
-- Table structure for table `documents`
--

CREATE TABLE `documents` (
  `document_id` int(11) NOT NULL,
  `student_id` varchar(20) DEFAULT NULL,
  `document_type` enum('resume','form137') NOT NULL,
  `resume_submitted` tinyint(1) DEFAULT NULL,
  `form137_submitted` tinyint(1) DEFAULT NULL,
  `additional_notes` text DEFAULT NULL,
  `image_path` text DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `document_types`
--

CREATE TABLE `document_types` (
  `document_type_id` int(11) NOT NULL,
  `type_name` varchar(50) NOT NULL,
  `type_description` text DEFAULT NULL,
  `category` enum('academic','identification','financial','medical','legal','other') DEFAULT 'other',
  `is_required` tinyint(1) DEFAULT 0,
  `required_for` enum('enrollment','graduation','scholarship','employment','all') DEFAULT 'enrollment',
  `max_file_size_mb` int(11) DEFAULT 10,
  `allowed_formats` varchar(100) DEFAULT 'pdf,jpg,jpeg,png,doc,docx',
  `retention_period_years` int(11) DEFAULT 7,
  `requires_verification` tinyint(1) DEFAULT 1,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `document_types`
--

INSERT INTO `document_types` (`document_type_id`, `type_name`, `type_description`, `category`, `is_required`, `required_for`, `max_file_size_mb`, `allowed_formats`, `retention_period_years`, `requires_verification`, `is_active`, `created_at`) VALUES
(1, 'Resume', 'Professional resume or CV', 'academic', 1, 'enrollment', 10, 'pdf,jpg,jpeg,png,doc,docx', 7, 1, 1, '2025-06-12 01:17:29'),
(2, 'High School or College Diploma', 'Official academic transcript', 'academic', 1, 'enrollment', 10, 'pdf,jpg,jpeg,png,doc,docx', 7, 1, 1, '2025-06-12 01:17:29'),
(3, 'Valid ID', 'Government-issued identification', 'identification', 1, 'enrollment', 10, 'pdf,jpg,jpeg,png,doc,docx', 7, 1, 1, '2025-06-12 01:17:29'),
(4, 'Birth Certificate', 'Official birth certificate', 'legal', 0, 'enrollment', 10, 'pdf,jpg,jpeg,png,doc,docx', 7, 1, 1, '2025-06-12 01:17:29'),
(5, 'Income Certificate', 'Proof of income for scholarship', 'financial', 0, 'scholarship', 10, 'pdf,jpg,jpeg,png,doc,docx', 7, 1, 1, '2025-06-12 01:17:29');

-- --------------------------------------------------------

--
-- Table structure for table `draft`
--

CREATE TABLE `draft` (
  `student_id` varchar(20) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `age` int(11) DEFAULT NULL,
  `gender` varchar(10) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `birth_place` varchar(100) NOT NULL,
  `email` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `background` text DEFAULT NULL,
  `batch` varchar(255) NOT NULL,
  `rating` decimal(10,2) DEFAULT NULL,
  `goals` text DEFAULT NULL,
  `trading_level` enum('Beginner','Intermediate','Advanced') DEFAULT 'Beginner',
  `device_availability` varchar(20) DEFAULT NULL,
  `learning_style` enum('In-person','Online') DEFAULT NULL,
  `date_registered` date DEFAULT NULL,
  `account_id` int(11) DEFAULT NULL,
  `phone_no` varchar(15) DEFAULT NULL,
  `username` varchar(50) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `eligibility_criteria`
--

CREATE TABLE `eligibility_criteria` (
  `criteria_id` int(11) NOT NULL,
  `criteria_name` varchar(100) NOT NULL,
  `criteria_description` text DEFAULT NULL,
  `criteria_type` enum('academic','financial','document','attendance','behavioral','technical') NOT NULL,
  `measurement_type` enum('score','percentage','boolean','count','amount') DEFAULT 'score',
  `minimum_value` decimal(10,2) DEFAULT NULL,
  `maximum_value` decimal(10,2) DEFAULT NULL,
  `weight` decimal(5,2) DEFAULT 1.00,
  `is_mandatory` tinyint(1) DEFAULT 1,
  `applies_to` enum('enrollment','progression','graduation','scholarship','all') DEFAULT 'enrollment',
  `evaluation_method` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `eligibility_criteria`
--

INSERT INTO `eligibility_criteria` (`criteria_id`, `criteria_name`, `criteria_description`, `criteria_type`, `measurement_type`, `minimum_value`, `maximum_value`, `weight`, `is_mandatory`, `applies_to`, `evaluation_method`, `is_active`, `created_at`) VALUES
(1, 'Age Requirement', 'Minimum age for enrollment', 'academic', 'score', 18.00, NULL, 1.00, 1, 'enrollment', NULL, 1, '2025-06-12 01:17:29'),
(2, 'Educational Background', 'Minimum educational attainment', 'academic', 'score', 0.00, NULL, 1.00, 1, 'enrollment', NULL, 1, '2025-06-12 01:17:29'),
(3, 'Document Completion', 'All required documents submitted', 'document', 'score', 100.00, NULL, 1.00, 1, 'enrollment', NULL, 1, '2025-06-12 01:17:29'),
(4, 'Financial Clearance', 'No outstanding financial obligations', 'financial', 'score', 0.00, NULL, 1.00, 0, 'enrollment', NULL, 1, '2025-06-12 01:17:29'),
(5, 'Attendance Rate', 'Minimum attendance percentage', 'attendance', 'score', 80.00, NULL, 1.00, 1, 'enrollment', NULL, 1, '2025-06-12 01:17:29');

-- --------------------------------------------------------

--
-- Table structure for table `fee_types`
--

CREATE TABLE `fee_types` (
  `fee_type_id` int(11) NOT NULL,
  `fee_name` varchar(50) NOT NULL,
  `fee_description` text DEFAULT NULL,
  `fee_category` enum('tuition','graduation','certificate','materials','technology','administrative','penalty') NOT NULL,
  `default_amount` decimal(10,2) NOT NULL,
  `is_mandatory` tinyint(1) DEFAULT 0,
  `is_refundable` tinyint(1) DEFAULT 0,
  `applicable_to` enum('all','new_students','graduating_students','specific_courses') DEFAULT 'all',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `fee_types`
--

INSERT INTO `fee_types` (`fee_type_id`, `fee_name`, `fee_description`, `fee_category`, `default_amount`, `is_mandatory`, `is_refundable`, `applicable_to`, `is_active`, `created_at`) VALUES
(1, 'Graduation Fee', 'Fee for graduation ceremony and certificate', 'graduation', 2500.00, 1, 0, 'all', 1, '2025-06-12 01:17:29'),
(2, 'Certificate Fee', 'Additional certificate copies', 'certificate', 500.00, 0, 0, 'all', 1, '2025-06-12 01:17:29'),
(3, 'Materials Fee', 'Training materials and resources', 'materials', 1000.00, 1, 0, 'all', 1, '2025-06-12 01:17:29'),
(4, 'Technology Fee', 'Platform and software access', 'technology', 800.00, 1, 0, 'all', 1, '2025-06-12 01:17:29'),
(5, 'Late Payment Fee', 'Fee for overdue payments', 'penalty', 500.00, 0, 0, 'all', 1, '2025-06-23 08:56:27');

-- --------------------------------------------------------

--
-- Table structure for table `images`
--

CREATE TABLE `images` (
  `account_id` int(11) NOT NULL,
  `type` varchar(50) NOT NULL,
  `location` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `learning_preferences`
--

CREATE TABLE `learning_preferences` (
  `preference_id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `learning_style` enum('visual','auditory','kinesthetic','reading_writing','mixed') DEFAULT 'mixed',
  `delivery_preference` enum('in-person','online','hybrid','self-paced') DEFAULT 'hybrid',
  `device_type` varchar(50) DEFAULT NULL,
  `internet_speed` varchar(50) DEFAULT NULL,
  `preferred_schedule` enum('morning','afternoon','evening','weekend','flexible') DEFAULT 'flexible',
  `study_hours_per_week` int(11) DEFAULT NULL,
  `accessibility_needs` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `learning_preferences`
--

INSERT INTO `learning_preferences` (`preference_id`, `student_id`, `learning_style`, `delivery_preference`, `device_type`, `internet_speed`, `preferred_schedule`, `study_hours_per_week`, `accessibility_needs`, `created_at`, `updated_at`) VALUES
(27, '8Con-2025-000168', '', 'hybrid', 'Mobile Phone,Laptop', NULL, 'flexible', NULL, NULL, '2025-06-25 04:42:04', '2025-06-25 04:42:04'),
(28, '8Con-2025-000169', '', 'hybrid', 'Mobile Phone,Laptop', NULL, 'flexible', NULL, NULL, '2025-06-25 04:58:18', '2025-06-25 04:58:18'),
(29, '8Con-2025-000170', '', 'hybrid', 'Laptop,Mobile Phone', NULL, 'flexible', NULL, NULL, '2025-06-25 08:26:12', '2025-06-25 08:26:12'),
(30, '8Con-2025-000171', '', 'hybrid', 'Mobile Phone,Laptop', NULL, 'flexible', NULL, NULL, '2025-06-25 09:06:02', '2025-06-25 09:06:02'),
(31, '8Con-2025-000172', '', 'hybrid', 'Mobile Phone,Tablet', NULL, 'flexible', NULL, NULL, '2025-06-25 09:24:14', '2025-06-25 09:24:14'),
(32, '8Con-2025-000173', '', 'hybrid', 'Mobile Phone', NULL, 'flexible', NULL, NULL, '2025-06-25 09:34:47', '2025-06-25 09:34:47'),
(33, '8Con-2025-000174', '', 'hybrid', 'Mobile Phone,Tablet,Desktop', NULL, 'flexible', NULL, NULL, '2025-06-25 13:51:37', '2025-06-25 13:51:37'),
(34, '8Con-2025-000175', '', 'hybrid', 'Mobile Phone,Tablet', NULL, 'flexible', NULL, NULL, '2025-06-27 04:37:36', '2025-06-27 04:37:36'),
(35, '8Con-2025-000176', '', 'hybrid', 'Tablet', NULL, 'flexible', NULL, NULL, '2025-06-27 04:38:50', '2025-06-27 04:38:50'),
(36, '8Con-2025-000177', '', 'hybrid', 'Mobile Phone', NULL, 'flexible', NULL, NULL, '2025-06-27 04:39:38', '2025-06-27 04:39:38'),
(37, '8Con-2025-000178', '', 'hybrid', 'Tablet', NULL, 'flexible', NULL, NULL, '2025-06-27 04:41:23', '2025-06-27 04:41:23'),
(38, '8Con-2025-000179', '', 'hybrid', 'Tablet', NULL, 'flexible', NULL, NULL, '2025-06-27 04:42:47', '2025-06-27 04:42:47'),
(39, '8Con-2025-000180', '', 'hybrid', 'Tablet', NULL, 'flexible', NULL, NULL, '2025-06-27 04:43:54', '2025-06-27 04:43:54'),
(40, '8Con-2025-000181', '', 'hybrid', 'Mobile Phone', NULL, 'flexible', NULL, NULL, '2025-06-27 04:44:51', '2025-06-27 04:44:51'),
(41, '8Con-2025-000182', '', 'hybrid', 'Tablet', NULL, 'flexible', NULL, NULL, '2025-06-27 04:46:11', '2025-06-27 04:46:11'),
(42, '8Con-2025-000183', '', 'hybrid', 'Laptop', NULL, 'flexible', NULL, NULL, '2025-06-27 04:48:01', '2025-06-27 04:48:01'),
(43, '8Con-2025-000184', '', 'hybrid', 'Laptop', NULL, 'flexible', NULL, NULL, '2025-06-27 04:49:10', '2025-06-27 04:49:10'),
(44, '8Con-2025-000185', '', 'hybrid', 'Mobile Phone,Desktop', NULL, 'flexible', NULL, NULL, '2025-06-27 04:50:15', '2025-06-27 04:50:15'),
(45, '8Con-2025-000186', '', 'hybrid', 'Tablet', NULL, 'flexible', NULL, NULL, '2025-06-27 04:51:35', '2025-06-27 04:51:35'),
(48, '8Con-2025-000189', '', 'hybrid', 'Laptop', NULL, 'flexible', NULL, NULL, '2025-06-27 04:54:59', '2025-06-27 04:54:59'),
(49, '8Con-2025-000190', '', 'hybrid', 'Laptop', NULL, 'flexible', NULL, NULL, '2025-06-27 04:56:05', '2025-06-27 04:56:05'),
(50, '8Con-2025-000191', '', 'hybrid', 'Laptop', NULL, 'flexible', NULL, NULL, '2025-06-27 04:57:19', '2025-06-27 04:57:19'),
(54, '8Con-2025-000195', '', 'hybrid', 'Laptop', NULL, 'flexible', NULL, NULL, '2025-06-27 05:02:45', '2025-06-27 05:02:45'),
(56, '8Con-2025-000197', '', 'hybrid', 'Mobile Phone', NULL, 'flexible', NULL, NULL, '2025-06-27 05:05:42', '2025-06-27 05:05:42'),
(57, '8Con-2025-000198', '', 'hybrid', 'Tablet', NULL, 'flexible', NULL, NULL, '2025-06-27 05:06:36', '2025-06-27 05:06:36'),
(58, '8Con-2025-000199', '', 'hybrid', 'Tablet,Laptop', NULL, 'flexible', NULL, NULL, '2025-06-27 05:07:45', '2025-06-27 05:07:45'),
(59, '8Con-2025-000200', '', 'hybrid', 'Laptop', NULL, 'flexible', NULL, NULL, '2025-06-27 05:08:37', '2025-06-27 05:08:37'),
(62, '8Con-2025-000203', '', 'hybrid', 'Laptop', NULL, 'flexible', NULL, NULL, '2025-06-27 09:43:48', '2025-06-27 09:43:48'),
(65, 'S1751178065000_206', '', 'hybrid', 'Laptop,Desktop', NULL, 'flexible', NULL, NULL, '2025-06-29 06:21:05', '2025-06-29 06:21:05');

-- --------------------------------------------------------

--
-- Table structure for table `password_resets`
--

CREATE TABLE `password_resets` (
  `id` int(11) NOT NULL,
  `email` varchar(100) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `is_used` tinyint(1) DEFAULT 0,
  `used_at` datetime DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `token_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `reset_token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_used` tinyint(1) DEFAULT 0,
  `used_at` timestamp NULL DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `payment_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `method_id` int(11) NOT NULL,
  `payment_amount` decimal(10,2) NOT NULL,
  `processing_fee` decimal(10,2) DEFAULT 0.00,
  `net_amount` decimal(10,2) GENERATED ALWAYS AS (`payment_amount` - `processing_fee`) VIRTUAL,
  `reference_number` varchar(50) DEFAULT NULL,
  `external_transaction_id` varchar(100) DEFAULT NULL,
  `payment_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `due_date` date DEFAULT NULL,
  `payment_status` enum('pending','confirmed','failed','refunded','cancelled') DEFAULT 'pending',
  `receipt_path` varchar(255) DEFAULT NULL,
  `receipt_number` varchar(50) DEFAULT NULL,
  `processed_by` int(11) DEFAULT NULL,
  `verified_by` int(11) DEFAULT NULL,
  `verification_date` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `refund_amount` decimal(10,2) DEFAULT 0.00,
  `refund_reason` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payments`
--

INSERT INTO `payments` (`payment_id`, `account_id`, `method_id`, `payment_amount`, `processing_fee`, `reference_number`, `external_transaction_id`, `payment_date`, `due_date`, `payment_status`, `receipt_path`, `receipt_number`, `processed_by`, `verified_by`, `verification_date`, `refund_amount`, `refund_reason`, `notes`, `created_at`, `updated_at`) VALUES
(3, 26, 2, 10000.00, 0.00, NULL, NULL, '2025-06-26 03:42:19', NULL, 'failed', 'uploads/documents/receipt-1750909339836-149854685-aldub.jpg', NULL, NULL, NULL, '0000-00-00 00:00:00', 0.00, NULL, 'Expired payment deadline: mahal', '2025-06-26 03:42:19', '2025-06-26 10:43:37'),
(4, 19, 1, 10000.00, 0.00, NULL, NULL, '2025-06-26 03:59:26', NULL, 'failed', 'uploads/documents/receipt-1750910366382-880931729-aldub.jpg', NULL, NULL, NULL, '0000-00-00 00:00:00', 0.00, NULL, 'Duplicate payment: ', '2025-06-26 03:59:26', '2025-06-26 10:17:51'),
(5, 26, 3, 5000.00, 100.00, NULL, NULL, '2025-06-26 04:02:28', NULL, 'confirmed', 'uploads/documents/receipt-1750910548364-625314275-aldub.jpg', NULL, NULL, NULL, '0000-00-00 00:00:00', 0.00, NULL, NULL, '2025-06-26 04:02:28', '2025-06-26 10:06:02'),
(6, 19, 3, 1000.00, 20.00, NULL, NULL, '2025-06-26 04:08:13', NULL, 'confirmed', 'uploads/documents/receipt-1750910893295-925822219-aldub.jpg', NULL, NULL, NULL, '0000-00-00 00:00:00', 0.00, NULL, NULL, '2025-06-26 04:08:13', '2025-06-26 04:08:29'),
(7, 19, 2, 100.00, 0.00, NULL, NULL, '2025-06-26 04:11:17', NULL, 'confirmed', 'uploads/documents/receipt-1750911077617-626265040-aldub.jpg', NULL, NULL, NULL, '0000-00-00 00:00:00', 0.00, NULL, NULL, '2025-06-26 04:11:17', '2025-06-26 10:05:50'),
(8, 26, 1, 100.00, 0.00, NULL, NULL, '2025-06-26 04:51:33', NULL, 'confirmed', 'uploads/documents/receipt-1750913493758-841556591-aldub.jpg', NULL, NULL, NULL, '0000-00-00 00:00:00', 0.00, NULL, NULL, '2025-06-26 04:51:33', '2025-06-26 10:05:39'),
(9, 22, 1, 2000.00, 0.00, NULL, NULL, '2025-06-26 10:51:19', NULL, 'failed', 'uploads/documents/receipt-1750935079380-314594996-vector-play-button-icon-design-illustration.jpg', NULL, NULL, NULL, '0000-00-00 00:00:00', 0.00, NULL, 'Duplicate payment: ', '2025-06-26 10:51:19', '2025-06-26 10:52:17'),
(10, 21, 1, 1000.00, 0.00, NULL, NULL, '2025-06-26 10:51:54', NULL, 'confirmed', 'uploads/documents/receipt-1750935114122-690798520-pdm.png', NULL, NULL, NULL, '0000-00-00 00:00:00', 0.00, NULL, NULL, '2025-06-26 10:51:54', '2025-06-26 10:52:00'),
(11, 29, 1, 10000.00, 0.00, NULL, NULL, '2025-06-27 10:31:34', NULL, 'pending', 'uploads/documents/receipt-1751020294792-739327709-IMG_7233.png', NULL, NULL, NULL, '0000-00-00 00:00:00', 0.00, NULL, NULL, '2025-06-27 10:31:34', '2025-06-27 10:31:34'),
(12, 58, 1, 3400.00, 0.00, NULL, NULL, '2025-06-29 06:28:32', NULL, 'pending', 'uploads/documents/receipt-1751178512385-624595542-aldub.jpg', NULL, NULL, NULL, '0000-00-00 00:00:00', 0.00, NULL, NULL, '2025-06-29 06:28:32', '2025-06-29 06:28:32'),
(13, 30, 1, 1000.00, 0.00, NULL, NULL, '2025-06-29 07:02:24', NULL, 'pending', 'uploads/documents/receipt-1751180544310-849035058-vector-play-button-icon-design-illustration.jpg', NULL, NULL, NULL, '0000-00-00 00:00:00', 0.00, NULL, NULL, '2025-06-29 07:02:24', '2025-06-29 07:02:24');

--
-- Triggers `payments`
--
DELIMITER $$
CREATE TRIGGER `payments_audit_insert` AFTER INSERT ON `payments` FOR EACH ROW BEGIN
    INSERT INTO audit_log (table_name, operation_type, primary_key_value, new_values, changed_by)
    VALUES ('payments', 'INSERT', NEW.payment_id, JSON_OBJECT(
        'payment_id', NEW.payment_id,
        'account_id', NEW.account_id,
        'payment_amount', NEW.payment_amount,
        'payment_status', NEW.payment_status
    ), NEW.processed_by);
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `payment_methods`
--

CREATE TABLE `payment_methods` (
  `method_id` int(11) NOT NULL,
  `method_name` varchar(50) NOT NULL,
  `method_description` text DEFAULT NULL,
  `method_type` enum('cash','bank_transfer','credit_card','debit_card','digital_wallet','cryptocurrency') NOT NULL,
  `processing_fee_percentage` decimal(5,2) DEFAULT 0.00,
  `processing_fee_fixed` decimal(10,2) DEFAULT 0.00,
  `minimum_amount` decimal(10,2) DEFAULT 0.00,
  `maximum_amount` decimal(10,2) DEFAULT NULL,
  `processing_time_hours` int(11) DEFAULT 24,
  `requires_verification` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payment_methods`
--

INSERT INTO `payment_methods` (`method_id`, `method_name`, `method_description`, `method_type`, `processing_fee_percentage`, `processing_fee_fixed`, `minimum_amount`, `maximum_amount`, `processing_time_hours`, `requires_verification`, `is_active`) VALUES
(1, 'Cash', 'Cash payment at office', 'cash', 0.00, 0.00, 0.00, NULL, 24, 0, 1),
(2, 'Bank Transfer', 'Direct bank transfer', 'bank_transfer', 0.00, 0.00, 0.00, NULL, 24, 0, 1),
(3, 'GCash', 'GCash mobile payment', 'digital_wallet', 2.00, 0.00, 0.00, NULL, 24, 0, 1),
(4, 'PayMaya', 'PayMaya digital payment', 'digital_wallet', 2.50, 0.00, 0.00, NULL, 24, 0, 1),
(5, 'Credit Card', 'Credit card payment', 'credit_card', 3.50, 0.00, 0.00, NULL, 24, 0, 1);

-- --------------------------------------------------------

--
-- Table structure for table `payment_schemes`
--

CREATE TABLE `payment_schemes` (
  `scheme_id` int(11) NOT NULL,
  `scheme_name` varchar(50) NOT NULL,
  `scheme_description` text DEFAULT NULL,
  `installment_count` int(11) DEFAULT 1,
  `discount_percentage` decimal(5,2) DEFAULT 0.00,
  `processing_fee` decimal(10,2) DEFAULT 0.00,
  `late_fee_percentage` decimal(5,2) DEFAULT 5.00,
  `grace_period_days` int(11) DEFAULT 7,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payment_schemes`
--

INSERT INTO `payment_schemes` (`scheme_id`, `scheme_name`, `scheme_description`, `installment_count`, `discount_percentage`, `processing_fee`, `late_fee_percentage`, `grace_period_days`, `is_active`, `created_at`) VALUES
(1, 'Full Payment', 'Pay full amount upfront with discount', 1, 10.00, 0.00, 5.00, 7, 1, '2025-06-12 01:17:29'),
(2, '4 Gives', 'Pay in 4 equal installments', 4, 0.00, 0.00, 5.00, 7, 1, '2025-06-12 01:17:29'),
(3, 'Special Payment', 'Customized payment arrangement', 1, 5.00, 0.00, 5.00, 7, 1, '2025-06-12 01:17:29'),
(4, '6 Gives', 'Pay in 6 equal installments', 6, 0.00, 100.00, 5.00, 7, 1, '2025-06-23 08:56:27'),
(5, 'Early Bird Special', 'Full payment with maximum discount', 1, 15.00, 0.00, 5.00, 14, 1, '2025-06-23 08:56:27');

-- --------------------------------------------------------

--
-- Table structure for table `persons`
--

CREATE TABLE `persons` (
  `person_id` int(11) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `middle_name` varchar(50) DEFAULT NULL,
  `last_name` varchar(50) NOT NULL,
  `birth_date` date NOT NULL,
  `birth_place` varchar(100) NOT NULL,
  `gender` enum('Male','Female') NOT NULL,
  `email` varchar(100) NOT NULL,
  `education` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `persons`
--

INSERT INTO `persons` (`person_id`, `first_name`, `middle_name`, `last_name`, `birth_date`, `birth_place`, `gender`, `email`, `education`, `created_at`, `updated_at`) VALUES
(40, 'System', NULL, 'Administrator', '0000-00-00', 'System', '', 'admin@gmail.com', 'System Administrator', '2025-06-18 09:52:24', '2025-06-18 09:52:24'),
(160, 'Jomari', 'albert', 'Encepto', '2002-04-23', 'Meycauayan, Bulacan', 'Male', 'gonzagaalbertpdm@gmail.com', 'College', '2025-06-23 09:34:01', '2025-06-23 09:34:01'),
(161, 'Jhames Andrew', 'Reynoso', 'Macabata', '2002-06-25', 'Meycauayan, Bulacan', 'Male', 'macabatajhamesandrew8con@gmail.com', 'College', '2025-06-23 10:12:53', '2025-06-23 10:12:53'),
(162, 'Alberto', 'Borromeo', 'Gonzaga', '2003-05-20', 'Meycauayan, Bulacan', 'Male', 'gonzagaalbertb8con@gmail.com', 'College', '2025-06-23 10:24:35', '2025-06-23 10:24:35'),
(163, 'CJ', 'Borromeo', 'Kanino', '2000-03-12', 'Meycauayan, Bulacan', 'Male', 'cj123@gmail.com', 'College', '2025-06-23 10:25:52', '2025-06-23 10:25:52'),
(164, 'CJ', 'Borromeo', 'Kanino', '2000-03-12', 'Meycauayan, Bulacan', 'Male', 'cj1233@gmail.com', 'College', '2025-06-23 10:27:54', '2025-06-23 10:27:54'),
(165, 'CJs', 'Borromeos', 'Kaninos', '2000-03-12', 'Meycauayan, Bulacan', 'Female', 'cj1233s@gmail.com', 'College', '2025-06-23 10:35:13', '2025-06-23 10:35:13'),
(166, 'Albert', 'Borromeo', 'Gonzaga', '2005-12-05', 'marilao', 'Male', 'gonzagaalbertbpdm@gmail.com', 'College', '2025-06-24 08:40:15', '2025-06-24 08:40:15'),
(168, 'Joshua', 'Pinal', 'Manzano', '2003-08-30', 'marilao', 'Male', 'manzanojoshuaphilip8con@gmail.com', 'College', '2025-06-25 04:42:04', '2025-06-25 04:42:04'),
(169, 'Student', 'Student', 'Ako', '2004-08-20', 'marilao', 'Male', 'albertgonzaga8con@gmail.com', 'College', '2025-06-25 04:58:18', '2025-06-25 04:58:18'),
(170, 'Jomari', 'Pinal', 'Encepto', '2003-08-23', 'marilao', 'Male', 'marksaa@gmail.com', 'College', '2025-06-25 08:26:12', '2025-06-25 08:26:12'),
(171, 'John Mathew', 'Pinal', 'Emnacen', '2003-04-20', 'marilao', 'Male', 'emnacenjohnmathew8con@gmail.com', 'College', '2025-06-25 09:06:02', '2025-06-25 09:06:02'),
(172, 'Albert', 'Borromeo', 'Gonzaga', '2005-12-05', 'marilao', 'Male', 'gonzagaalbertbpdm@gmail.com', 'College', '2025-06-25 09:24:14', '2025-06-25 09:24:14'),
(173, 'Albert', 'Borromeo', 'Gonzaga', '2005-12-05', 'marilao', 'Male', 'gonzagaalbertbpdm@gmail.com', 'College', '2025-06-25 09:34:47', '2025-06-25 09:34:47'),
(174, 'John Mathew', 'Pinal', 'Emnacen', '2002-08-02', 'marilao', 'Male', 'emnacenjohnmathewcon@gmail.com', 'College', '2025-06-25 13:51:36', '2025-06-25 13:51:36'),
(175, 'Paolo', 'Esp', 'Moreno', '2004-04-23', 'Meycauayan, Bulacan', 'Male', 'aaa@gmail.com', 'College', '2025-06-27 04:37:36', '2025-06-27 04:37:36'),
(176, 'Grace', 'esp', 'Maguate', '2004-05-06', 'Meycauayan, Bulacan', 'Male', 'bbb@gmail.com', 'College', '2025-06-27 04:38:50', '2025-06-27 04:38:50'),
(177, 'cj', 'e', 'Napoles', '2009-04-23', 'Caloocan', 'Male', 'crajeextremeyt@gmail.com', 'College', '2025-06-27 04:39:38', '2025-06-27 04:39:38'),
(178, 'Zj', 'dd', 'Manzano', '2008-04-23', 'Masbate', 'Female', 'manzanojoshuaphilip@gmail.com', 'College', '2025-06-27 04:41:23', '2025-06-27 04:41:23'),
(179, 'Jhames', 'f', 'Ryouki', '2005-04-05', 'Valenzuela', 'Male', 'ryouki@gmail.com', 'College', '2025-06-27 04:42:47', '2025-06-27 04:42:47'),
(180, 'Andrew', 'E', 'Sevilla', '2004-05-04', 'Masbate', 'Male', 'sevilla@gmail.com', 'None', '2025-06-27 04:43:54', '2025-06-27 04:43:54'),
(181, 'Jerome', 'w', 'Venus', '2007-05-06', 'Meycauayan, Bulacan', 'Male', 'venus@gmail.com', 'College', '2025-06-27 04:44:51', '2025-06-27 04:44:51'),
(182, 'Louis', 'Ri', 'Benedicto', '2008-02-12', 'Valenzuela', 'Female', 'bene@gmail.com', 'College', '2025-06-27 04:46:11', '2025-06-27 04:46:11'),
(183, 'Ray', 'sy', 'Reyes', '2009-04-03', 'Meycauayan, Bulacan', 'Female', 'ray@gmail.com', 'None', '2025-06-27 04:48:01', '2025-06-27 04:48:01'),
(184, 'Shinju', 'Karamatsu', 'Katen', '2009-03-23', 'Valenzuela', 'Female', 'katen@gmail.com', 'College', '2025-06-27 04:49:10', '2025-06-27 04:49:10'),
(185, 'Arata', 'Ty', 'Sena', '2009-05-31', 'Masbate', 'Male', 'sena@gmail.com', 'College', '2025-06-27 04:50:15', '2025-06-27 04:50:15'),
(186, 'Jane', 'Reynoso', 'Frost', '2003-05-03', 'Valenzuela', 'Female', 'frost@gmail.com', 'College', '2025-06-27 04:51:35', '2025-06-27 04:51:35'),
(187, 'Barry', 'Fl', 'Allen', '2003-04-23', 'Valenzuela', 'Male', 'flash@gmail.com', 'College', '2025-06-27 04:52:57', '2025-06-27 04:52:57'),
(188, 'Cisco', 'De', 'Francisco', '2007-05-31', 'marilao', 'Male', 'vibe@gmail.com', 'College', '2025-06-27 04:53:49', '2025-06-27 04:53:49'),
(189, 'Ame', 'No', 'Habakiri', '2004-03-12', 'Caloocan', 'Female', 'ame@gmail.com', 'College', '2025-06-27 04:54:59', '2025-06-27 04:54:59'),
(190, 'Caitlin', 'Frost', 'Snow', '2009-05-04', 'Valenzuela', 'Female', 'killer@gmail.com', 'None', '2025-06-27 04:56:05', '2025-06-27 04:56:05'),
(191, 'Hunter', 'Zoom', 'Solomon', '2001-02-25', 'Caloocan', 'Male', 'zoom@gmail.com', 'None', '2025-06-27 04:57:19', '2025-06-27 04:57:19'),
(192, 'Dean', 'De', 'Winchester', '2001-05-10', 'Valenzuela', 'Male', 'dem@gmail.com', 'None', '2025-06-27 04:58:14', '2025-06-27 04:58:14'),
(193, 'Sam', 'De', 'Winchester', '2008-05-04', 'Valenzuela', 'Male', 'luci@gmail.com', 'College', '2025-06-27 04:59:04', '2025-06-27 04:59:04'),
(194, 'Tony', 'Se', 'Stark', '2009-03-23', 'Caloocan', 'Male', 'yeah@gmail.com', 'None', '2025-06-27 05:01:37', '2025-06-27 05:01:37'),
(195, 'Steve', 'Cap', 'Rogers', '2009-03-31', 'Masbate', 'Male', 'cap@gmail.com', 'College', '2025-06-27 05:02:45', '2025-06-27 05:02:45'),
(196, 'Penny', 'Sa', 'Wise', '2001-07-05', 'Valenzuela', 'Female', 'it@gmail.com', 'College', '2025-06-27 05:03:48', '2025-06-27 05:03:48'),
(197, 'Jay', 'Ji', 'Jay', '2005-05-29', 'Masbate', 'Male', 'jj@gmail.com', 'College', '2025-06-27 05:05:42', '2025-06-27 05:05:42'),
(198, 'Chadwick', 'Chala', 'Boseman', '2002-07-04', 'Masbate', 'Male', 'bp@gmail.com', 'College', '2025-06-27 05:06:36', '2025-06-27 05:06:36'),
(199, 'Wanda', 'Sw', 'Maximoff', '2009-04-23', 'marilao', 'Female', 'sw@gmail.com', 'College', '2025-06-27 05:07:45', '2025-06-27 05:07:45'),
(200, 'Pyetro', 'Reynoso', 'Maximoff', '2001-03-12', 'Masbate', 'Male', 'qs@gmail.com', 'None', '2025-06-27 05:08:37', '2025-06-27 05:08:37'),
(201, 'Bruce', 'Hulk', 'Banner', '2003-04-23', 'manila', 'Male', 'hulk12@gmail.com', 'College', '2025-06-27 06:45:33', '2025-06-27 06:45:33'),
(202, 'Alberta', 'Borromeoa', 'Gonzagaa', '2000-01-01', 'lias', 'Male', 'gonzalbertbpdm@gmail.com', 'College', '2025-06-27 07:58:08', '2025-06-27 07:58:08'),
(203, 'Brucsax', 'Hulksax', 'Bannersax', '2000-01-01', 'marilao', 'Female', 'hulkakosssasds@gmail.com', 'College', '2025-06-27 09:43:48', '2025-06-27 09:43:48'),
(204, 'Brucsax', 'Hulksax', 'Bannersax', '2000-04-20', 'marilao', 'Male', 'hulsds@gmail.com', 'College', '2025-06-29 05:33:20', '2025-06-29 05:33:20'),
(205, 'Brucsw', 'Hulksax', 'Ba', '2000-04-20', 'marilao', 'Female', 'hus@gmail.com', 'College', '2025-06-29 06:18:42', '2025-06-29 06:18:42'),
(206, 'Joshua', 'Pinal', 'Manzano', '2000-04-20', 'marilao', 'Female', 'manzano8con@gmail.com', 'College', '2025-06-29 06:21:05', '2025-06-29 06:21:05');

--
-- Triggers `persons`
--
DELIMITER $$
CREATE TRIGGER `sync_person_account_id` BEFORE INSERT ON `persons` FOR EACH ROW BEGIN
    -- Get the account_id from the current session or context
    -- This assumes the account is created first, then person
    DECLARE v_account_id INT;
    
    -- Get the latest account_id (this works if account is created immediately before person)
    SELECT MAX(account_id) INTO v_account_id FROM accounts;
    
    -- Set person_id to match account_id
    SET NEW.person_id = v_account_id;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_birth_date_check` BEFORE INSERT ON `persons` FOR EACH ROW BEGIN
  IF NEW.birth_date > CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Birth date cannot be in the future';
  END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_birth_date_update_check` BEFORE UPDATE ON `persons` FOR EACH ROW BEGIN
  IF NEW.birth_date > CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Birth date cannot be in the future';
  END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `positions`
--

CREATE TABLE `positions` (
  `position_id` int(11) NOT NULL,
  `position_title` varchar(100) NOT NULL,
  `position_description` text DEFAULT NULL,
  `department` varchar(50) DEFAULT NULL,
  `salary_range_min` decimal(10,2) DEFAULT NULL,
  `salary_range_max` decimal(10,2) DEFAULT NULL,
  `required_qualifications` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `profiles`
--

CREATE TABLE `profiles` (
  `id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `student_id` varchar(20) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `roles` enum('student','admin','instructor','moderator') DEFAULT 'student',
  `address` text DEFAULT NULL,
  `birth_place` varchar(100) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `phone_no` varchar(20) DEFAULT NULL,
  `trading_level` enum('beginner','intermediate','advanced','expert') DEFAULT 'beginner',
  `learning_style` enum('visual','auditory','kinesthetic','reading') DEFAULT NULL,
  `gender` enum('male','female','other','prefer_not_to_say') DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `preferences` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`preferences`)),
  `authenticated` tinyint(1) DEFAULT 0,
  `login_time` datetime DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  `verification_token` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `profiles`
--

INSERT INTO `profiles` (`id`, `account_id`, `student_id`, `name`, `username`, `email`, `roles`, `address`, `birth_place`, `birth_date`, `phone_no`, `trading_level`, `learning_style`, `gender`, `avatar`, `bio`, `preferences`, `authenticated`, `login_time`, `last_login`, `is_verified`, `verification_token`, `created_at`, `updated_at`) VALUES
(1, 1, '1', 'Chalex Napoles', 'test', 'crajeextremeyt@gmail.com', 'student', 'Valenzuela', 'Valenzuela', '2025-06-09', '09427184388', 'beginner', NULL, 'male', '/uploads/avatars/1749025966246-343866882.png', NULL, NULL, 1, '2025-06-02 08:31:08', '2025-06-06 17:15:43', 0, NULL, '2025-06-04 08:31:08', '2025-06-06 09:15:43');

--
-- Triggers `profiles`
--
DELIMITER $$
CREATE TRIGGER `log_profile_updates` AFTER UPDATE ON `profiles` FOR EACH ROW BEGIN
    INSERT INTO `activity_logs` (`account_id`, `action`, `description`, `created_at`)
    VALUES (NEW.account_id, 'profile_updated', 'User profile was updated', NOW());
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `referrals`
--

CREATE TABLE `referrals` (
  `referral_id` int(11) NOT NULL,
  `student_id` varchar(20) DEFAULT NULL,
  `referred_by` varchar(50) DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `ib_code` varchar(20) DEFAULT NULL,
  `referral_type` enum('Individual','Facebook','Workshop','Ad') DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `referral_sources`
--

CREATE TABLE `referral_sources` (
  `source_id` int(11) NOT NULL,
  `source_name` varchar(50) NOT NULL,
  `source_description` text DEFAULT NULL,
  `source_type` enum('individual','social_media','advertising','partnership','event','organic') NOT NULL,
  `tracking_required` tinyint(1) DEFAULT 0,
  `commission_rate` decimal(5,2) DEFAULT 0.00,
  `commission_type` enum('percentage','fixed','tiered') DEFAULT 'percentage',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `referral_sources`
--

INSERT INTO `referral_sources` (`source_id`, `source_name`, `source_description`, `source_type`, `tracking_required`, `commission_rate`, `commission_type`, `is_active`, `created_at`) VALUES
(1, 'Facebook', 'Facebook social media referrals', 'social_media', 0, 5.00, 'percentage', 1, '2025-06-12 01:17:29'),
(2, 'Individual Referral', 'Personal referrals from existing students', 'individual', 0, 10.00, 'percentage', 1, '2025-06-12 01:17:29'),
(3, 'Workshop', 'Referrals from workshop attendees', 'event', 0, 0.00, 'percentage', 1, '2025-06-12 01:17:29'),
(4, 'Google Ads', 'Google advertising campaigns', 'advertising', 0, 0.00, 'percentage', 1, '2025-06-12 01:17:29'),
(5, 'Organic Search', 'Direct website visitors', 'organic', 0, 0.00, 'percentage', 1, '2025-06-12 01:17:29');

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `role_id` int(11) NOT NULL,
  `role_name` varchar(50) NOT NULL,
  `role_description` text DEFAULT NULL,
  `permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`permissions`)),
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`role_id`, `role_name`, `role_description`, `permissions`, `is_active`, `created_at`) VALUES
(1, 'admin', 'System Administrator', '{\"all\": true}', 1, '2025-06-12 01:17:28'),
(2, 'staff', 'Staff Member', '{\"students\": \"read_write\", \"courses\": \"read\", \"payments\": \"read_write\"}', 1, '2025-06-12 01:17:28'),
(3, 'student', 'Student', '{\"profile\": \"read_write\", \"courses\": \"read\", \"progress\": \"read\"}', 1, '2025-06-12 01:17:28'),
(4, 'instructor', 'Course Instructor', '{\"students\": \"read\", \"courses\": \"read_write\", \"progress\": \"read_write\"}', 1, '2025-06-12 01:17:28'),
(5, 'mentor', 'Student Mentor', '{\"students\": \"read\", \"progress\": \"read_write\", \"courses\": \"read\"}', 1, '2025-06-23 08:56:27');

-- --------------------------------------------------------

--
-- Table structure for table `scholarships`
--

CREATE TABLE `scholarships` (
  `scholarship_id` int(11) NOT NULL,
  `student_id` varchar(20) DEFAULT NULL,
  `sponsor_type` enum('Individual','Corporate','Coop','OJT') DEFAULT NULL,
  `sponsor_name` varchar(50) DEFAULT NULL,
  `sponsor_contact` varchar(11) DEFAULT NULL,
  `approved_by` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sponsors`
--

CREATE TABLE `sponsors` (
  `sponsor_id` int(11) NOT NULL,
  `sponsor_type_id` int(11) NOT NULL,
  `sponsor_name` varchar(100) NOT NULL,
  `sponsor_code` varchar(20) DEFAULT NULL,
  `contact_person` varchar(100) DEFAULT NULL,
  `contact_email` varchar(100) DEFAULT NULL,
  `contact_phone` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `industry` varchar(100) DEFAULT NULL,
  `company_size` enum('startup','small','medium','large','enterprise') DEFAULT NULL,
  `agreement_details` text DEFAULT NULL,
  `agreement_start_date` date DEFAULT NULL,
  `agreement_end_date` date DEFAULT NULL,
  `total_commitment` decimal(15,2) DEFAULT NULL,
  `current_commitment` decimal(15,2) DEFAULT 0.00,
  `students_sponsored` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sponsor_types`
--

CREATE TABLE `sponsor_types` (
  `sponsor_type_id` int(11) NOT NULL,
  `type_name` varchar(50) NOT NULL,
  `type_description` text DEFAULT NULL,
  `default_coverage_percentage` decimal(5,2) DEFAULT 100.00,
  `max_students_per_sponsor` int(11) DEFAULT NULL,
  `requires_agreement` tinyint(1) DEFAULT 1,
  `reporting_frequency` enum('monthly','quarterly','annually','upon_completion') DEFAULT 'quarterly',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sponsor_types`
--

INSERT INTO `sponsor_types` (`sponsor_type_id`, `type_name`, `type_description`, `default_coverage_percentage`, `max_students_per_sponsor`, `requires_agreement`, `reporting_frequency`, `is_active`, `created_at`) VALUES
(1, 'Individual', 'Individual person sponsoring a student', 100.00, NULL, 1, 'quarterly', 1, '2025-06-12 01:17:29'),
(2, 'Corporate', 'Company or corporation sponsorship', 100.00, NULL, 1, 'quarterly', 1, '2025-06-12 01:17:29'),
(3, 'Cooperative', 'Cooperative organization sponsorship', 50.00, NULL, 1, 'quarterly', 1, '2025-06-12 01:17:29'),
(4, 'OJT Program', 'On-the-job training sponsorship', 75.00, NULL, 1, 'quarterly', 1, '2025-06-12 01:17:29'),
(5, 'Government Agency', 'Government-sponsored scholarships', 100.00, 50, 1, 'quarterly', 1, '2025-06-23 08:56:27');

-- --------------------------------------------------------

--
-- Table structure for table `staff`
--

CREATE TABLE `staff` (
  `staff_id` int(11) NOT NULL,
  `person_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `employee_id` varchar(20) DEFAULT NULL,
  `hire_date` date DEFAULT curdate(),
  `termination_date` date DEFAULT NULL,
  `employment_status` enum('active','inactive','terminated','on_leave') DEFAULT 'active',
  `emergency_contact` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staffs`
--

CREATE TABLE `staffs` (
  `staff_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `position` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staff_positions`
--

CREATE TABLE `staff_positions` (
  `staff_id` int(11) NOT NULL,
  `position_id` int(11) NOT NULL,
  `start_date` date NOT NULL DEFAULT curdate(),
  `end_date` date DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT 0,
  `salary` decimal(10,2) DEFAULT NULL,
  `appointment_type` enum('permanent','temporary','contract','probationary') DEFAULT 'permanent'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `students`
--

CREATE TABLE `students` (
  `student_id` varchar(20) NOT NULL,
  `person_id` int(11) NOT NULL,
  `account_id` int(11) DEFAULT NULL,
  `registration_date` date DEFAULT curdate(),
  `graduation_status` enum('enrolled','graduated','dropped','suspended','transferred') DEFAULT 'enrolled',
  `graduation_date` date DEFAULT NULL,
  `gpa` decimal(3,2) DEFAULT NULL,
  `academic_standing` enum('good','probation','suspension') DEFAULT 'good',
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `students`
--

INSERT INTO `students` (`student_id`, `person_id`, `account_id`, `registration_date`, `graduation_status`, `graduation_date`, `gpa`, `academic_standing`, `notes`) VALUES
('8Con-2025-000168', 168, 168, '2025-06-25', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000169', 169, 169, '2025-06-25', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000170', 170, 170, '2025-06-25', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000171', 171, 171, '2025-06-25', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000172', 172, 172, '2025-06-25', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000173', 173, 173, '2025-06-25', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000174', 174, 174, '2025-06-25', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000175', 175, 175, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000176', 176, 176, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000177', 177, 177, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000178', 178, 178, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000179', 179, 179, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000180', 180, 180, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000181', 181, 181, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000182', 182, 182, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000183', 183, 183, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000184', 184, 184, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000185', 185, 185, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000186', 186, 186, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000189', 189, 189, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000190', 190, 190, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000191', 191, 191, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000195', 195, 195, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000197', 197, 197, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000198', 198, 198, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000199', 199, 199, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000200', 200, 200, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000203', 203, 203, '2025-06-27', 'enrolled', NULL, NULL, 'good', NULL),
('S1751178065000_206', 206, 206, '2025-06-29', 'enrolled', NULL, NULL, 'good', NULL);

--
-- Triggers `students`
--
DELIMITER $$
CREATE TRIGGER `students_audit_insert` AFTER INSERT ON `students` FOR EACH ROW BEGIN
    INSERT INTO audit_log (table_name, operation_type, primary_key_value, new_values, changed_by)
    VALUES ('students', 'INSERT', NEW.student_id, JSON_OBJECT(
        'student_id', NEW.student_id,
        'person_id', NEW.person_id,
        'account_id', NEW.account_id,
        'graduation_status', NEW.graduation_status
    ), NEW.account_id);
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `students_audit_update` AFTER UPDATE ON `students` FOR EACH ROW BEGIN
    INSERT INTO audit_log (table_name, operation_type, primary_key_value, old_values, new_values, changed_by)
    VALUES ('students', 'UPDATE', NEW.student_id, 
        JSON_OBJECT(
            'graduation_status', OLD.graduation_status,
            'gpa', OLD.gpa,
            'academic_standing', OLD.academic_standing
        ),
        JSON_OBJECT(
            'graduation_status', NEW.graduation_status,
            'gpa', NEW.gpa,
            'academic_standing', NEW.academic_standing
        ), 
        NEW.account_id);
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `student_accounts`
--

CREATE TABLE `student_accounts` (
  `account_id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `offering_id` int(11) NOT NULL,
  `total_due` decimal(10,2) NOT NULL,
  `amount_paid` decimal(10,2) DEFAULT 0.00,
  `balance` decimal(10,2) GENERATED ALWAYS AS (`total_due` - `amount_paid`) VIRTUAL,
  `scheme_id` int(11) DEFAULT NULL,
  `account_status` enum('active','paid','overdue','cancelled','suspended') DEFAULT 'active',
  `due_date` date DEFAULT NULL,
  `last_payment_date` date DEFAULT NULL,
  `payment_reminder_count` int(11) DEFAULT 0,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `student_accounts`
--

INSERT INTO `student_accounts` (`account_id`, `student_id`, `offering_id`, `total_due`, `amount_paid`, `scheme_id`, `account_status`, `due_date`, `last_payment_date`, `payment_reminder_count`, `notes`, `created_at`, `updated_at`) VALUES
(19, '8Con-2025-000168', 2, 0.00, 1100.00, NULL, 'active', NULL, '2025-06-26', 0, NULL, '2025-06-25 04:42:04', '2025-06-26 04:11:17'),
(20, '8Con-2025-000169', 3, 0.00, 0.00, NULL, 'paid', NULL, NULL, 0, NULL, '2025-06-25 04:58:18', '2025-06-25 04:58:18'),
(21, '8Con-2025-000170', 3, 0.00, 1000.00, NULL, 'paid', NULL, '2025-06-26', 0, NULL, '2025-06-25 08:26:12', '2025-06-26 10:51:54'),
(22, '8Con-2025-000171', 7, 0.00, 2000.00, NULL, 'paid', NULL, '2025-06-26', 0, NULL, '2025-06-25 09:06:02', '2025-06-26 10:51:19'),
(23, '8Con-2025-000172', 7, 0.00, 0.00, NULL, 'paid', NULL, NULL, 0, NULL, '2025-06-25 09:24:14', '2025-06-25 09:24:14'),
(24, '8Con-2025-000173', 3, 0.00, 0.00, NULL, 'paid', NULL, NULL, 0, NULL, '2025-06-25 09:34:47', '2025-06-25 09:34:47'),
(25, '8Con-2025-000174', 3, 65000.00, 0.00, NULL, '', '2025-07-25', '2025-06-26', 0, NULL, '2025-06-25 13:51:37', '2025-06-26 04:01:07'),
(26, '8Con-2025-000168', 7, 20000.00, 5200.00, NULL, 'active', '2025-07-26', '2025-06-26', 0, NULL, '2025-06-26 03:29:18', '2025-06-26 10:06:02'),
(27, '8Con-2025-000170', 2, 0.00, 0.00, NULL, 'active', '2025-07-26', NULL, 0, NULL, '2025-06-26 06:32:56', '2025-06-26 06:32:56'),
(28, '8Con-2025-000169', 7, 20000.00, 0.00, NULL, 'active', '2025-07-27', NULL, 0, NULL, '2025-06-27 04:32:15', '2025-06-27 04:32:15'),
(29, '8Con-2025-000175', 3, 65000.00, 10000.00, NULL, '', '2025-07-27', '2025-06-27', 0, NULL, '2025-06-27 04:37:36', '2025-06-27 10:31:34'),
(30, '8Con-2025-000176', 2, 650000.00, 1000.00, NULL, '', '2025-07-27', '2025-06-29', 0, NULL, '2025-06-27 04:38:50', '2025-06-29 07:02:24'),
(31, '8Con-2025-000177', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 04:39:38', '2025-06-27 04:39:38'),
(32, '8Con-2025-000178', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 04:41:23', '2025-06-27 04:41:23'),
(33, '8Con-2025-000179', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 04:42:47', '2025-06-27 04:42:47'),
(34, '8Con-2025-000180', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 04:43:54', '2025-06-27 04:43:54'),
(35, '8Con-2025-000181', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 04:44:51', '2025-06-27 04:44:51'),
(36, '8Con-2025-000182', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 04:46:11', '2025-06-27 04:46:11'),
(37, '8Con-2025-000183', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 04:48:01', '2025-06-27 04:48:01'),
(38, '8Con-2025-000184', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 04:49:10', '2025-06-27 04:49:10'),
(39, '8Con-2025-000185', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 04:50:15', '2025-06-27 04:50:15'),
(40, '8Con-2025-000186', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 04:51:35', '2025-06-27 04:51:35'),
(43, '8Con-2025-000189', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 04:54:59', '2025-06-27 04:54:59'),
(44, '8Con-2025-000190', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 04:56:05', '2025-06-27 04:56:05'),
(45, '8Con-2025-000191', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 04:57:19', '2025-06-27 04:57:19'),
(49, '8Con-2025-000195', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 05:02:45', '2025-06-27 05:02:45'),
(51, '8Con-2025-000197', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 05:05:42', '2025-06-27 05:05:42'),
(52, '8Con-2025-000198', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 05:06:36', '2025-06-27 05:06:36'),
(53, '8Con-2025-000199', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 05:07:45', '2025-06-27 05:07:45'),
(54, '8Con-2025-000200', 2, 650000.00, 0.00, NULL, '', '2025-07-27', NULL, 0, NULL, '2025-06-27 05:08:37', '2025-06-27 05:08:37'),
(57, '8Con-2025-000203', 10, 650000.00, 0.00, NULL, 'active', NULL, NULL, 0, NULL, '2025-06-27 09:43:48', '2025-06-27 09:43:48'),
(58, '8Con-2025-000175', 10, 0.00, 3400.00, NULL, 'active', '2025-07-28', '2025-06-29', 0, NULL, '2025-06-28 09:20:43', '2025-06-29 06:28:32'),
(61, 'S1751178065000_206', 11, 0.00, 0.00, NULL, 'paid', NULL, NULL, 0, NULL, '2025-06-29 06:21:05', '2025-06-29 06:21:05');

-- --------------------------------------------------------

--
-- Table structure for table `student_backgrounds`
--

CREATE TABLE `student_backgrounds` (
  `background_id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `education_level` enum('elementary','high_school','vocational','college','graduate','post_graduate') DEFAULT NULL,
  `highest_degree` varchar(100) DEFAULT NULL,
  `institution` varchar(100) DEFAULT NULL,
  `graduation_year` year(4) DEFAULT NULL,
  `work_experience_years` int(11) DEFAULT 0,
  `current_occupation` varchar(100) DEFAULT NULL,
  `industry` varchar(100) DEFAULT NULL,
  `annual_income_range` enum('below_100k','100k_300k','300k_500k','500k_1m','above_1m') DEFAULT NULL,
  `financial_experience` text DEFAULT NULL,
  `prior_trading_experience` text DEFAULT NULL,
  `investment_portfolio_value` decimal(15,2) DEFAULT NULL,
  `relevant_skills` text DEFAULT NULL,
  `certifications` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `student_documents`
--

CREATE TABLE `student_documents` (
  `document_id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `document_type_id` int(11) NOT NULL,
  `document_version` int(11) DEFAULT 1,
  `original_filename` varchar(255) NOT NULL,
  `stored_filename` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size_bytes` bigint(20) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `file_hash` varchar(64) DEFAULT NULL,
  `upload_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `uploaded_by` int(11) DEFAULT NULL,
  `verification_status` enum('pending','verified','rejected','requires_update','expired') DEFAULT 'pending',
  `verified_by` int(11) DEFAULT NULL,
  `verified_date` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `expiry_date` date DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `verification_notes` text DEFAULT NULL,
  `is_current` tinyint(1) DEFAULT 1,
  `is_archived` tinyint(1) DEFAULT 0,
  `archived_date` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `student_documents`
--

INSERT INTO `student_documents` (`document_id`, `student_id`, `document_type_id`, `document_version`, `original_filename`, `stored_filename`, `file_path`, `file_size_bytes`, `mime_type`, `file_hash`, `upload_date`, `uploaded_by`, `verification_status`, `verified_by`, `verified_date`, `expiry_date`, `rejection_reason`, `verification_notes`, `is_current`, `is_archived`, `archived_date`) VALUES
(3, '8Con-2025-000172', 1, 1, 'Picture1.png', 'document-1750922364945-106829516-Picture1.png', 'uploads\\documents\\document-1750922364945-106829516-Picture1.png', 50779, 'image/png', 'c4c11faaae55726f0e0b5f9effae11544aa844a6e0de620866e5444706cbc989', '2025-06-26 07:19:25', NULL, 'verified', NULL, '2025-06-26 07:19:25', NULL, NULL, NULL, 1, 0, '0000-00-00 00:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `student_eligibility_assessments`
--

CREATE TABLE `student_eligibility_assessments` (
  `assessment_id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `criteria_id` int(11) NOT NULL,
  `assessment_score` decimal(10,2) DEFAULT NULL,
  `assessment_value` varchar(255) DEFAULT NULL,
  `assessment_status` enum('not_assessed','meets_criteria','does_not_meet','pending_review','exempted') DEFAULT 'not_assessed',
  `assessed_by` int(11) DEFAULT NULL,
  `assessment_date` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `assessment_method` enum('automatic','manual','document_review','interview','exam') DEFAULT 'manual',
  `evidence_provided` text DEFAULT NULL,
  `assessment_notes` text DEFAULT NULL,
  `review_required` tinyint(1) DEFAULT 0,
  `reviewed_by` int(11) DEFAULT NULL,
  `review_date` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `valid_until` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `student_enrollments`
--

CREATE TABLE `student_enrollments` (
  `enrollment_id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `offering_id` int(11) NOT NULL,
  `enrollment_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `enrollment_status` enum('enrolled','completed','dropped','transferred','suspended') DEFAULT 'enrolled',
  `completion_date` timestamp NULL DEFAULT NULL,
  `final_grade` decimal(5,2) DEFAULT NULL,
  `completion_percentage` decimal(5,2) DEFAULT 0.00,
  `attendance_percentage` decimal(5,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `student_enrollments`
--

INSERT INTO `student_enrollments` (`enrollment_id`, `student_id`, `offering_id`, `enrollment_date`, `enrollment_status`, `completion_date`, `final_grade`, `completion_percentage`, `attendance_percentage`) VALUES
(6, '8Con-2025-000168', 2, '2025-06-25 04:42:04', 'enrolled', '2025-06-25 04:42:04', NULL, NULL, NULL),
(7, '8Con-2025-000169', 3, '2025-06-25 04:58:18', 'enrolled', '2025-06-25 04:58:18', NULL, NULL, NULL),
(20, '8Con-2025-000170', 3, '2025-06-25 08:26:12', 'enrolled', '2025-06-25 08:26:12', NULL, NULL, NULL),
(26, '8Con-2025-000171', 7, '2025-06-25 09:06:02', 'enrolled', '2025-06-25 09:06:02', NULL, NULL, NULL),
(27, '8Con-2025-000172', 7, '2025-06-25 09:24:14', 'enrolled', '2025-06-25 09:24:14', NULL, NULL, NULL),
(28, '8Con-2025-000173', 3, '2025-06-25 09:34:47', 'enrolled', '2025-06-25 09:34:47', NULL, NULL, NULL),
(29, '8Con-2025-000174', 3, '2025-06-25 13:51:37', 'enrolled', '2025-06-25 13:51:37', NULL, NULL, NULL),
(33, '8Con-2025-000168', 7, '2025-06-26 03:29:18', 'enrolled', NULL, NULL, 0.00, NULL),
(34, '8Con-2025-000170', 2, '2025-06-26 06:32:56', 'enrolled', NULL, NULL, 0.00, NULL),
(35, '8Con-2025-000169', 7, '2025-06-27 04:32:15', 'enrolled', NULL, NULL, 0.00, NULL),
(36, '8Con-2025-000175', 3, '2025-06-27 04:37:36', 'enrolled', NULL, NULL, NULL, NULL),
(37, '8Con-2025-000176', 2, '2025-06-27 04:38:50', 'enrolled', NULL, NULL, NULL, NULL),
(38, '8Con-2025-000177', 2, '2025-06-27 04:39:38', 'enrolled', NULL, NULL, NULL, NULL),
(39, '8Con-2025-000178', 2, '2025-06-27 04:41:23', 'enrolled', NULL, NULL, NULL, NULL),
(40, '8Con-2025-000179', 2, '2025-06-27 04:42:47', 'enrolled', NULL, NULL, NULL, NULL),
(41, '8Con-2025-000180', 2, '2025-06-27 04:43:54', 'enrolled', NULL, NULL, NULL, NULL),
(42, '8Con-2025-000181', 2, '2025-06-27 04:44:51', 'enrolled', NULL, NULL, NULL, NULL),
(43, '8Con-2025-000182', 2, '2025-06-27 04:46:11', 'enrolled', NULL, NULL, NULL, NULL),
(44, '8Con-2025-000183', 2, '2025-06-27 04:48:01', 'enrolled', NULL, NULL, NULL, NULL),
(45, '8Con-2025-000184', 2, '2025-06-27 04:49:10', 'enrolled', NULL, NULL, NULL, NULL),
(46, '8Con-2025-000185', 2, '2025-06-27 04:50:15', 'enrolled', NULL, NULL, NULL, NULL),
(47, '8Con-2025-000186', 2, '2025-06-27 04:51:35', 'enrolled', NULL, NULL, NULL, NULL),
(50, '8Con-2025-000189', 2, '2025-06-27 04:54:59', 'enrolled', NULL, NULL, NULL, NULL),
(51, '8Con-2025-000190', 2, '2025-06-27 04:56:05', 'enrolled', NULL, NULL, NULL, NULL),
(52, '8Con-2025-000191', 2, '2025-06-27 04:57:19', 'enrolled', NULL, NULL, NULL, NULL),
(56, '8Con-2025-000195', 2, '2025-06-27 05:02:45', 'enrolled', NULL, NULL, NULL, NULL),
(58, '8Con-2025-000197', 2, '2025-06-27 05:05:42', 'enrolled', NULL, NULL, NULL, NULL),
(59, '8Con-2025-000198', 2, '2025-06-27 05:06:36', 'enrolled', NULL, NULL, NULL, NULL),
(60, '8Con-2025-000199', 2, '2025-06-27 05:07:45', 'enrolled', NULL, NULL, NULL, NULL),
(61, '8Con-2025-000200', 2, '2025-06-27 05:08:37', 'enrolled', NULL, NULL, NULL, NULL),
(64, '8Con-2025-000203', 10, '2025-06-27 09:43:48', 'enrolled', '2025-10-03 08:46:28', NULL, 0.00, NULL),
(65, '8Con-2025-000175', 10, '2025-06-28 09:20:43', 'enrolled', NULL, NULL, 0.00, NULL),
(68, 'S1751178065000_206', 11, '2025-06-29 06:21:05', 'enrolled', '2025-09-21 05:33:20', NULL, 0.00, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `student_fees`
--

CREATE TABLE `student_fees` (
  `student_fee_id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `fee_type_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `due_date` date DEFAULT NULL,
  `paid_date` date DEFAULT NULL,
  `payment_id` int(11) DEFAULT NULL,
  `status` enum('pending','paid','waived','overdue','cancelled') DEFAULT 'pending',
  `waiver_reason` text DEFAULT NULL,
  `waived_by` int(11) DEFAULT NULL,
  `waiver_date` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `student_goals`
--

CREATE TABLE `student_goals` (
  `goal_id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `goal_type` enum('career','financial','personal','academic','skill') NOT NULL,
  `goal_title` varchar(100) NOT NULL,
  `goal_description` text NOT NULL,
  `target_date` date DEFAULT NULL,
  `target_amount` decimal(15,2) DEFAULT NULL,
  `priority_level` enum('low','medium','high','critical') DEFAULT 'medium',
  `status` enum('active','achieved','paused','cancelled','expired') DEFAULT 'active',
  `progress_percentage` decimal(5,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `student_progress`
--

CREATE TABLE `student_progress` (
  `progress_id` int(11) NOT NULL,
  `enrollment_id` int(11) NOT NULL,
  `competency_id` int(11) NOT NULL,
  `attempt_number` int(11) DEFAULT 1,
  `score` decimal(5,2) DEFAULT NULL,
  `max_score` decimal(5,2) DEFAULT 100.00,
  `percentage_score` decimal(5,2) GENERATED ALWAYS AS (case when `max_score` > 0 then `score` / `max_score` * 100 else 0 end) STORED,
  `passed` tinyint(1) DEFAULT NULL,
  `attempt_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `assessed_by` int(11) DEFAULT NULL,
  `feedback` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `student_referrals`
--

CREATE TABLE `student_referrals` (
  `referral_id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `source_id` int(11) NOT NULL,
  `referrer_name` varchar(100) DEFAULT NULL,
  `referrer_contact` varchar(100) DEFAULT NULL,
  `referrer_student_id` varchar(20) DEFAULT NULL,
  `ib_code` varchar(20) DEFAULT NULL,
  `campaign_code` varchar(50) DEFAULT NULL,
  `referral_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `referral_reward` decimal(10,2) DEFAULT 0.00,
  `reward_type` enum('cash','discount','credit','gift') DEFAULT 'cash',
  `reward_paid` tinyint(1) DEFAULT 0,
  `reward_payment_date` date DEFAULT NULL,
  `conversion_date` date DEFAULT NULL,
  `lifetime_value` decimal(10,2) DEFAULT NULL,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `student_scholarships`
--

CREATE TABLE `student_scholarships` (
  `scholarship_id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `sponsor_id` int(11) NOT NULL,
  `scholarship_type` enum('full','partial','merit','need_based','performance') DEFAULT 'partial',
  `coverage_percentage` decimal(5,2) NOT NULL,
  `coverage_amount` decimal(10,2) DEFAULT NULL,
  `max_coverage_amount` decimal(10,2) DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approval_date` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `scholarship_status` enum('pending','approved','active','completed','terminated','suspended') DEFAULT 'pending',
  `gpa_requirement` decimal(3,2) DEFAULT NULL,
  `attendance_requirement` decimal(5,2) DEFAULT NULL,
  `community_service_hours` int(11) DEFAULT NULL,
  `terms_conditions` text DEFAULT NULL,
  `performance_review_date` date DEFAULT NULL,
  `renewal_eligible` tinyint(1) DEFAULT 0,
  `termination_reason` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `student_trading_levels`
--

CREATE TABLE `student_trading_levels` (
  `student_id` varchar(20) NOT NULL,
  `level_id` int(11) NOT NULL,
  `assigned_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `assigned_by` int(11) DEFAULT NULL,
  `assessment_score` decimal(5,2) DEFAULT NULL,
  `assessment_method` enum('exam','practical','portfolio','interview') DEFAULT 'exam',
  `is_current` tinyint(1) DEFAULT 1,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `student_trading_levels`
--

INSERT INTO `student_trading_levels` (`student_id`, `level_id`, `assigned_date`, `assigned_by`, `assessment_score`, `assessment_method`, `is_current`, `notes`) VALUES
('8Con-2025-000168', 1, '2025-06-25 04:42:04', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000169', 1, '2025-06-25 04:58:18', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000170', 1, '2025-06-25 08:26:12', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000171', 1, '2025-06-25 09:06:02', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000172', 2, '2025-06-25 09:24:14', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000173', 2, '2025-06-25 09:34:47', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000174', 1, '2025-06-25 13:51:37', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000175', 2, '2025-06-27 04:37:36', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000176', 1, '2025-06-27 04:38:50', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000177', 2, '2025-06-27 04:39:38', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000178', 2, '2025-06-27 04:41:23', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000179', 3, '2025-06-27 04:42:47', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000180', 2, '2025-06-27 04:43:54', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000181', 3, '2025-06-27 04:44:51', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000182', 2, '2025-06-27 04:46:11', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000183', 2, '2025-06-27 04:48:01', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000184', 1, '2025-06-27 04:49:10', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000185', 3, '2025-06-27 04:50:15', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000186', 3, '2025-06-27 04:51:35', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000189', 3, '2025-06-27 04:54:59', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000190', 4, '2025-06-27 04:56:05', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000191', 3, '2025-06-27 04:57:19', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000195', 2, '2025-06-27 05:02:45', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000197', 2, '2025-06-27 05:05:42', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000198', 1, '2025-06-27 05:06:36', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000199', 2, '2025-06-27 05:07:45', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000200', 4, '2025-06-27 05:08:37', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000203', 1, '2025-06-27 09:43:48', NULL, NULL, 'exam', 1, NULL),
('S1751178065000_206', 1, '2025-06-29 06:21:05', NULL, NULL, 'exam', 1, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `system_configuration`
--

CREATE TABLE `system_configuration` (
  `config_id` int(11) NOT NULL,
  `config_key` varchar(100) NOT NULL,
  `config_value` text DEFAULT NULL,
  `config_type` enum('string','integer','decimal','boolean','json') DEFAULT 'string',
  `description` text DEFAULT NULL,
  `is_sensitive` tinyint(1) DEFAULT 0,
  `category` varchar(50) DEFAULT 'general',
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `system_configuration`
--

INSERT INTO `system_configuration` (`config_id`, `config_key`, `config_value`, `config_type`, `description`, `is_sensitive`, `category`, `updated_by`, `updated_at`) VALUES
(1, 'system_name', 'Trading Academy Management System', 'string', 'Name of the system', 0, 'general', NULL, '2025-06-12 01:17:29'),
(2, 'max_enrollment_per_batch', '30', 'integer', 'Maximum students per course offering', 0, 'academic', NULL, '2025-06-12 01:17:29'),
(3, 'default_passing_score', '70.00', 'decimal', 'Default passing score percentage', 0, 'academic', NULL, '2025-06-12 01:17:29'),
(4, 'grace_period_days', '7', 'integer', 'Payment grace period in days', 0, 'financial', NULL, '2025-06-12 01:17:29'),
(5, 'max_login_attempts', '5', 'integer', 'Maximum failed login attempts before lockout', 0, 'security', NULL, '2025-06-12 01:17:29'),
(6, 'session_timeout_minutes', '120', 'integer', 'User session timeout in minutes', 0, 'security', NULL, '2025-06-12 01:17:29');

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `setting_type` enum('string','number','boolean','json') DEFAULT 'string',
  `description` text DEFAULT NULL,
  `is_public` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `system_settings`
--

INSERT INTO `system_settings` (`id`, `setting_key`, `setting_value`, `setting_type`, `description`, `is_public`, `created_at`, `updated_at`) VALUES
(1, 'app_name', '8Con Trading Platform', 'string', 'Application name', 1, '2025-06-04 08:22:08', '2025-06-04 08:22:08'),
(2, 'session_timeout', '86400', 'number', 'Session timeout in seconds (24 hours)', 0, '2025-06-04 08:22:08', '2025-06-04 08:22:08'),
(3, 'max_login_attempts', '5', 'number', 'Maximum login attempts before lockout', 0, '2025-06-04 08:22:08', '2025-06-04 08:22:08'),
(4, 'password_reset_timeout', '3600', 'number', 'Password reset token timeout in seconds (1 hour)', 0, '2025-06-04 08:22:08', '2025-06-04 08:22:08'),
(5, 'registration_enabled', '1', 'boolean', 'Whether new user registration is enabled', 1, '2025-06-04 08:22:08', '2025-06-04 08:22:08'),
(6, 'maintenance_mode', '0', 'boolean', 'Whether the application is in maintenance mode', 1, '2025-06-04 08:22:08', '2025-06-04 08:22:08');

-- --------------------------------------------------------

--
-- Table structure for table `trading_levels`
--

CREATE TABLE `trading_levels` (
  `level_id` int(11) NOT NULL,
  `level_name` varchar(50) NOT NULL,
  `level_description` text DEFAULT NULL,
  `minimum_score` decimal(5,2) DEFAULT 0.00,
  `prerequisite_level_id` int(11) DEFAULT NULL,
  `estimated_duration_weeks` int(11) DEFAULT NULL,
  `recommended_capital` decimal(15,2) DEFAULT NULL,
  `risk_tolerance` enum('low','medium','high') DEFAULT 'medium'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `trading_levels`
--

INSERT INTO `trading_levels` (`level_id`, `level_name`, `level_description`, `minimum_score`, `prerequisite_level_id`, `estimated_duration_weeks`, `recommended_capital`, `risk_tolerance`) VALUES
(1, 'No Experience ', 'New to trading', 0.00, NULL, 8, 10000.00, 'medium'),
(2, 'Beginner', 'Has basic knowledge, developing strategies', 70.00, 1, 12, 20000.00, 'medium'),
(3, 'Intermediate', 'Has an experienced in trading', 85.00, 2, 16, 80000.00, 'medium'),
(4, 'Advanced', 'Experienced trader with proven track record', 100.00, 3, 100, 100000.00, 'medium');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `account_id` int(11) DEFAULT NULL,
  `student_id` varchar(20) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `roles` enum('student','admin','instructor','moderator') DEFAULT 'student',
  `address` text DEFAULT NULL,
  `birth_place` varchar(100) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `phone_no` varchar(20) DEFAULT NULL,
  `trading_level` enum('beginner','intermediate','advanced','expert') DEFAULT 'beginner',
  `gender` enum('male','female','other','prefer_not_to_say') DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `authenticated` tinyint(1) DEFAULT 0,
  `login_time` datetime DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `account_id`, `student_id`, `name`, `username`, `email`, `password`, `roles`, `address`, `birth_place`, `birth_date`, `phone_no`, `trading_level`, `gender`, `avatar`, `authenticated`, `login_time`, `last_login`, `created_at`, `updated_at`) VALUES
(1, 1, '1', 'Chalex Napoles', 'test', 'crajeextremeyt@gmail.com', NULL, 'student', 'Valenzuela', 'Valenzuela', '2025-06-09', '09427184388', 'beginner', 'male', '/uploads/avatars/1749025966246-343866882.png', 1, '2025-06-04 16:31:22', NULL, '2025-06-04 08:31:22', '2025-06-06 09:15:36');

-- --------------------------------------------------------

--
-- Table structure for table `user_sessions`
--

CREATE TABLE `user_sessions` (
  `id` int(11) NOT NULL,
  `session_id` varchar(128) NOT NULL,
  `account_id` int(11) NOT NULL,
  `user_email` varchar(100) NOT NULL,
  `user_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`user_data`)),
  `is_active` tinyint(1) DEFAULT 1,
  `expires_at` datetime NOT NULL,
  `user_agent` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `device_info` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`device_info`)),
  `last_activity` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_sessions`
--

INSERT INTO `user_sessions` (`id`, `session_id`, `account_id`, `user_email`, `user_data`, `is_active`, `expires_at`, `user_agent`, `ip_address`, `device_info`, `last_activity`, `created_at`, `updated_at`) VALUES
(21, 'Cfo4o04cPo0CgnKRc-BHZCd5UVig1WFQ', 1, 'crajeextremeyt@gmail.com', '{\"account_id\":1,\"student_id\":\"1\",\"name\":\"Chalex Napoles\",\"username\":\"test\",\"email\":\"crajeextremeyt@gmail.com\",\"roles\":\"student\",\"address\":\"Valenzuela\",\"birth_place\":\"Valenzuela\",\"phone_no\":\"09427184388\",\"trading_level\":\"Beginner\",\"gender\":\"male\",\"birth_date\":\"2025-06-17T16:00:00.000Z\",\"authenticated\":true,\"loginTime\":\"2025-06-06T09:15:42.996Z\"}', 1, '2025-06-07 17:15:42', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 OPR/119.0.0.0', '::1', NULL, '2025-06-06 09:15:43', '2025-06-06 09:15:43', '2025-06-06 09:15:43');

--
-- Triggers `user_sessions`
--
DELIMITER $$
CREATE TRIGGER `update_last_login_on_session` AFTER INSERT ON `user_sessions` FOR EACH ROW BEGIN
    UPDATE `profiles` 
    SET `last_login` = NOW(), `updated_at` = NOW()
    WHERE `account_id` = NEW.account_id;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Stand-in structure for view `user_statistics`
-- (See below for the actual view)
--
CREATE TABLE `user_statistics` (
`total_users` bigint(21)
,`active_users` bigint(21)
,`students` bigint(21)
,`admins` bigint(21)
,`instructors` bigint(21)
,`new_users_30d` bigint(21)
,`active_24h` bigint(21)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_competency_progress`
-- (See below for the actual view)
--
CREATE TABLE `v_competency_progress` (
`student_id` varchar(20)
,`student_name` varchar(101)
,`course_name` varchar(100)
,`batch_identifier` varchar(50)
,`competency_name` varchar(100)
,`competency_type` varchar(50)
,`score` decimal(5,2)
,`max_score` decimal(5,2)
,`percentage_score` decimal(5,2)
,`passed` tinyint(1)
,`attempt_number` int(11)
,`attempt_date` timestamp
,`assessed_by_name` varchar(101)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_course_offering_details`
-- (See below for the actual view)
--
CREATE TABLE `v_course_offering_details` (
`offering_id` int(11)
,`course_code` varchar(20)
,`course_name` varchar(100)
,`batch_identifier` varchar(50)
,`start_date` timestamp
,`end_date` timestamp
,`status` enum('planned','active','completed','cancelled')
,`max_enrollees` int(11)
,`current_enrollees` int(11)
,`available_slots` bigint(12)
,`enrollment_percentage` decimal(16,2)
,`actual_enrollments` bigint(21)
,`average_price` decimal(14,6)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_document_verification_status`
-- (See below for the actual view)
--
CREATE TABLE `v_document_verification_status` (
`student_id` varchar(20)
,`student_name` varchar(101)
,`document_type` varchar(50)
,`is_required` tinyint(1)
,`document_id` int(11)
,`verification_status` enum('pending','verified','rejected','requires_update','expired')
,`upload_date` timestamp
,`verified_date` timestamp
,`verified_by_name` varchar(101)
,`overall_status` varchar(16)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_scholarship_summary`
-- (See below for the actual view)
--
CREATE TABLE `v_scholarship_summary` (
`student_id` varchar(20)
,`student_name` varchar(101)
,`sponsor_name` varchar(100)
,`sponsor_type` varchar(50)
,`scholarship_type` enum('full','partial','merit','need_based','performance')
,`coverage_percentage` decimal(5,2)
,`coverage_amount` decimal(10,2)
,`scholarship_status` enum('pending','approved','active','completed','terminated','suspended')
,`start_date` date
,`end_date` date
,`approved_by_name` varchar(101)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_student_financial_summary`
-- (See below for the actual view)
--
CREATE TABLE `v_student_financial_summary` (
`student_id` varchar(20)
,`student_name` varchar(101)
,`total_accounts` bigint(21)
,`total_amount_due` decimal(32,2)
,`total_amount_paid` decimal(32,2)
,`total_balance` decimal(32,2)
,`confirmed_payments` bigint(21)
,`total_confirmed_payments` decimal(32,2)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_student_summary`
-- (See below for the actual view)
--
CREATE TABLE `v_student_summary` (
`student_id` varchar(20)
,`full_name` varchar(152)
,`graduation_status` enum('enrolled','graduated','dropped','suspended','transferred')
,`gpa` decimal(3,2)
,`academic_standing` enum('good','probation','suspension')
,`current_trading_level` varchar(50)
,`total_enrollments` bigint(21)
,`completed_courses` bigint(21)
);

-- --------------------------------------------------------

--
-- Structure for view `active_user_sessions`
--
DROP TABLE IF EXISTS `active_user_sessions`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `active_user_sessions`  AS SELECT `us`.`id` AS `id`, `us`.`session_id` AS `session_id`, `us`.`account_id` AS `account_id`, `p`.`name` AS `name`, `p`.`username` AS `username`, `p`.`email` AS `email`, `us`.`ip_address` AS `ip_address`, `us`.`user_agent` AS `user_agent`, `us`.`last_activity` AS `last_activity`, `us`.`expires_at` AS `expires_at`, `us`.`created_at` AS `created_at` FROM (`user_sessions` `us` join `profiles` `p` on(`us`.`account_id` = `p`.`account_id`)) WHERE `us`.`is_active` = 1 AND `us`.`expires_at` > current_timestamp() ;

-- --------------------------------------------------------

--
-- Structure for view `user_statistics`
--
DROP TABLE IF EXISTS `user_statistics`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `user_statistics`  AS SELECT count(0) AS `total_users`, count(case when `profiles`.`authenticated` = 1 then 1 end) AS `active_users`, count(case when `profiles`.`roles` = 'student' then 1 end) AS `students`, count(case when `profiles`.`roles` = 'admin' then 1 end) AS `admins`, count(case when `profiles`.`roles` = 'instructor' then 1 end) AS `instructors`, count(case when `profiles`.`created_at` >= current_timestamp() - interval 30 day then 1 end) AS `new_users_30d`, count(case when `profiles`.`last_login` >= current_timestamp() - interval 24 hour then 1 end) AS `active_24h` FROM `profiles` ;

-- --------------------------------------------------------

--
-- Structure for view `v_competency_progress`
--
DROP TABLE IF EXISTS `v_competency_progress`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_competency_progress`  AS SELECT `se`.`student_id` AS `student_id`, concat(`p`.`first_name`,' ',`p`.`last_name`) AS `student_name`, `c`.`course_name` AS `course_name`, `co`.`batch_identifier` AS `batch_identifier`, `comp`.`competency_name` AS `competency_name`, `ct`.`type_name` AS `competency_type`, `sp`.`score` AS `score`, `sp`.`max_score` AS `max_score`, `sp`.`percentage_score` AS `percentage_score`, `sp`.`passed` AS `passed`, `sp`.`attempt_number` AS `attempt_number`, `sp`.`attempt_date` AS `attempt_date`, concat(`staff_p`.`first_name`,' ',`staff_p`.`last_name`) AS `assessed_by_name` FROM (((((((((`student_progress` `sp` join `student_enrollments` `se` on(`sp`.`enrollment_id` = `se`.`enrollment_id`)) join `students` `s` on(`se`.`student_id` = `s`.`student_id`)) join `persons` `p` on(`s`.`person_id` = `p`.`person_id`)) join `course_offerings` `co` on(`se`.`offering_id` = `co`.`offering_id`)) join `courses` `c` on(`co`.`course_id` = `c`.`course_id`)) join `competencies` `comp` on(`sp`.`competency_id` = `comp`.`competency_id`)) join `competency_types` `ct` on(`comp`.`competency_type_id` = `ct`.`competency_type_id`)) left join `staff` `staff_rec` on(`sp`.`assessed_by` = `staff_rec`.`staff_id`)) left join `persons` `staff_p` on(`staff_rec`.`person_id` = `staff_p`.`person_id`)) ;

-- --------------------------------------------------------

--
-- Structure for view `v_course_offering_details`
--
DROP TABLE IF EXISTS `v_course_offering_details`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_course_offering_details`  AS SELECT `co`.`offering_id` AS `offering_id`, `c`.`course_code` AS `course_code`, `c`.`course_name` AS `course_name`, `co`.`batch_identifier` AS `batch_identifier`, `co`.`start_date` AS `start_date`, `co`.`end_date` AS `end_date`, `co`.`status` AS `status`, `co`.`max_enrollees` AS `max_enrollees`, `co`.`current_enrollees` AS `current_enrollees`, `co`.`max_enrollees`- `co`.`current_enrollees` AS `available_slots`, round(`co`.`current_enrollees` / `co`.`max_enrollees` * 100,2) AS `enrollment_percentage`, count(distinct `se`.`student_id`) AS `actual_enrollments`, avg(`cp`.`amount`) AS `average_price` FROM (((`course_offerings` `co` join `courses` `c` on(`co`.`course_id` = `c`.`course_id`)) left join `student_enrollments` `se` on(`co`.`offering_id` = `se`.`offering_id`)) left join `course_pricing` `cp` on(`co`.`offering_id` = `cp`.`offering_id` and `cp`.`is_active` = 1)) GROUP BY `co`.`offering_id`, `c`.`course_code`, `c`.`course_name`, `co`.`batch_identifier`, `co`.`start_date`, `co`.`end_date`, `co`.`status`, `co`.`max_enrollees`, `co`.`current_enrollees` ;

-- --------------------------------------------------------

--
-- Structure for view `v_document_verification_status`
--
DROP TABLE IF EXISTS `v_document_verification_status`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_document_verification_status`  AS SELECT `s`.`student_id` AS `student_id`, concat(`p`.`first_name`,' ',`p`.`last_name`) AS `student_name`, `dt`.`type_name` AS `document_type`, `dt`.`is_required` AS `is_required`, `sd`.`document_id` AS `document_id`, `sd`.`verification_status` AS `verification_status`, `sd`.`upload_date` AS `upload_date`, `sd`.`verified_date` AS `verified_date`, concat(`staff_p`.`first_name`,' ',`staff_p`.`last_name`) AS `verified_by_name`, CASE WHEN `sd`.`document_id` is null AND `dt`.`is_required` = 1 THEN 'Missing Required' WHEN `sd`.`document_id` is null AND `dt`.`is_required` = 0 THEN 'Not Submitted' ELSE `sd`.`verification_status` END AS `overall_status` FROM (((((`students` `s` join `persons` `p` on(`s`.`person_id` = `p`.`person_id`)) join `document_types` `dt`) left join `student_documents` `sd` on(`s`.`student_id` = `sd`.`student_id` and `dt`.`document_type_id` = `sd`.`document_type_id` and `sd`.`is_current` = 1)) left join `staff` `staff_rec` on(`sd`.`verified_by` = `staff_rec`.`staff_id`)) left join `persons` `staff_p` on(`staff_rec`.`person_id` = `staff_p`.`person_id`)) WHERE `dt`.`is_active` = 1 ;

-- --------------------------------------------------------

--
-- Structure for view `v_scholarship_summary`
--
DROP TABLE IF EXISTS `v_scholarship_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_scholarship_summary`  AS SELECT `ss`.`student_id` AS `student_id`, concat(`p`.`first_name`,' ',`p`.`last_name`) AS `student_name`, `sp`.`sponsor_name` AS `sponsor_name`, `st`.`type_name` AS `sponsor_type`, `ss`.`scholarship_type` AS `scholarship_type`, `ss`.`coverage_percentage` AS `coverage_percentage`, `ss`.`coverage_amount` AS `coverage_amount`, `ss`.`scholarship_status` AS `scholarship_status`, `ss`.`start_date` AS `start_date`, `ss`.`end_date` AS `end_date`, concat(`staff_p`.`first_name`,' ',`staff_p`.`last_name`) AS `approved_by_name` FROM ((((((`student_scholarships` `ss` join `students` `s` on(`ss`.`student_id` = `s`.`student_id`)) join `persons` `p` on(`s`.`person_id` = `p`.`person_id`)) join `sponsors` `sp` on(`ss`.`sponsor_id` = `sp`.`sponsor_id`)) join `sponsor_types` `st` on(`sp`.`sponsor_type_id` = `st`.`sponsor_type_id`)) left join `staff` `staff_rec` on(`ss`.`approved_by` = `staff_rec`.`staff_id`)) left join `persons` `staff_p` on(`staff_rec`.`person_id` = `staff_p`.`person_id`)) ;

-- --------------------------------------------------------

--
-- Structure for view `v_student_financial_summary`
--
DROP TABLE IF EXISTS `v_student_financial_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_student_financial_summary`  AS SELECT `s`.`student_id` AS `student_id`, concat(`p`.`first_name`,' ',`p`.`last_name`) AS `student_name`, count(distinct `sa`.`account_id`) AS `total_accounts`, coalesce(sum(`sa`.`total_due`),0) AS `total_amount_due`, coalesce(sum(`sa`.`amount_paid`),0) AS `total_amount_paid`, coalesce(sum(`sa`.`balance`),0) AS `total_balance`, count(distinct case when `py`.`payment_status` = 'confirmed' then `py`.`payment_id` end) AS `confirmed_payments`, coalesce(sum(case when `py`.`payment_status` = 'confirmed' then `py`.`payment_amount` else 0 end),0) AS `total_confirmed_payments` FROM (((`students` `s` join `persons` `p` on(`s`.`person_id` = `p`.`person_id`)) left join `student_accounts` `sa` on(`s`.`student_id` = `sa`.`student_id`)) left join `payments` `py` on(`sa`.`account_id` = `py`.`account_id`)) GROUP BY `s`.`student_id`, `p`.`first_name`, `p`.`last_name` ;

-- --------------------------------------------------------

--
-- Structure for view `v_student_summary`
--
DROP TABLE IF EXISTS `v_student_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_student_summary`  AS SELECT `s`.`student_id` AS `student_id`, concat(`p`.`first_name`,' ',coalesce(`p`.`middle_name`,''),' ',`p`.`last_name`) AS `full_name`, `s`.`graduation_status` AS `graduation_status`, `s`.`gpa` AS `gpa`, `s`.`academic_standing` AS `academic_standing`, `tl`.`level_name` AS `current_trading_level`, count(distinct `se`.`enrollment_id`) AS `total_enrollments`, count(distinct case when `se`.`enrollment_status` = 'completed' then `se`.`enrollment_id` end) AS `completed_courses` FROM ((((`students` `s` join `persons` `p` on(`s`.`person_id` = `p`.`person_id`)) left join `student_enrollments` `se` on(`s`.`student_id` = `se`.`student_id`)) left join `student_trading_levels` `stl` on(`s`.`student_id` = `stl`.`student_id` and `stl`.`is_current` = 1)) left join `trading_levels` `tl` on(`stl`.`level_id` = `tl`.`level_id`)) GROUP BY `s`.`student_id`, `p`.`first_name`, `p`.`middle_name`, `p`.`last_name`, `s`.`graduation_status`, `s`.`gpa`, `s`.`academic_standing`, `tl`.`level_name` ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `accounts`
--
ALTER TABLE `accounts`
  ADD PRIMARY KEY (`account_id`),
  ADD KEY `idx_status` (`account_status`);

--
-- Indexes for table `account_roles`
--
ALTER TABLE `account_roles`
  ADD PRIMARY KEY (`account_id`,`role_id`),
  ADD KEY `role_id` (`role_id`),
  ADD KEY `assigned_by` (`assigned_by`),
  ADD KEY `idx_assigned_date` (`assigned_date`);

--
-- Indexes for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_logs_account` (`account_id`),
  ADD KEY `idx_action` (`action`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_account_action` (`account_id`,`action`);

--
-- Indexes for table `audit_log`
--
ALTER TABLE `audit_log`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `idx_table_name` (`table_name`),
  ADD KEY `idx_operation_type` (`operation_type`),
  ADD KEY `idx_timestamp` (`timestamp`),
  ADD KEY `idx_changed_by` (`changed_by`),
  ADD KEY `idx_audit_log_table_timestamp` (`table_name`,`timestamp`);

--
-- Indexes for table `competencies`
--
ALTER TABLE `competencies`
  ADD PRIMARY KEY (`competency_id`),
  ADD UNIQUE KEY `competency_code` (`competency_code`),
  ADD KEY `competency_type_id` (`competency_type_id`),
  ADD KEY `prerequisite_competency_id` (`prerequisite_competency_id`),
  ADD KEY `idx_competency_code` (`competency_code`),
  ADD KEY `idx_competency_name` (`competency_name`);

--
-- Indexes for table `competency_progress`
--
ALTER TABLE `competency_progress`
  ADD PRIMARY KEY (`progress_id`),
  ADD KEY `competency_progress_ibfk_1` (`student_id`);

--
-- Indexes for table `competency_types`
--
ALTER TABLE `competency_types`
  ADD PRIMARY KEY (`competency_type_id`),
  ADD UNIQUE KEY `type_name` (`type_name`),
  ADD KEY `idx_type_name` (`type_name`);

--
-- Indexes for table `contact_info`
--
ALTER TABLE `contact_info`
  ADD PRIMARY KEY (`contact_id`),
  ADD UNIQUE KEY `unique_primary_contact` (`person_id`,`contact_type`,`is_primary`),
  ADD KEY `idx_contact_value` (`contact_value`),
  ADD KEY `idx_contact_type` (`contact_type`),
  ADD KEY `idx_contact_info_type_primary` (`contact_type`,`is_primary`);

--
-- Indexes for table `courses`
--
ALTER TABLE `courses`
  ADD PRIMARY KEY (`course_id`),
  ADD UNIQUE KEY `course_code` (`course_code`),
  ADD KEY `idx_course_code` (`course_code`),
  ADD KEY `idx_course_name` (`course_name`),
  ADD KEY `idx_is_active` (`is_active`);

--
-- Indexes for table `course_competencies`
--
ALTER TABLE `course_competencies`
  ADD PRIMARY KEY (`course_id`,`competency_id`),
  ADD KEY `competency_id` (`competency_id`),
  ADD KEY `idx_order_sequence` (`order_sequence`);

--
-- Indexes for table `course_eligibility_requirements`
--
ALTER TABLE `course_eligibility_requirements`
  ADD PRIMARY KEY (`course_id`,`criteria_id`),
  ADD KEY `criteria_id` (`criteria_id`);

--
-- Indexes for table `course_offerings`
--
ALTER TABLE `course_offerings`
  ADD PRIMARY KEY (`offering_id`),
  ADD UNIQUE KEY `unique_batch` (`course_id`,`batch_identifier`),
  ADD KEY `idx_start_date` (`start_date`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_batch_identifier` (`batch_identifier`),
  ADD KEY `idx_course_offerings_date_status` (`start_date`,`status`);

--
-- Indexes for table `course_pricing`
--
ALTER TABLE `course_pricing`
  ADD PRIMARY KEY (`pricing_id`),
  ADD KEY `offering_id` (`offering_id`),
  ADD KEY `idx_pricing_type` (`pricing_type`),
  ADD KEY `idx_effective_date` (`effective_date`),
  ADD KEY `idx_amount` (`amount`);

--
-- Indexes for table `documents`
--
ALTER TABLE `documents`
  ADD PRIMARY KEY (`document_id`),
  ADD KEY `documents_ibfk_1` (`student_id`);

--
-- Indexes for table `document_types`
--
ALTER TABLE `document_types`
  ADD PRIMARY KEY (`document_type_id`),
  ADD UNIQUE KEY `type_name` (`type_name`),
  ADD KEY `idx_type_name` (`type_name`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_is_required` (`is_required`);

--
-- Indexes for table `draft`
--
ALTER TABLE `draft`
  ADD PRIMARY KEY (`student_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `student_fk_name` (`account_id`);

--
-- Indexes for table `eligibility_criteria`
--
ALTER TABLE `eligibility_criteria`
  ADD PRIMARY KEY (`criteria_id`),
  ADD KEY `idx_criteria_name` (`criteria_name`),
  ADD KEY `idx_criteria_type` (`criteria_type`),
  ADD KEY `idx_applies_to` (`applies_to`);

--
-- Indexes for table `fee_types`
--
ALTER TABLE `fee_types`
  ADD PRIMARY KEY (`fee_type_id`),
  ADD UNIQUE KEY `fee_name` (`fee_name`),
  ADD KEY `idx_fee_name` (`fee_name`),
  ADD KEY `idx_fee_category` (`fee_category`);

--
-- Indexes for table `learning_preferences`
--
ALTER TABLE `learning_preferences`
  ADD PRIMARY KEY (`preference_id`),
  ADD UNIQUE KEY `unique_student_preferences` (`student_id`);

--
-- Indexes for table `password_resets`
--
ALTER TABLE `password_resets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email_token_unique` (`email`,`token`),
  ADD KEY `idx_email_token` (`email`,`token`),
  ADD KEY `idx_expires_at` (`expires_at`),
  ADD KEY `idx_is_used` (`is_used`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`token_id`),
  ADD UNIQUE KEY `unique_active_token` (`account_id`,`is_used`),
  ADD KEY `idx_token` (`reset_token`),
  ADD KEY `idx_expires_at` (`expires_at`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`payment_id`),
  ADD UNIQUE KEY `unique_reference_number` (`reference_number`),
  ADD KEY `account_id` (`account_id`),
  ADD KEY `method_id` (`method_id`),
  ADD KEY `processed_by` (`processed_by`),
  ADD KEY `verified_by` (`verified_by`),
  ADD KEY `idx_payment_date` (`payment_date`),
  ADD KEY `idx_payment_status` (`payment_status`),
  ADD KEY `idx_external_transaction_id` (`external_transaction_id`),
  ADD KEY `idx_payments_status_date` (`payment_status`,`payment_date`);

--
-- Indexes for table `payment_methods`
--
ALTER TABLE `payment_methods`
  ADD PRIMARY KEY (`method_id`),
  ADD UNIQUE KEY `method_name` (`method_name`),
  ADD KEY `idx_method_name` (`method_name`),
  ADD KEY `idx_method_type` (`method_type`);

--
-- Indexes for table `payment_schemes`
--
ALTER TABLE `payment_schemes`
  ADD PRIMARY KEY (`scheme_id`),
  ADD UNIQUE KEY `scheme_name` (`scheme_name`),
  ADD KEY `idx_scheme_name` (`scheme_name`),
  ADD KEY `idx_installment_count` (`installment_count`);

--
-- Indexes for table `persons`
--
ALTER TABLE `persons`
  ADD PRIMARY KEY (`person_id`),
  ADD KEY `idx_full_name` (`last_name`,`first_name`),
  ADD KEY `idx_birth_date` (`birth_date`);

--
-- Indexes for table `positions`
--
ALTER TABLE `positions`
  ADD PRIMARY KEY (`position_id`),
  ADD KEY `idx_position_title` (`position_title`),
  ADD KEY `idx_department` (`department`);

--
-- Indexes for table `profiles`
--
ALTER TABLE `profiles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `account_id` (`account_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `account_id_unique` (`account_id`),
  ADD UNIQUE KEY `email_unique` (`email`),
  ADD UNIQUE KEY `username_unique` (`username`),
  ADD KEY `fk_profiles_account` (`account_id`),
  ADD KEY `idx_roles` (`roles`),
  ADD KEY `idx_trading_level` (`trading_level`),
  ADD KEY `idx_authenticated` (`authenticated`),
  ADD KEY `idx_email_verified` (`is_verified`),
  ADD KEY `idx_name_email` (`name`,`email`);

--
-- Indexes for table `referrals`
--
ALTER TABLE `referrals`
  ADD PRIMARY KEY (`referral_id`),
  ADD KEY `referrals_ibfk_1` (`student_id`);

--
-- Indexes for table `referral_sources`
--
ALTER TABLE `referral_sources`
  ADD PRIMARY KEY (`source_id`),
  ADD UNIQUE KEY `source_name` (`source_name`),
  ADD KEY `idx_source_name` (`source_name`),
  ADD KEY `idx_source_type` (`source_type`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`role_id`),
  ADD UNIQUE KEY `role_name` (`role_name`),
  ADD KEY `idx_role_name` (`role_name`);

--
-- Indexes for table `scholarships`
--
ALTER TABLE `scholarships`
  ADD PRIMARY KEY (`scholarship_id`),
  ADD KEY `scholarships_ibfk_1` (`student_id`);

--
-- Indexes for table `sponsors`
--
ALTER TABLE `sponsors`
  ADD PRIMARY KEY (`sponsor_id`),
  ADD UNIQUE KEY `sponsor_code` (`sponsor_code`),
  ADD KEY `sponsor_type_id` (`sponsor_type_id`),
  ADD KEY `idx_sponsor_name` (`sponsor_name`),
  ADD KEY `idx_sponsor_code` (`sponsor_code`),
  ADD KEY `idx_industry` (`industry`);

--
-- Indexes for table `sponsor_types`
--
ALTER TABLE `sponsor_types`
  ADD PRIMARY KEY (`sponsor_type_id`),
  ADD UNIQUE KEY `type_name` (`type_name`),
  ADD KEY `idx_type_name` (`type_name`);

--
-- Indexes for table `staff`
--
ALTER TABLE `staff`
  ADD PRIMARY KEY (`staff_id`),
  ADD UNIQUE KEY `unique_person_staff` (`person_id`),
  ADD UNIQUE KEY `employee_id` (`employee_id`),
  ADD KEY `account_id` (`account_id`),
  ADD KEY `idx_employee_id` (`employee_id`),
  ADD KEY `idx_employment_status` (`employment_status`),
  ADD KEY `idx_hire_date` (`hire_date`);

--
-- Indexes for table `staffs`
--
ALTER TABLE `staffs`
  ADD PRIMARY KEY (`staff_id`),
  ADD KEY `account_id` (`account_id`);

--
-- Indexes for table `staff_positions`
--
ALTER TABLE `staff_positions`
  ADD PRIMARY KEY (`staff_id`,`position_id`,`start_date`),
  ADD KEY `position_id` (`position_id`),
  ADD KEY `idx_start_date` (`start_date`),
  ADD KEY `idx_is_primary` (`is_primary`);

--
-- Indexes for table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`student_id`),
  ADD UNIQUE KEY `unique_person_student` (`person_id`),
  ADD KEY `account_id` (`account_id`),
  ADD KEY `idx_graduation_status` (`graduation_status`),
  ADD KEY `idx_registration_date` (`registration_date`),
  ADD KEY `idx_academic_standing` (`academic_standing`);

--
-- Indexes for table `student_accounts`
--
ALTER TABLE `student_accounts`
  ADD PRIMARY KEY (`account_id`),
  ADD UNIQUE KEY `unique_student_offering_account` (`student_id`,`offering_id`),
  ADD KEY `offering_id` (`offering_id`),
  ADD KEY `scheme_id` (`scheme_id`),
  ADD KEY `idx_account_status` (`account_status`),
  ADD KEY `idx_balance` (`balance`),
  ADD KEY `idx_due_date` (`due_date`),
  ADD KEY `idx_student_accounts_status_balance` (`account_status`,`balance`);

--
-- Indexes for table `student_backgrounds`
--
ALTER TABLE `student_backgrounds`
  ADD PRIMARY KEY (`background_id`),
  ADD UNIQUE KEY `unique_student_background` (`student_id`),
  ADD KEY `idx_education_level` (`education_level`),
  ADD KEY `idx_work_experience_years` (`work_experience_years`);

--
-- Indexes for table `student_documents`
--
ALTER TABLE `student_documents`
  ADD PRIMARY KEY (`document_id`),
  ADD KEY `student_id` (`student_id`),
  ADD KEY `document_type_id` (`document_type_id`),
  ADD KEY `uploaded_by` (`uploaded_by`),
  ADD KEY `verified_by` (`verified_by`),
  ADD KEY `idx_verification_status` (`verification_status`),
  ADD KEY `idx_upload_date` (`upload_date`),
  ADD KEY `idx_is_current` (`is_current`),
  ADD KEY `idx_file_hash` (`file_hash`),
  ADD KEY `idx_student_documents_verification` (`verification_status`,`is_current`);

--
-- Indexes for table `student_eligibility_assessments`
--
ALTER TABLE `student_eligibility_assessments`
  ADD PRIMARY KEY (`assessment_id`),
  ADD UNIQUE KEY `unique_student_criteria` (`student_id`,`criteria_id`),
  ADD KEY `criteria_id` (`criteria_id`),
  ADD KEY `assessed_by` (`assessed_by`),
  ADD KEY `reviewed_by` (`reviewed_by`),
  ADD KEY `idx_assessment_status` (`assessment_status`),
  ADD KEY `idx_assessment_date` (`assessment_date`);

--
-- Indexes for table `student_enrollments`
--
ALTER TABLE `student_enrollments`
  ADD PRIMARY KEY (`enrollment_id`),
  ADD KEY `offering_id` (`offering_id`),
  ADD KEY `idx_enrollment_date` (`enrollment_date`),
  ADD KEY `idx_enrollment_status` (`enrollment_status`),
  ADD KEY `idx_student_enrollments_status` (`enrollment_status`),
  ADD KEY `idx_student_id` (`student_id`);

--
-- Indexes for table `student_fees`
--
ALTER TABLE `student_fees`
  ADD PRIMARY KEY (`student_fee_id`),
  ADD KEY `student_id` (`student_id`),
  ADD KEY `fee_type_id` (`fee_type_id`),
  ADD KEY `payment_id` (`payment_id`),
  ADD KEY `waived_by` (`waived_by`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_due_date` (`due_date`),
  ADD KEY `idx_student_fees_status_due` (`status`,`due_date`);

--
-- Indexes for table `student_goals`
--
ALTER TABLE `student_goals`
  ADD PRIMARY KEY (`goal_id`),
  ADD KEY `student_id` (`student_id`),
  ADD KEY `idx_goal_type` (`goal_type`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_priority_level` (`priority_level`);

--
-- Indexes for table `student_progress`
--
ALTER TABLE `student_progress`
  ADD PRIMARY KEY (`progress_id`),
  ADD KEY `enrollment_id` (`enrollment_id`),
  ADD KEY `competency_id` (`competency_id`),
  ADD KEY `assessed_by` (`assessed_by`),
  ADD KEY `idx_attempt_date` (`attempt_date`),
  ADD KEY `idx_score` (`score`),
  ADD KEY `idx_attempt_number` (`attempt_number`),
  ADD KEY `idx_student_progress_passed` (`passed`);

--
-- Indexes for table `student_referrals`
--
ALTER TABLE `student_referrals`
  ADD PRIMARY KEY (`referral_id`),
  ADD KEY `student_id` (`student_id`),
  ADD KEY `source_id` (`source_id`),
  ADD KEY `referrer_student_id` (`referrer_student_id`),
  ADD KEY `idx_referral_date` (`referral_date`),
  ADD KEY `idx_ib_code` (`ib_code`),
  ADD KEY `idx_campaign_code` (`campaign_code`);

--
-- Indexes for table `student_scholarships`
--
ALTER TABLE `student_scholarships`
  ADD PRIMARY KEY (`scholarship_id`),
  ADD KEY `student_id` (`student_id`),
  ADD KEY `sponsor_id` (`sponsor_id`),
  ADD KEY `approved_by` (`approved_by`),
  ADD KEY `idx_scholarship_status` (`scholarship_status`),
  ADD KEY `idx_approval_date` (`approval_date`),
  ADD KEY `idx_performance_review_date` (`performance_review_date`),
  ADD KEY `idx_student_scholarships_status` (`scholarship_status`);

--
-- Indexes for table `student_trading_levels`
--
ALTER TABLE `student_trading_levels`
  ADD PRIMARY KEY (`student_id`,`level_id`,`assigned_date`),
  ADD KEY `level_id` (`level_id`),
  ADD KEY `assigned_by` (`assigned_by`),
  ADD KEY `idx_assigned_date` (`assigned_date`),
  ADD KEY `idx_is_current` (`is_current`);

--
-- Indexes for table `system_configuration`
--
ALTER TABLE `system_configuration`
  ADD PRIMARY KEY (`config_id`),
  ADD UNIQUE KEY `config_key` (`config_key`),
  ADD KEY `idx_config_key` (`config_key`),
  ADD KEY `idx_category` (`category`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `setting_key` (`setting_key`),
  ADD UNIQUE KEY `setting_key_unique` (`setting_key`),
  ADD KEY `idx_public_settings` (`is_public`);

--
-- Indexes for table `trading_levels`
--
ALTER TABLE `trading_levels`
  ADD PRIMARY KEY (`level_id`),
  ADD UNIQUE KEY `level_name` (`level_name`),
  ADD KEY `prerequisite_level_id` (`prerequisite_level_id`),
  ADD KEY `idx_level_name` (`level_name`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `accounts`
--
ALTER TABLE `accounts`
  MODIFY `account_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=207;

--
-- AUTO_INCREMENT for table `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `audit_log`
--
ALTER TABLE `audit_log`
  MODIFY `log_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=89;

--
-- AUTO_INCREMENT for table `competencies`
--
ALTER TABLE `competencies`
  MODIFY `competency_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `competency_types`
--
ALTER TABLE `competency_types`
  MODIFY `competency_type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `contact_info`
--
ALTER TABLE `contact_info`
  MODIFY `contact_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=196;

--
-- AUTO_INCREMENT for table `courses`
--
ALTER TABLE `courses`
  MODIFY `course_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `course_offerings`
--
ALTER TABLE `course_offerings`
  MODIFY `offering_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `course_pricing`
--
ALTER TABLE `course_pricing`
  MODIFY `pricing_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT for table `document_types`
--
ALTER TABLE `document_types`
  MODIFY `document_type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `eligibility_criteria`
--
ALTER TABLE `eligibility_criteria`
  MODIFY `criteria_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `fee_types`
--
ALTER TABLE `fee_types`
  MODIFY `fee_type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `learning_preferences`
--
ALTER TABLE `learning_preferences`
  MODIFY `preference_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=66;

--
-- AUTO_INCREMENT for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `token_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `payment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `payment_methods`
--
ALTER TABLE `payment_methods`
  MODIFY `method_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `payment_schemes`
--
ALTER TABLE `payment_schemes`
  MODIFY `scheme_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `persons`
--
ALTER TABLE `persons`
  MODIFY `person_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=207;

--
-- AUTO_INCREMENT for table `positions`
--
ALTER TABLE `positions`
  MODIFY `position_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `referral_sources`
--
ALTER TABLE `referral_sources`
  MODIFY `source_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `role_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `sponsors`
--
ALTER TABLE `sponsors`
  MODIFY `sponsor_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sponsor_types`
--
ALTER TABLE `sponsor_types`
  MODIFY `sponsor_type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `staff`
--
ALTER TABLE `staff`
  MODIFY `staff_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `student_accounts`
--
ALTER TABLE `student_accounts`
  MODIFY `account_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=62;

--
-- AUTO_INCREMENT for table `student_backgrounds`
--
ALTER TABLE `student_backgrounds`
  MODIFY `background_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `student_documents`
--
ALTER TABLE `student_documents`
  MODIFY `document_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `student_eligibility_assessments`
--
ALTER TABLE `student_eligibility_assessments`
  MODIFY `assessment_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_enrollments`
--
ALTER TABLE `student_enrollments`
  MODIFY `enrollment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=69;

--
-- AUTO_INCREMENT for table `student_fees`
--
ALTER TABLE `student_fees`
  MODIFY `student_fee_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_goals`
--
ALTER TABLE `student_goals`
  MODIFY `goal_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `student_progress`
--
ALTER TABLE `student_progress`
  MODIFY `progress_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_referrals`
--
ALTER TABLE `student_referrals`
  MODIFY `referral_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `student_scholarships`
--
ALTER TABLE `student_scholarships`
  MODIFY `scholarship_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `system_configuration`
--
ALTER TABLE `system_configuration`
  MODIFY `config_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `trading_levels`
--
ALTER TABLE `trading_levels`
  MODIFY `level_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `account_roles`
--
ALTER TABLE `account_roles`
  ADD CONSTRAINT `account_roles_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`account_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `account_roles_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `account_roles_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `accounts` (`account_id`) ON DELETE SET NULL;

--
-- Constraints for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD CONSTRAINT `account_id` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`account_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `competencies`
--
ALTER TABLE `competencies`
  ADD CONSTRAINT `competencies_ibfk_1` FOREIGN KEY (`competency_type_id`) REFERENCES `competency_types` (`competency_type_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `competencies_ibfk_2` FOREIGN KEY (`prerequisite_competency_id`) REFERENCES `competencies` (`competency_id`) ON DELETE SET NULL;

--
-- Constraints for table `contact_info`
--
ALTER TABLE `contact_info`
  ADD CONSTRAINT `contact_info_ibfk_1` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `course_competencies`
--
ALTER TABLE `course_competencies`
  ADD CONSTRAINT `course_competencies_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `course_competencies_ibfk_2` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`competency_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `course_eligibility_requirements`
--
ALTER TABLE `course_eligibility_requirements`
  ADD CONSTRAINT `course_eligibility_requirements_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `course_eligibility_requirements_ibfk_2` FOREIGN KEY (`criteria_id`) REFERENCES `eligibility_criteria` (`criteria_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `course_offerings`
--
ALTER TABLE `course_offerings`
  ADD CONSTRAINT `course_offerings_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `course_pricing`
--
ALTER TABLE `course_pricing`
  ADD CONSTRAINT `course_pricing_ibfk_1` FOREIGN KEY (`offering_id`) REFERENCES `course_offerings` (`offering_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `learning_preferences`
--
ALTER TABLE `learning_preferences`
  ADD CONSTRAINT `learning_preferences_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `password_reset_tokens_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`account_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `student_accounts` (`account_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`method_id`) REFERENCES `payment_methods` (`method_id`),
  ADD CONSTRAINT `payments_ibfk_3` FOREIGN KEY (`processed_by`) REFERENCES `staff` (`staff_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payments_ibfk_4` FOREIGN KEY (`verified_by`) REFERENCES `staff` (`staff_id`) ON DELETE SET NULL;

--
-- Constraints for table `sponsors`
--
ALTER TABLE `sponsors`
  ADD CONSTRAINT `sponsors_ibfk_1` FOREIGN KEY (`sponsor_type_id`) REFERENCES `sponsor_types` (`sponsor_type_id`);

--
-- Constraints for table `staff`
--
ALTER TABLE `staff`
  ADD CONSTRAINT `staff_ibfk_1` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `staff_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`account_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `staff_positions`
--
ALTER TABLE `staff_positions`
  ADD CONSTRAINT `staff_positions_ibfk_1` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`staff_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `staff_positions_ibfk_2` FOREIGN KEY (`position_id`) REFERENCES `positions` (`position_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `students`
--
ALTER TABLE `students`
  ADD CONSTRAINT `students_ibfk_1` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `students_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`account_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `student_accounts`
--
ALTER TABLE `student_accounts`
  ADD CONSTRAINT `student_accounts_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `student_accounts_ibfk_2` FOREIGN KEY (`offering_id`) REFERENCES `course_offerings` (`offering_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `student_accounts_ibfk_3` FOREIGN KEY (`scheme_id`) REFERENCES `payment_schemes` (`scheme_id`) ON DELETE SET NULL;

--
-- Constraints for table `student_backgrounds`
--
ALTER TABLE `student_backgrounds`
  ADD CONSTRAINT `student_backgrounds_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `student_documents`
--
ALTER TABLE `student_documents`
  ADD CONSTRAINT `student_documents_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `student_documents_ibfk_2` FOREIGN KEY (`document_type_id`) REFERENCES `document_types` (`document_type_id`),
  ADD CONSTRAINT `student_documents_ibfk_3` FOREIGN KEY (`uploaded_by`) REFERENCES `staff` (`staff_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `student_documents_ibfk_4` FOREIGN KEY (`verified_by`) REFERENCES `staff` (`staff_id`) ON DELETE SET NULL;

--
-- Constraints for table `student_eligibility_assessments`
--
ALTER TABLE `student_eligibility_assessments`
  ADD CONSTRAINT `student_eligibility_assessments_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `student_eligibility_assessments_ibfk_2` FOREIGN KEY (`criteria_id`) REFERENCES `eligibility_criteria` (`criteria_id`),
  ADD CONSTRAINT `student_eligibility_assessments_ibfk_3` FOREIGN KEY (`assessed_by`) REFERENCES `staff` (`staff_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `student_eligibility_assessments_ibfk_4` FOREIGN KEY (`reviewed_by`) REFERENCES `staff` (`staff_id`) ON DELETE SET NULL;

--
-- Constraints for table `student_enrollments`
--
ALTER TABLE `student_enrollments`
  ADD CONSTRAINT `student_enrollments_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `student_enrollments_ibfk_2` FOREIGN KEY (`offering_id`) REFERENCES `course_offerings` (`offering_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `student_fees`
--
ALTER TABLE `student_fees`
  ADD CONSTRAINT `student_fees_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `student_fees_ibfk_2` FOREIGN KEY (`fee_type_id`) REFERENCES `fee_types` (`fee_type_id`),
  ADD CONSTRAINT `student_fees_ibfk_3` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`payment_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `student_fees_ibfk_4` FOREIGN KEY (`waived_by`) REFERENCES `staff` (`staff_id`) ON DELETE SET NULL;

--
-- Constraints for table `student_goals`
--
ALTER TABLE `student_goals`
  ADD CONSTRAINT `student_goals_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `student_progress`
--
ALTER TABLE `student_progress`
  ADD CONSTRAINT `student_progress_ibfk_1` FOREIGN KEY (`enrollment_id`) REFERENCES `student_enrollments` (`enrollment_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `student_progress_ibfk_2` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`competency_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `student_progress_ibfk_3` FOREIGN KEY (`assessed_by`) REFERENCES `staff` (`staff_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `student_referrals`
--
ALTER TABLE `student_referrals`
  ADD CONSTRAINT `student_referrals_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `student_referrals_ibfk_2` FOREIGN KEY (`source_id`) REFERENCES `referral_sources` (`source_id`),
  ADD CONSTRAINT `student_referrals_ibfk_3` FOREIGN KEY (`referrer_student_id`) REFERENCES `students` (`student_id`) ON DELETE SET NULL;

--
-- Constraints for table `student_scholarships`
--
ALTER TABLE `student_scholarships`
  ADD CONSTRAINT `student_scholarships_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `student_scholarships_ibfk_2` FOREIGN KEY (`sponsor_id`) REFERENCES `sponsors` (`sponsor_id`),
  ADD CONSTRAINT `student_scholarships_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `staff` (`staff_id`) ON DELETE SET NULL;

--
-- Constraints for table `student_trading_levels`
--
ALTER TABLE `student_trading_levels`
  ADD CONSTRAINT `student_trading_levels_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `student_trading_levels_ibfk_2` FOREIGN KEY (`level_id`) REFERENCES `trading_levels` (`level_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `student_trading_levels_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `staff` (`staff_id`) ON DELETE SET NULL;

--
-- Constraints for table `trading_levels`
--
ALTER TABLE `trading_levels`
  ADD CONSTRAINT `trading_levels_ibfk_1` FOREIGN KEY (`prerequisite_level_id`) REFERENCES `trading_levels` (`level_id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
