-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 04, 2025 at 04:49 AM
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
CREATE DEFINER=`root`@`localhost` PROCEDURE `CreateSponsorWithScholarship` (IN `p_sponsor_type_id` INT, IN `p_sponsor_name` VARCHAR(100), IN `p_sponsor_code` VARCHAR(20), IN `p_contact_person` VARCHAR(100), IN `p_contact_email` VARCHAR(100), IN `p_contact_phone` VARCHAR(20), IN `p_student_id` VARCHAR(20), IN `p_coverage_percentage` DECIMAL(5,2), IN `p_scholarship_amount` DECIMAL(15,2))   BEGIN
    DECLARE v_sponsor_id INT;
    
    -- Start transaction
    START TRANSACTION;
    
    -- Insert sponsor
    INSERT INTO sponsors (
        sponsor_type_id, sponsor_name, sponsor_code, 
        contact_person, contact_email, contact_phone, is_active
    ) VALUES (
        p_sponsor_type_id, p_sponsor_name, p_sponsor_code,
        p_contact_person, p_contact_email, p_contact_phone, 1
    );
    
    -- Get the new sponsor ID
    SET v_sponsor_id = LAST_INSERT_ID();
    
    -- Create scholarship record if student_id is provided
    IF p_student_id IS NOT NULL AND p_student_id != '' THEN
        INSERT INTO scholarships (
            sponsor_id, student_id, coverage_percentage, scholarship_amount
        ) VALUES (
            v_sponsor_id, p_student_id, 
            COALESCE(p_coverage_percentage, 100.00), 
            p_scholarship_amount
        );
    END IF;
    
    -- Commit transaction
    COMMIT;
    
    -- Return the new sponsor ID
    SELECT v_sponsor_id as new_sponsor_id;
END$$

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
          (SELECT COUNT(*) FROM students WHERE graduation_status != 'expelled') AS total_enrollees,
          (SELECT SUM(payment_amount) FROM payments WHERE payment_status = 'confirmed') AS total_revenue,
          (SELECT COUNT(*) FROM students WHERE graduation_status = 'graduated') AS total_graduates,
          (SELECT SUM(payment_amount) FROM payments WHERE payment_status = 'pending') AS pending_receivables;

        -- Revenue Analysis (Monthly)
        SELECT 
          DATE_FORMAT(p.payment_date, '%Y-%m') AS formatted_month,
          MONTHNAME(p.payment_date) AS month,
          SUM(CASE WHEN p.payment_status = 'confirmed' THEN p.payment_amount ELSE 0 END) AS payment_received,
          SUM(CASE WHEN p.payment_status = 'pending' THEN p.payment_amount ELSE 0 END) AS accounts_receivable
        FROM payments p
        WHERE p.payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(p.payment_date, '%Y-%m'), MONTHNAME(p.payment_date), MONTH(p.payment_date)
        ORDER BY DATE_FORMAT(p.payment_date, '%Y-%m');

        -- Status Distribution
        SELECT 
          CASE 
            WHEN tl.level_name = 'Beginner' THEN 'Basic'
            WHEN tl.level_name = 'Intermediate' THEN 'Common'
            WHEN tl.level_name = 'Advanced' THEN 'Core'
            ELSE 'Basic'
          END AS name,
          COUNT(*) AS value
        FROM students s
        LEFT JOIN student_trading_levels stl ON s.student_id = stl.student_id AND stl.is_current = TRUE
        LEFT JOIN trading_levels tl ON stl.level_id = tl.level_id
        WHERE s.graduation_status != 'expelled'
        GROUP BY name;

        -- Monthly Enrollment Trend
        SELECT 
          DATE_FORMAT(s.registration_date, '%Y-%m') AS formatted_month,
          MONTHNAME(s.registration_date) AS month,
          COUNT(*) AS enrollees
        FROM students s
        WHERE s.registration_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(s.registration_date, '%Y-%m'), MONTHNAME(s.registration_date), MONTH(s.registration_date)
        ORDER BY DATE_FORMAT(s.registration_date, '%Y-%m');

        -- Batch Performance Data
        SELECT 
          co.batch_identifier AS batch,
          COUNT(DISTINCT se.student_id) AS enrollees,
          COUNT(DISTINCT CASE WHEN s.graduation_status = 'graduated' THEN s.student_id END) AS graduates,
          COUNT(DISTINCT CASE WHEN tl.level_name = 'Beginner' THEN s.student_id END) AS basic,
          COUNT(DISTINCT CASE WHEN tl.level_name = 'Intermediate' THEN s.student_id END) AS common,
          COUNT(DISTINCT CASE WHEN tl.level_name = 'Advanced' THEN s.student_id END) AS core
        FROM course_offerings co
        LEFT JOIN student_enrollments se ON co.offering_id = se.offering_id
        LEFT JOIN students s ON se.student_id = s.student_id
        LEFT JOIN student_trading_levels stl ON s.student_id = stl.student_id AND stl.is_current = TRUE
        LEFT JOIN trading_levels tl ON stl.level_id = tl.level_id
        WHERE co.start_date >= DATE_SUB(CURDATE(), INTERVAL 2 YEAR)
        GROUP BY co.batch_identifier, co.offering_id
        ORDER BY co.start_date DESC;
      END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_register_user_complete` (IN `p_password_hash` VARCHAR(255), IN `p_first_name` VARCHAR(50), IN `p_middle_name` VARCHAR(50), IN `p_last_name` VARCHAR(50), IN `p_birth_date` DATE, IN `p_birth_place` VARCHAR(100), IN `p_gender` ENUM('Male','Female','Other'), IN `p_email` VARCHAR(100), IN `p_education` VARCHAR(100), IN `p_phone_no` VARCHAR(15), IN `p_address` TEXT, IN `p_role_name` VARCHAR(50), IN `p_trading_level` VARCHAR(50), IN `p_device_type` VARCHAR(100), IN `p_learning_style` VARCHAR(100), IN `p_delivery_preference` VARCHAR(50), OUT `p_account_id` INT, OUT `p_student_id` VARCHAR(20), OUT `p_result` VARCHAR(100))   BEGIN
  DECLARE v_role_id INT;
  DECLARE v_level_id INT;
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
      SET p_student_id = CONCAT('S', UNIX_TIMESTAMP(NOW()) * 1000, '_', p_account_id);
      
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
      VALUES (p_account_id, p_account_id, CONCAT('EMP', UNIX_TIMESTAMP(NOW()) * 1000), CURDATE(), 'active');
    END IF;
    
    SET p_result = 'SUCCESS: Complete user registration successful';
    COMMIT;
  END IF;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_register_user_with_synced_ids` (IN `p_password_hash` VARCHAR(255), IN `p_first_name` VARCHAR(50), IN `p_middle_name` VARCHAR(50), IN `p_last_name` VARCHAR(50), IN `p_birth_date` DATE, IN `p_birth_place` VARCHAR(100), IN `p_gender` ENUM('Male','Female','Other'), IN `p_email` VARCHAR(100), IN `p_education` VARCHAR(100), IN `p_phone_no` VARCHAR(20), IN `p_address` TEXT, IN `p_role_name` VARCHAR(50), OUT `p_account_id` INT, OUT `p_result` VARCHAR(500))   BEGIN
    DECLARE v_role_id INT;
    DECLARE v_student_id VARCHAR(20);
    DECLARE v_staff_id VARCHAR(20);
    DECLARE v_current_year INT;
    DECLARE v_next_student_number INT DEFAULT 1;
    DECLARE v_next_staff_number INT DEFAULT 1;
    DECLARE v_student_pattern VARCHAR(20);
    DECLARE v_staff_pattern VARCHAR(20);
    DECLARE v_error_code VARCHAR(10);
    DECLARE v_error_message TEXT;
    
    -- Improved error handler that captures specific error details
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
            v_error_code = MYSQL_ERRNO,
            v_error_message = MESSAGE_TEXT;
        
        ROLLBACK;
        SET p_result = CONCAT('ERROR: ', v_error_code, ' - ', v_error_message);
        SET p_account_id = NULL;
    END;
    
    START TRANSACTION;
    
    -- Validate inputs first
    IF p_first_name IS NULL OR TRIM(p_first_name) = '' THEN
        SET p_result = 'ERROR: First name is required';
        SET p_account_id = NULL;
        ROLLBACK;
    ELSEIF p_last_name IS NULL OR TRIM(p_last_name) = '' THEN
        SET p_result = 'ERROR: Last name is required';
        SET p_account_id = NULL;
        ROLLBACK;
    ELSEIF p_email IS NULL OR TRIM(p_email) = '' THEN
        SET p_result = 'ERROR: Email is required';
        SET p_account_id = NULL;
        ROLLBACK;
    ELSE
        -- Check if email already exists
        IF EXISTS(SELECT 1 FROM persons WHERE email = p_email) THEN
            SET p_result = 'ERROR: Email already exists in persons table';
            SET p_account_id = NULL;
            ROLLBACK;
        ELSE
            -- Get current year
            SET v_current_year = YEAR(NOW());
            
            -- Create account first
            INSERT INTO accounts (password_hash, token, account_status)
            VALUES (p_password_hash, '', 'active');
            
            SET p_account_id = LAST_INSERT_ID();
            
            -- Create person with matching ID
            INSERT INTO persons (person_id, first_name, middle_name, last_name, birth_date, birth_place, gender, email, education)
            VALUES (p_account_id, p_first_name, p_middle_name, p_last_name, p_birth_date, p_birth_place, p_gender, p_email, p_education);
            
            -- Get role_id and validate it exists
            SELECT role_id INTO v_role_id FROM roles WHERE role_name = p_role_name;
            
            IF v_role_id IS NULL THEN
                SET p_result = CONCAT('ERROR: Role "', p_role_name, '" not found in roles table');
                SET p_account_id = NULL;
                ROLLBACK;
            ELSE
                -- Assign role
                INSERT INTO account_roles (account_id, role_id) VALUES (p_account_id, v_role_id);
                
                -- If student role, create student record
                IF p_role_name = 'student' THEN
                    -- Generate student ID: 8Con-YYYY-XXXXXX format
                    SET v_student_pattern = CONCAT('8Con-', v_current_year, '-%');
                    
                    -- Get the next sequential number for students in current year
                    SELECT COALESCE(MAX(CAST(SUBSTRING(student_id, -6) AS UNSIGNED)), 0) + 1 
                    INTO v_next_student_number
                    FROM students 
                    WHERE student_id LIKE v_student_pattern;
                    
                    -- Generate the student ID with 6-digit padding
                    SET v_student_id = CONCAT('8Con-', v_current_year, '-', LPAD(v_next_student_number, 6, '0'));
                    
                    INSERT INTO students (student_id, person_id, account_id)
                    VALUES (v_student_id, p_account_id, p_account_id);
                    
                    -- Add contact information (with null checks)
                    IF p_phone_no IS NOT NULL AND TRIM(p_phone_no) != '' THEN
                        INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary)
                        VALUES (p_account_id, v_student_id, 'phone', p_phone_no, 1);
                    END IF;
                    
                    IF p_address IS NOT NULL AND TRIM(p_address) != '' THEN
                        INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary)
                        VALUES (p_account_id, v_student_id, 'address', p_address, 1);
                    END IF;
                    
                    -- Always add email contact
                    INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary)
                    VALUES (p_account_id, v_student_id, 'email', p_email, 1);
                    
                    -- Set default trading level (check if level 1 exists)
                    IF EXISTS(SELECT 1 FROM trading_levels WHERE level_id = 1) THEN
                        INSERT INTO student_trading_levels (student_id, level_id, is_current)
                        VALUES (v_student_id, 1, 1);
                    END IF;
                    
                    -- Set default learning preferences
                    INSERT INTO learning_preferences (student_id, delivery_preference)
                    VALUES (v_student_id, 'hybrid');
                END IF;
                
                -- If staff role, create staff record
                IF p_role_name = 'staff' THEN
                    -- Generate staff ID: 8ConStaff-YYYY-XXXXXX format
                    SET v_staff_pattern = CONCAT('8ConStaff-', v_current_year, '-%');
                    
                    -- Get the next sequential number for staff in current year
                    SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id, -6) AS UNSIGNED)), 0) + 1 
                    INTO v_next_staff_number
                    FROM staff 
                    WHERE employee_id LIKE v_staff_pattern;
                    
                    -- Generate the staff ID with 6-digit padding
                    SET v_staff_id = CONCAT('8ConStaff-', v_current_year, '-', LPAD(v_next_staff_number, 6, '0'));
                    
                    INSERT INTO staff (person_id, account_id, employee_id, hire_date, employment_status)
                    VALUES (p_account_id, p_account_id, v_staff_id, CURDATE(), 'active');
                END IF;
                
                SET p_result = 'SUCCESS: User registered successfully';
                COMMIT;
            END IF;
        END IF;
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
(40, 'dmin<$2a$10$J9bCwQS275Aroa0McptniOQc0Yf2yRp/zULh2ddn.ngAXzRPCtnv2\0\'\',', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjQwLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTE1OTczMjUsImV4cCI6MTc1MTYyNjEyNX0.PjupShxuaTIaKQAFnOWVkhjJJ9_FGaFTP9DcsrN260Q', 'active', '2025-07-04 02:48:45', 0, NULL, '2025-06-18 09:52:24', '2025-07-04 02:48:45', NULL, NULL),
(278, '$2a$12$mMWYCnY8AEAot9swf0Deh.0kwRSL4uCSXZ9Y480i5HuXQHexUuo.S', '', 'active', NULL, 0, NULL, '2025-07-03 07:05:50', '2025-07-03 07:05:50', NULL, NULL),
(279, '$2a$10$JSRzCoFh7lcQTeEDwuuLaOXu7CVCMexR/db.lbgXeL.oNQZe.XBUu', '', 'active', NULL, 0, NULL, '2025-07-03 07:07:32', '2025-07-03 07:07:32', NULL, NULL),
(280, '$2a$10$0FZW2zo1Ytu01YqJNTWsXOHODXOD9uFZSk4p2OJeKKUAHG0PZ.Up.', '', 'active', NULL, 0, NULL, '2025-07-03 07:08:20', '2025-07-03 07:08:20', NULL, NULL),
(281, '$2a$12$WlDXVVLGnxImDBCXS6sdM.UyAg0EW8kfMsWAOvfDai5Nc8ZYOKa62', '', 'active', NULL, 0, NULL, '2025-07-03 07:10:49', '2025-07-03 07:10:49', NULL, NULL),
(282, '$2a$10$0BrnLs1cLbo2pI3NwwI63egQqubD30U5I.c1ptVfXD.ATN42lkFxa', '', 'active', NULL, 0, NULL, '2025-07-03 07:13:31', '2025-07-03 07:13:31', NULL, NULL),
(283, '$2a$12$lxL6HBmLD8Sl5EQXNjSbhukNQCS7SeEBnBdUVQALavp6XqFZ8LdXC', '', 'active', NULL, 0, NULL, '2025-07-03 07:14:09', '2025-07-03 07:14:09', NULL, NULL),
(284, '$2a$10$m.duy8rGA/i6Y9NSqIw9c.N.Kbu/MvCPR8OK3S.rL9xeBI..W9Sf2', '', 'active', NULL, 0, NULL, '2025-07-03 07:17:47', '2025-07-03 07:17:47', NULL, NULL),
(285, '$2a$10$NMxZL1UXh7iG5XsbpBTxee4IjiH.BvojalDJQrmxuRY6.rLwxuLRe', '', 'active', NULL, 0, NULL, '2025-07-03 07:23:13', '2025-07-03 07:23:13', NULL, NULL),
(286, '$2a$10$kjI4t3QAPuwRusN7gUAiwu2IzzuOWHGRVgjcOwyKjXkDaQhyhgrAO', '', 'active', NULL, 0, NULL, '2025-07-03 07:28:31', '2025-07-03 07:28:31', NULL, NULL),
(287, '$2a$12$IcTCV7q.YIEzBWMYWXVHzuFk4GZCfT6/8IoX0lr9rdpLyJWl8flSi', '', 'active', NULL, 0, NULL, '2025-07-03 07:32:59', '2025-07-03 07:32:59', NULL, NULL),
(288, '$2a$10$2.0k7fuqBuhBKnNpXsaK1usAJqFlhPxeZvnAx91oalF6X5iJrofEa', '', 'active', NULL, 0, NULL, '2025-07-03 07:44:56', '2025-07-03 07:44:56', NULL, NULL),
(289, '$2a$10$0UaE7/Xj/SDJDFRUUcJhC.paNBJk0ecvRGDyH.DSTFA7YNMvPah8q', '', 'active', NULL, 0, NULL, '2025-07-03 07:59:12', '2025-07-03 07:59:12', NULL, NULL),
(290, '$2a$10$L5aU9z2j77DRzP9Rms/4vOpYDzWwJo9efUtOLipAe9Dn02DJVy.HG', '', 'active', NULL, 0, NULL, '2025-07-03 08:18:33', '2025-07-03 08:18:33', NULL, NULL),
(291, '$2a$10$11XjKOhWdxLwMW4rnDzs6..ufDTnSCxaPi29mVNsV8vo1TyKND3sC', '', 'active', NULL, 0, NULL, '2025-07-03 08:31:37', '2025-07-03 08:31:37', NULL, NULL),
(292, '$2a$10$JO2YLRcrLVD45XlsVD2HcuJAHIhP4oHeMbRpWAroFn0bqqIoJiWaG', '', 'active', NULL, 0, NULL, '2025-07-03 08:44:57', '2025-07-03 08:44:57', NULL, NULL);

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
(40, 1, '2025-06-18 09:52:24', NULL, 1, NULL),
(278, 3, '2025-07-03 07:05:50', NULL, 1, NULL),
(279, 3, '2025-07-03 07:07:32', NULL, 1, NULL),
(280, 3, '2025-07-03 07:08:20', NULL, 1, NULL),
(281, 3, '2025-07-03 07:10:49', NULL, 1, NULL),
(282, 3, '2025-07-03 07:13:31', NULL, 1, NULL),
(283, 3, '2025-07-03 07:14:09', NULL, 1, NULL),
(284, 3, '2025-07-03 07:17:47', NULL, 1, NULL),
(285, 3, '2025-07-03 07:23:13', NULL, 1, NULL),
(286, 3, '2025-07-03 07:28:31', NULL, 1, NULL),
(287, 3, '2025-07-03 07:32:59', NULL, 1, NULL),
(288, 3, '2025-07-03 07:44:56', NULL, 1, NULL),
(289, 3, '2025-07-03 07:59:12', NULL, 1, NULL),
(290, 3, '2025-07-03 08:18:33', NULL, 1, NULL),
(291, 3, '2025-07-03 08:31:37', NULL, 1, NULL),
(292, 3, '2025-07-03 08:44:57', NULL, 1, NULL);

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
(88, 'payments', 'INSERT', '13', NULL, '{\"payment_id\": 13, \"account_id\": 30, \"payment_amount\": 1000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-29 07:02:24'),
(89, 'payments', 'INSERT', '14', NULL, '{\"payment_id\": 14, \"account_id\": 30, \"payment_amount\": 1199.98, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-29 13:30:48'),
(90, 'payments', 'INSERT', '15', NULL, '{\"payment_id\": 15, \"account_id\": 30, \"payment_amount\": 2300.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-29 13:38:36'),
(91, 'payments', 'INSERT', '16', NULL, '{\"payment_id\": 16, \"account_id\": 30, \"payment_amount\": 12000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-29 13:54:50'),
(92, 'payments', 'INSERT', '17', NULL, '{\"payment_id\": 17, \"account_id\": 30, \"payment_amount\": 333.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-29 13:55:52'),
(93, 'payments', 'INSERT', '18', NULL, '{\"payment_id\": 18, \"account_id\": 30, \"payment_amount\": 1999.99, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-29 13:58:02'),
(94, 'payments', 'INSERT', '19', NULL, '{\"payment_id\": 19, \"account_id\": 24, \"payment_amount\": 1000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-29 14:11:16'),
(95, 'payments', 'INSERT', '20', NULL, '{\"payment_id\": 20, \"account_id\": 34, \"payment_amount\": 2000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-30 03:12:12'),
(96, 'payments', 'INSERT', '21', NULL, '{\"payment_id\": 21, \"account_id\": 58, \"payment_amount\": 1000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-30 03:16:03'),
(97, 'payments', 'INSERT', '22', NULL, '{\"payment_id\": 22, \"account_id\": 30, \"payment_amount\": 3456.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-30 03:22:27'),
(98, 'payments', 'INSERT', '23', NULL, '{\"payment_id\": 23, \"account_id\": 23, \"payment_amount\": 230.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-30 03:23:40'),
(99, 'students', 'INSERT', 'S1751257120000_207', NULL, '{\"student_id\": \"S1751257120000_207\", \"person_id\": 207, \"account_id\": 207, \"graduation_status\": \"enrolled\"}', 207, NULL, NULL, NULL, '2025-06-30 04:18:40'),
(100, 'students', 'INSERT', 'S1751257133000_208', NULL, '{\"student_id\": \"S1751257133000_208\", \"person_id\": 208, \"account_id\": 208, \"graduation_status\": \"enrolled\"}', 208, NULL, NULL, NULL, '2025-06-30 04:18:53'),
(101, 'payments', 'INSERT', '24', NULL, '{\"payment_id\": 24, \"account_id\": 31, \"payment_amount\": 10000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-30 04:21:38'),
(102, 'payments', 'INSERT', '25', NULL, '{\"payment_id\": 25, \"account_id\": 30, \"payment_amount\": 10000.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-06-30 04:22:37'),
(103, 'students', 'INSERT', 'S1751258467000_209', NULL, '{\"student_id\": \"S1751258467000_209\", \"person_id\": 209, \"account_id\": 209, \"graduation_status\": \"enrolled\"}', 209, NULL, NULL, NULL, '2025-06-30 04:41:07'),
(104, 'students', 'INSERT', '8Con-2025-000204', NULL, '{\"student_id\": \"8Con-2025-000204\", \"person_id\": 210, \"account_id\": 210, \"graduation_status\": \"enrolled\"}', 210, NULL, NULL, NULL, '2025-06-30 04:56:33'),
(105, 'students', 'INSERT', '8Con-2025-000205', NULL, '{\"student_id\": \"8Con-2025-000205\", \"person_id\": 211, \"account_id\": 211, \"graduation_status\": \"enrolled\"}', 211, NULL, NULL, NULL, '2025-06-30 08:53:26'),
(106, 'students', 'INSERT', '8Con-2025-000206', NULL, '{\"student_id\": \"8Con-2025-000206\", \"person_id\": 212, \"account_id\": 212, \"graduation_status\": \"enrolled\"}', 212, NULL, NULL, NULL, '2025-06-30 09:17:35'),
(107, 'students', 'INSERT', '8Con-2025-000207', NULL, '{\"student_id\": \"8Con-2025-000207\", \"person_id\": 213, \"account_id\": 213, \"graduation_status\": \"enrolled\"}', 213, NULL, NULL, NULL, '2025-07-02 04:18:54'),
(108, 'students', 'INSERT', '8Con-2025-000208', NULL, '{\"student_id\": \"8Con-2025-000208\", \"person_id\": 214, \"account_id\": 214, \"graduation_status\": \"enrolled\"}', 214, NULL, NULL, NULL, '2025-07-02 04:24:32'),
(109, 'students', 'INSERT', '8Con-2025-000209', NULL, '{\"student_id\": \"8Con-2025-000209\", \"person_id\": 215, \"account_id\": 215, \"graduation_status\": \"enrolled\"}', 215, NULL, NULL, NULL, '2025-07-02 05:04:49'),
(110, 'students', 'INSERT', '8Con-2025-000210', NULL, '{\"student_id\": \"8Con-2025-000210\", \"person_id\": 216, \"account_id\": 216, \"graduation_status\": \"enrolled\"}', 216, NULL, NULL, NULL, '2025-07-02 05:25:08'),
(111, 'students', 'INSERT', '8Con-2025-000211', NULL, '{\"student_id\": \"8Con-2025-000211\", \"person_id\": 217, \"account_id\": 217, \"graduation_status\": \"enrolled\"}', 217, NULL, NULL, NULL, '2025-07-02 05:52:42'),
(112, 'students', 'INSERT', '8Con-2025-000212', NULL, '{\"student_id\": \"8Con-2025-000212\", \"person_id\": 235, \"account_id\": 235, \"graduation_status\": \"enrolled\"}', 235, NULL, NULL, NULL, '2025-07-02 06:54:45'),
(113, 'students', 'INSERT', '8Con-2025-000213', NULL, '{\"student_id\": \"8Con-2025-000213\", \"person_id\": 237, \"account_id\": 237, \"graduation_status\": \"enrolled\"}', 237, NULL, NULL, NULL, '2025-07-02 06:55:56'),
(114, 'students', 'INSERT', '8Con-2025-000214', NULL, '{\"student_id\": \"8Con-2025-000214\", \"person_id\": 238, \"account_id\": 238, \"graduation_status\": \"enrolled\"}', 238, NULL, NULL, NULL, '2025-07-02 07:00:11'),
(115, 'students', 'INSERT', '8Con-2025-000215', NULL, '{\"student_id\": \"8Con-2025-000215\", \"person_id\": 239, \"account_id\": 239, \"graduation_status\": \"enrolled\"}', 239, NULL, NULL, NULL, '2025-07-02 07:05:59'),
(116, 'students', 'INSERT', '8Con-2025-000216', NULL, '{\"student_id\": \"8Con-2025-000216\", \"person_id\": 240, \"account_id\": 240, \"graduation_status\": \"enrolled\"}', 240, NULL, NULL, NULL, '2025-07-02 07:08:29'),
(117, 'students', 'INSERT', '8Con-2025-000217', NULL, '{\"student_id\": \"8Con-2025-000217\", \"person_id\": 241, \"account_id\": 241, \"graduation_status\": \"enrolled\"}', 241, NULL, NULL, NULL, '2025-07-02 07:10:15'),
(118, 'students', 'INSERT', '8Con-2025-000218', NULL, '{\"student_id\": \"8Con-2025-000218\", \"person_id\": 242, \"account_id\": 242, \"graduation_status\": \"enrolled\"}', 242, NULL, NULL, NULL, '2025-07-02 07:10:44'),
(119, 'students', 'INSERT', '8Con-2025-000219', NULL, '{\"student_id\": \"8Con-2025-000219\", \"person_id\": 243, \"account_id\": 243, \"graduation_status\": \"enrolled\"}', 243, NULL, NULL, NULL, '2025-07-02 07:15:05'),
(120, 'students', 'INSERT', '8Con-2025-000220', NULL, '{\"student_id\": \"8Con-2025-000220\", \"person_id\": 244, \"account_id\": 244, \"graduation_status\": \"enrolled\"}', 244, NULL, NULL, NULL, '2025-07-02 07:16:12'),
(121, 'scholarships', 'INSERT', '2', NULL, '{\"scholarship_id\": 2, \"sponsor_id\": 6, \"student_id\": \"8Con-2025-000220\", \"coverage_percentage\": 100.00, \"scholarship_amount\": null}', NULL, NULL, NULL, NULL, '2025-07-02 07:16:12'),
(122, 'students', 'INSERT', '8Con-2025-000221', NULL, '{\"student_id\": \"8Con-2025-000221\", \"person_id\": 245, \"account_id\": 245, \"graduation_status\": \"enrolled\"}', 245, NULL, NULL, NULL, '2025-07-02 07:17:43'),
(123, 'scholarships', 'INSERT', '3', NULL, '{\"scholarship_id\": 3, \"sponsor_id\": 6, \"student_id\": \"8Con-2025-000221\", \"coverage_percentage\": 100.00, \"scholarship_amount\": null}', NULL, NULL, NULL, NULL, '2025-07-02 07:17:43'),
(124, 'students', 'INSERT', '8Con-2025-000222', NULL, '{\"student_id\": \"8Con-2025-000222\", \"person_id\": 246, \"account_id\": 246, \"graduation_status\": \"enrolled\"}', 246, NULL, NULL, NULL, '2025-07-02 07:40:26'),
(125, 'scholarships', 'INSERT', '4', NULL, '{\"scholarship_id\": 4, \"sponsor_id\": 3, \"student_id\": \"8Con-2025-000222\", \"coverage_percentage\": 100.00, \"scholarship_amount\": null}', NULL, NULL, NULL, NULL, '2025-07-02 07:40:26'),
(126, 'students', 'INSERT', '8Con-2025-000223', NULL, '{\"student_id\": \"8Con-2025-000223\", \"person_id\": 247, \"account_id\": 247, \"graduation_status\": \"enrolled\"}', 247, NULL, NULL, NULL, '2025-07-02 07:41:06'),
(127, 'payments', 'INSERT', '26', NULL, '{\"payment_id\": 26, \"account_id\": 65, \"payment_amount\": 1500.00, \"payment_status\": \"pending\"}', NULL, NULL, NULL, NULL, '2025-07-02 09:33:39'),
(128, 'students', 'INSERT', '8Con-2025-000224', NULL, '{\"student_id\": \"8Con-2025-000224\", \"person_id\": 248, \"account_id\": 248, \"graduation_status\": \"enrolled\"}', 248, NULL, NULL, NULL, '2025-07-02 11:24:42'),
(129, 'students', 'INSERT', '8Con-2025-000225', NULL, '{\"student_id\": \"8Con-2025-000225\", \"person_id\": 249, \"account_id\": 249, \"graduation_status\": \"enrolled\"}', 249, NULL, NULL, NULL, '2025-07-02 13:40:01'),
(130, 'students', 'INSERT', '8Con-2025-000226', NULL, '{\"student_id\": \"8Con-2025-000226\", \"person_id\": 250, \"account_id\": 250, \"graduation_status\": \"enrolled\"}', 250, NULL, NULL, NULL, '2025-07-02 14:17:33'),
(131, 'students', 'INSERT', '8Con-2025-000227', NULL, '{\"student_id\": \"8Con-2025-000227\", \"person_id\": 251, \"account_id\": 251, \"graduation_status\": \"enrolled\"}', 251, NULL, NULL, NULL, '2025-07-02 15:09:11'),
(132, 'students', 'INSERT', '8Con-2025-000228', NULL, '{\"student_id\": \"8Con-2025-000228\", \"person_id\": 252, \"account_id\": 252, \"graduation_status\": \"enrolled\"}', 252, NULL, NULL, NULL, '2025-07-02 16:41:15'),
(133, 'students', 'INSERT', '8Con-2025-000229', NULL, '{\"student_id\": \"8Con-2025-000229\", \"person_id\": 253, \"account_id\": 253, \"graduation_status\": \"enrolled\"}', 253, NULL, NULL, NULL, '2025-07-02 16:41:33'),
(134, 'students', 'INSERT', '8Con-2025-000230', NULL, '{\"student_id\": \"8Con-2025-000230\", \"person_id\": 254, \"account_id\": 254, \"graduation_status\": \"enrolled\"}', 254, NULL, NULL, NULL, '2025-07-02 16:41:44'),
(135, 'students', 'INSERT', '8Con-2025-000231', NULL, '{\"student_id\": \"8Con-2025-000231\", \"person_id\": 255, \"account_id\": 255, \"graduation_status\": \"enrolled\"}', 255, NULL, NULL, NULL, '2025-07-02 16:42:04'),
(136, 'students', 'INSERT', '8Con-2025-000232', NULL, '{\"student_id\": \"8Con-2025-000232\", \"person_id\": 256, \"account_id\": 256, \"graduation_status\": \"enrolled\"}', 256, NULL, NULL, NULL, '2025-07-02 16:46:44'),
(137, 'students', 'INSERT', '8Con-2025-000233', NULL, '{\"student_id\": \"8Con-2025-000233\", \"person_id\": 257, \"account_id\": 257, \"graduation_status\": \"enrolled\"}', 257, NULL, NULL, NULL, '2025-07-03 04:12:43'),
(138, 'students', 'INSERT', '8Con-2025-000234', NULL, '{\"student_id\": \"8Con-2025-000234\", \"person_id\": 258, \"account_id\": 258, \"graduation_status\": \"enrolled\"}', 258, NULL, NULL, NULL, '2025-07-03 04:20:30'),
(139, 'students', 'INSERT', '8Con-2025-000235', NULL, '{\"student_id\": \"8Con-2025-000235\", \"person_id\": 259, \"account_id\": 259, \"graduation_status\": \"enrolled\"}', 259, NULL, NULL, NULL, '2025-07-03 04:51:08'),
(140, 'students', 'INSERT', '8Con-2025-000236', NULL, '{\"student_id\": \"8Con-2025-000236\", \"person_id\": 260, \"account_id\": 260, \"graduation_status\": \"enrolled\"}', 260, NULL, NULL, NULL, '2025-07-03 05:14:05'),
(141, 'students', 'INSERT', '8Con-2025-000237', NULL, '{\"student_id\": \"8Con-2025-000237\", \"person_id\": 261, \"account_id\": 261, \"graduation_status\": \"enrolled\"}', 261, NULL, NULL, NULL, '2025-07-03 05:27:47'),
(142, 'students', 'INSERT', '8Con-2025-000238', NULL, '{\"student_id\": \"8Con-2025-000238\", \"person_id\": 262, \"account_id\": 262, \"graduation_status\": \"enrolled\"}', 262, NULL, NULL, NULL, '2025-07-03 05:33:08'),
(143, 'students', 'INSERT', '8Con-2025-000239', NULL, '{\"student_id\": \"8Con-2025-000239\", \"person_id\": 263, \"account_id\": 263, \"graduation_status\": \"enrolled\"}', 263, NULL, NULL, NULL, '2025-07-03 05:57:56'),
(144, 'students', 'INSERT', '8Con-2025-000240', NULL, '{\"student_id\": \"8Con-2025-000240\", \"person_id\": 264, \"account_id\": 264, \"graduation_status\": \"enrolled\"}', 264, NULL, NULL, NULL, '2025-07-03 06:07:26'),
(145, 'students', 'INSERT', '8Con-2025-000241', NULL, '{\"student_id\": \"8Con-2025-000241\", \"person_id\": 265, \"account_id\": 265, \"graduation_status\": \"enrolled\"}', 265, NULL, NULL, NULL, '2025-07-03 06:08:05'),
(146, 'students', 'INSERT', '8Con-2025-000242', NULL, '{\"student_id\": \"8Con-2025-000242\", \"person_id\": 266, \"account_id\": 266, \"graduation_status\": \"enrolled\"}', 266, NULL, NULL, NULL, '2025-07-03 06:08:24'),
(147, 'students', 'INSERT', '8Con-2025-000243', NULL, '{\"student_id\": \"8Con-2025-000243\", \"person_id\": 267, \"account_id\": 267, \"graduation_status\": \"enrolled\"}', 267, NULL, NULL, NULL, '2025-07-03 06:08:52'),
(148, 'students', 'INSERT', '8Con-2025-000244', NULL, '{\"student_id\": \"8Con-2025-000244\", \"person_id\": 268, \"account_id\": 268, \"graduation_status\": \"enrolled\"}', 268, NULL, NULL, NULL, '2025-07-03 06:09:05'),
(149, 'students', 'INSERT', '8Con-2025-000245', NULL, '{\"student_id\": \"8Con-2025-000245\", \"person_id\": 269, \"account_id\": 269, \"graduation_status\": \"enrolled\"}', 269, NULL, NULL, NULL, '2025-07-03 06:09:23'),
(150, 'students', 'INSERT', '8Con-2025-000246', NULL, '{\"student_id\": \"8Con-2025-000246\", \"person_id\": 270, \"account_id\": 270, \"graduation_status\": \"enrolled\"}', 270, NULL, NULL, NULL, '2025-07-03 06:10:03'),
(151, 'students', 'INSERT', '8Con-2025-000247', NULL, '{\"student_id\": \"8Con-2025-000247\", \"person_id\": 271, \"account_id\": 271, \"graduation_status\": \"enrolled\"}', 271, NULL, NULL, NULL, '2025-07-03 06:16:52'),
(152, 'students', 'INSERT', '8Con-2025-000248', NULL, '{\"student_id\": \"8Con-2025-000248\", \"person_id\": 272, \"account_id\": 272, \"graduation_status\": \"enrolled\"}', 272, NULL, NULL, NULL, '2025-07-03 06:25:54'),
(153, 'students', 'INSERT', '8Con-2025-000249', NULL, '{\"student_id\": \"8Con-2025-000249\", \"person_id\": 273, \"account_id\": 273, \"graduation_status\": \"enrolled\"}', 273, NULL, NULL, NULL, '2025-07-03 06:26:11'),
(154, 'students', 'INSERT', '8Con-2025-000250', NULL, '{\"student_id\": \"8Con-2025-000250\", \"person_id\": 274, \"account_id\": 274, \"graduation_status\": \"enrolled\"}', 274, NULL, NULL, NULL, '2025-07-03 06:32:56'),
(155, 'students', 'INSERT', '8Con-2025-000251', NULL, '{\"student_id\": \"8Con-2025-000251\", \"person_id\": 275, \"account_id\": 275, \"graduation_status\": \"enrolled\"}', 275, NULL, NULL, NULL, '2025-07-03 06:35:08'),
(156, 'students', 'INSERT', '8Con-2025-000252', NULL, '{\"student_id\": \"8Con-2025-000252\", \"person_id\": 276, \"account_id\": 276, \"graduation_status\": \"enrolled\"}', 276, NULL, NULL, NULL, '2025-07-03 06:36:31'),
(157, 'students', 'INSERT', '8Con-2025-000253', NULL, '{\"student_id\": \"8Con-2025-000253\", \"person_id\": 277, \"account_id\": 277, \"graduation_status\": \"enrolled\"}', 277, NULL, NULL, NULL, '2025-07-03 06:49:40'),
(158, 'students', 'INSERT', '8Con-2025-000001', NULL, '{\"student_id\": \"8Con-2025-000001\", \"person_id\": 278, \"account_id\": 278, \"graduation_status\": \"enrolled\"}', 278, NULL, NULL, NULL, '2025-07-03 07:05:50'),
(159, 'students', 'INSERT', '8Con-2025-000002', NULL, '{\"student_id\": \"8Con-2025-000002\", \"person_id\": 279, \"account_id\": 279, \"graduation_status\": \"enrolled\"}', 279, NULL, NULL, NULL, '2025-07-03 07:07:32'),
(160, 'scholarships', 'INSERT', '5', NULL, '{\"scholarship_id\": 5, \"sponsor_id\": 7, \"student_id\": \"8Con-2025-000002\", \"coverage_percentage\": 100.00, \"scholarship_amount\": null}', NULL, NULL, NULL, NULL, '2025-07-03 07:07:32'),
(161, 'students', 'INSERT', '8Con-2025-000003', NULL, '{\"student_id\": \"8Con-2025-000003\", \"person_id\": 280, \"account_id\": 280, \"graduation_status\": \"enrolled\"}', 280, NULL, NULL, NULL, '2025-07-03 07:08:20'),
(162, 'students', 'INSERT', '8Con-2025-000004', NULL, '{\"student_id\": \"8Con-2025-000004\", \"person_id\": 281, \"account_id\": 281, \"graduation_status\": \"enrolled\"}', 281, NULL, NULL, NULL, '2025-07-03 07:10:49'),
(163, 'students', 'INSERT', '8Con-2025-000005', NULL, '{\"student_id\": \"8Con-2025-000005\", \"person_id\": 282, \"account_id\": 282, \"graduation_status\": \"enrolled\"}', 282, NULL, NULL, NULL, '2025-07-03 07:13:31'),
(164, 'students', 'INSERT', '8Con-2025-000006', NULL, '{\"student_id\": \"8Con-2025-000006\", \"person_id\": 283, \"account_id\": 283, \"graduation_status\": \"enrolled\"}', 283, NULL, NULL, NULL, '2025-07-03 07:14:09'),
(165, 'students', 'INSERT', '8Con-2025-000007', NULL, '{\"student_id\": \"8Con-2025-000007\", \"person_id\": 284, \"account_id\": 284, \"graduation_status\": \"enrolled\"}', 284, NULL, NULL, NULL, '2025-07-03 07:17:47'),
(166, 'students', 'INSERT', '8Con-2025-000008', NULL, '{\"student_id\": \"8Con-2025-000008\", \"person_id\": 285, \"account_id\": 285, \"graduation_status\": \"enrolled\"}', 285, NULL, NULL, NULL, '2025-07-03 07:23:13'),
(167, 'scholarships', 'INSERT', '6', NULL, '{\"scholarship_id\": 6, \"sponsor_id\": 8, \"student_id\": \"8Con-2025-000008\", \"coverage_percentage\": 100.00, \"scholarship_amount\": null}', NULL, NULL, NULL, NULL, '2025-07-03 07:23:13'),
(168, 'students', 'INSERT', '8Con-2025-000009', NULL, '{\"student_id\": \"8Con-2025-000009\", \"person_id\": 286, \"account_id\": 286, \"graduation_status\": \"enrolled\"}', 286, NULL, NULL, NULL, '2025-07-03 07:28:31'),
(169, 'students', 'INSERT', '8Con-2025-000010', NULL, '{\"student_id\": \"8Con-2025-000010\", \"person_id\": 287, \"account_id\": 287, \"graduation_status\": \"enrolled\"}', 287, NULL, NULL, NULL, '2025-07-03 07:32:59'),
(170, 'students', 'INSERT', '8Con-2025-000011', NULL, '{\"student_id\": \"8Con-2025-000011\", \"person_id\": 288, \"account_id\": 288, \"graduation_status\": \"enrolled\"}', 288, NULL, NULL, NULL, '2025-07-03 07:44:56'),
(171, 'students', 'INSERT', '8Con-2025-000012', NULL, '{\"student_id\": \"8Con-2025-000012\", \"person_id\": 289, \"account_id\": 289, \"graduation_status\": \"enrolled\"}', 289, NULL, NULL, NULL, '2025-07-03 07:59:12'),
(172, 'students', 'INSERT', '8Con-2025-000013', NULL, '{\"student_id\": \"8Con-2025-000013\", \"person_id\": 290, \"account_id\": 290, \"graduation_status\": \"enrolled\"}', 290, NULL, NULL, NULL, '2025-07-03 08:18:33'),
(173, 'students', 'INSERT', '8Con-2025-000014', NULL, '{\"student_id\": \"8Con-2025-000014\", \"person_id\": 291, \"account_id\": 291, \"graduation_status\": \"enrolled\"}', 291, NULL, NULL, NULL, '2025-07-03 08:31:37'),
(174, 'students', 'INSERT', '8Con-2025-000015', NULL, '{\"student_id\": \"8Con-2025-000015\", \"person_id\": 292, \"account_id\": 292, \"graduation_status\": \"enrolled\"}', 292, NULL, NULL, NULL, '2025-07-03 08:44:57'),
(175, 'scholarships', 'INSERT', '7', NULL, '{\"scholarship_id\": 7, \"sponsor_id\": 9, \"student_id\": \"8Con-2025-000015\", \"coverage_percentage\": 100.00, \"scholarship_amount\": null}', NULL, NULL, NULL, NULL, '2025-07-03 08:44:57');

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
  `is_active` tinyint(1) DEFAULT 1,
  `competency_level` enum('basic','intermediate','advanced','expert') DEFAULT 'basic',
  `is_required_for_new_students` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `competencies`
--

INSERT INTO `competencies` (`competency_id`, `competency_type_id`, `competency_code`, `competency_name`, `competency_description`, `learning_objectives`, `assessment_criteria`, `weight`, `prerequisite_competency_id`, `is_active`, `competency_level`, `is_required_for_new_students`) VALUES
(1, 1, 'BASIC001', 'Trading Fundamentals', 'Understanding basic trading concepts and terminology', NULL, NULL, 1.00, NULL, 0, 'basic', 1),
(3, 2, 'COMM001', 'Risk Management', 'Understanding and implementing risk management strategies', NULL, NULL, 1.00, NULL, 0, 'basic', 0),
(5, 3, 'CORE001', 'Advanced Strategies', 'Complex trading strategies and execution', NULL, NULL, 1.00, NULL, 0, 'basic', 0),
(18, 1, 'BASICFX001', 'Basic Competencies', NULL, NULL, NULL, 1.00, NULL, 1, 'basic', 1),
(19, 2, 'COMMONFX001', 'Common Competencies', NULL, NULL, NULL, 1.00, NULL, 1, 'basic', 0),
(20, 3, 'COREFX001', 'Core', NULL, NULL, NULL, 1.00, NULL, 1, 'basic', 0);

-- --------------------------------------------------------

--
-- Table structure for table `competency_progress`
--

CREATE TABLE `competency_progress` (
  `progress_id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `competency_id` int(11) NOT NULL,
  `score` decimal(5,2) DEFAULT 1.00,
  `passed` tinyint(1) DEFAULT 0,
  `exam_status` enum('Not taken','Pass','Retake') DEFAULT 'Not taken',
  `exam_date` date DEFAULT NULL,
  `attempts` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `competency_progress`
--

INSERT INTO `competency_progress` (`progress_id`, `student_id`, `competency_id`, `score`, `passed`, `exam_status`, `exam_date`, `attempts`, `created_at`, `updated_at`) VALUES
(76, '8Con-2025-000013', 18, 0.00, 0, 'Not taken', NULL, 0, '2025-07-03 08:18:33', '2025-07-03 08:18:33'),
(79, '8Con-2025-000014', 18, 0.00, 0, 'Not taken', NULL, 0, '2025-07-03 08:31:37', '2025-07-03 08:31:37'),
(82, '8Con-2025-000015', 18, 0.00, 0, 'Not taken', NULL, 0, '2025-07-03 08:44:57', '2025-07-03 08:44:57');

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
(355, 278, '8Con-2025-000001', 'phone', '09945056825', 1, 0, '2025-07-03 07:05:50', '2025-07-03 07:05:50'),
(356, 278, '8Con-2025-000001', 'address', 'Meycauyan, Bulacan', 1, 0, '2025-07-03 07:05:50', '2025-07-03 07:05:50'),
(357, 278, '8Con-2025-000001', 'email', 'emnacenjohnmathew8con@gmail.com', 1, 0, '2025-07-03 07:05:50', '2025-07-03 07:05:50'),
(358, 279, '8Con-2025-000002', 'phone', '09945056825', 1, 0, '2025-07-03 07:07:32', '2025-07-03 07:07:32'),
(359, 279, '8Con-2025-000002', 'address', 'Meycauyan, Bulacan', 1, 0, '2025-07-03 07:07:32', '2025-07-03 07:07:32'),
(360, 279, '8Con-2025-000002', 'email', 'starvedar@gmail.com', 1, 0, '2025-07-03 07:07:32', '2025-07-03 07:07:32'),
(361, 280, '8Con-2025-000003', 'phone', '09704918693', 1, 0, '2025-07-03 07:08:20', '2025-07-03 07:08:20'),
(362, 280, '8Con-2025-000003', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-07-03 07:08:20', '2025-07-03 07:08:20'),
(363, 280, '8Con-2025-000003', 'email', 'gonzagaalbertbpdm@gmail.com', 1, 0, '2025-07-03 07:08:20', '2025-07-03 07:08:20'),
(364, 281, '8Con-2025-000004', 'phone', '09092343234', 1, 0, '2025-07-03 07:10:49', '2025-07-03 07:10:49'),
(365, 281, '8Con-2025-000004', 'address', 'esteban north', 1, 0, '2025-07-03 07:10:49', '2025-07-03 07:10:49'),
(366, 281, '8Con-2025-000004', 'email', 'grace@gmail.com', 1, 0, '2025-07-03 07:10:49', '2025-07-03 07:10:49'),
(367, 282, '8Con-2025-000005', 'phone', '09776279849', 1, 0, '2025-07-03 07:13:31', '2025-07-03 07:13:31'),
(368, 282, '8Con-2025-000005', 'address', 'Blk 12 Lot 31 Urban Deca Homes, Magnolia St., Brgy. Abangan Norte, Marilao, Bulacan', 1, 0, '2025-07-03 07:13:31', '2025-07-03 07:13:31'),
(369, 282, '8Con-2025-000005', 'email', 'buenaventurapatrickian@gmail.com', 1, 0, '2025-07-03 07:13:31', '2025-07-03 07:13:31'),
(370, 283, '8Con-2025-000006', 'phone', '+1-555-123-4567', 1, 0, '2025-07-03 07:14:09', '2025-07-03 07:14:09'),
(371, 283, '8Con-2025-000006', 'address', '123 Main Street, Anytown, NY 12345', 1, 0, '2025-07-03 07:14:09', '2025-07-03 07:14:09'),
(372, 283, '8Con-2025-000006', 'email', 'johnas@example.com', 1, 0, '2025-07-03 07:14:09', '2025-07-03 07:14:09'),
(373, 284, '8Con-2025-000007', 'phone', '09562500033', 1, 0, '2025-07-03 07:17:47', '2025-07-03 07:17:47'),
(374, 284, '8Con-2025-000007', 'address', 'Megalodon, Marilao, Bulacan', 1, 0, '2025-07-03 07:17:47', '2025-07-03 07:17:47'),
(375, 284, '8Con-2025-000007', 'email', 'starvadermaelstrom@gmail.com', 1, 0, '2025-07-03 07:17:47', '2025-07-03 07:17:47'),
(376, 285, '8Con-2025-000008', 'phone', '09427184388', 1, 0, '2025-07-03 07:23:13', '2025-07-03 07:23:13'),
(377, 285, '8Con-2025-000008', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-07-03 07:23:13', '2025-07-03 07:23:13'),
(378, 285, '8Con-2025-000008', 'email', 'crajeextremeyt@gmail.com', 1, 0, '2025-07-03 07:23:13', '2025-07-03 07:23:13'),
(379, 286, '8Con-2025-000009', 'phone', '09704918693', 1, 0, '2025-07-03 07:28:31', '2025-07-03 07:28:31'),
(380, 286, '8Con-2025-000009', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-07-03 07:28:31', '2025-07-03 07:28:31'),
(381, 286, '8Con-2025-000009', 'email', 'gonzagaalbasasertbpdm@gmail.com', 1, 0, '2025-07-03 07:28:31', '2025-07-03 07:28:31'),
(382, 287, '8Con-2025-000010', 'phone', '+1-555-123-4567', 1, 0, '2025-07-03 07:32:59', '2025-07-03 07:32:59'),
(383, 287, '8Con-2025-000010', 'address', '123 Main Street, Anytown, NY 12345', 1, 0, '2025-07-03 07:32:59', '2025-07-03 07:32:59'),
(384, 287, '8Con-2025-000010', 'email', 'johnass@example.com', 1, 0, '2025-07-03 07:32:59', '2025-07-03 07:32:59'),
(385, 288, '8Con-2025-000011', 'phone', '09427184388', 1, 0, '2025-07-03 07:44:56', '2025-07-03 07:44:56'),
(386, 288, '8Con-2025-000011', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-07-03 07:44:56', '2025-07-03 07:44:56'),
(387, 288, '8Con-2025-000011', 'email', 'asxaasdds@gmail.com', 1, 0, '2025-07-03 07:44:56', '2025-07-03 07:44:56'),
(388, 289, '8Con-2025-000012', 'phone', '09704918693', 1, 0, '2025-07-03 07:59:12', '2025-07-03 07:59:12'),
(389, 289, '8Con-2025-000012', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-07-03 07:59:12', '2025-07-03 07:59:12'),
(390, 289, '8Con-2025-000012', 'email', 'manzanojoshuaphilip8con@gmail.com', 1, 0, '2025-07-03 07:59:12', '2025-07-03 07:59:12'),
(391, 290, '8Con-2025-000013', 'phone', '09207866094', 1, 0, '2025-07-03 08:18:33', '2025-07-03 08:18:33'),
(392, 290, '8Con-2025-000013', 'address', 'Marilao', 1, 0, '2025-07-03 08:18:33', '2025-07-03 08:18:33'),
(393, 290, '8Con-2025-000013', 'email', 'macabatajhamesandrew8con@gmail.com', 1, 0, '2025-07-03 08:18:33', '2025-07-03 08:18:33'),
(394, 291, '8Con-2025-000014', 'phone', '0970671784', 1, 0, '2025-07-03 08:31:37', '2025-07-03 08:31:37'),
(395, 291, '8Con-2025-000014', 'address', '173 Zinya St., Sta. Rosa 2, Marilao, Bulacan', 1, 0, '2025-07-03 08:31:37', '2025-07-03 08:31:37'),
(396, 291, '8Con-2025-000014', 'email', 'navalesmarkrennier8con@gmail.com', 1, 0, '2025-07-03 08:31:37', '2025-07-03 08:31:37'),
(397, 292, '8Con-2025-000015', 'phone', '09704918693', 1, 0, '2025-07-03 08:44:57', '2025-07-03 08:44:57'),
(398, 292, '8Con-2025-000015', 'address', 'blk 1 lot 1 T. Mendoza St., Saog, Marilao', 1, 0, '2025-07-03 08:44:57', '2025-07-03 08:44:57'),
(399, 292, '8Con-2025-000015', 'email', 'manzanojoshn@gmail.com', 1, 0, '2025-07-03 08:44:57', '2025-07-03 08:44:57');

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
(4, 'FTD01', 'Forex Trading Derivates', 'Trading is the key', 12, 3.0, 1, '2025-06-23 06:38:35', '2025-06-25 08:24:17');

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
(4, 18, 1, 1, 0.00),
(4, 19, 1, 2, 0.00),
(4, 20, 1, 3, 0.00);

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
  `end_date` timestamp NULL DEFAULT NULL,
  `max_enrollees` int(11) DEFAULT 25,
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
(3, 4, 'FTD01-2025-01', '2025-07-03 08:44:57', '2025-09-15 06:38:35', 25, 12, 'active', NULL, 'Online', '2025-06-23 06:38:35', '2025-07-03 08:44:57');

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
(24, 3, '', 65000.00, 'PHP', '2025-06-23 06:38:53', '2025-06-23 06:38:53', 1, 1);

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
(120, '8Con-2025-000002', '', 'hybrid', 'Mobile Phone,Laptop', NULL, 'flexible', NULL, NULL, '2025-07-03 07:07:32', '2025-07-03 07:07:32'),
(121, '8Con-2025-000003', '', 'hybrid', 'Laptop,Mobile Phone', NULL, 'flexible', NULL, NULL, '2025-07-03 07:08:20', '2025-07-03 07:08:20'),
(126, '8Con-2025-000008', '', 'hybrid', 'Mobile Phone,Desktop', NULL, 'flexible', NULL, NULL, '2025-07-03 07:23:13', '2025-07-03 07:23:13'),
(127, '8Con-2025-000009', '', 'hybrid', 'Laptop', NULL, 'flexible', NULL, NULL, '2025-07-03 07:28:31', '2025-07-03 07:28:31'),
(129, '8Con-2025-000011', '', 'hybrid', 'Laptop', NULL, 'flexible', NULL, NULL, '2025-07-03 07:44:56', '2025-07-03 07:44:56'),
(130, '8Con-2025-000012', '', 'hybrid', 'Laptop', NULL, 'flexible', NULL, NULL, '2025-07-03 07:59:12', '2025-07-03 07:59:12'),
(131, '8Con-2025-000013', '', 'hybrid', 'Mobile Phone,Desktop', NULL, 'flexible', NULL, NULL, '2025-07-03 08:18:33', '2025-07-03 08:18:33'),
(132, '8Con-2025-000014', '', 'hybrid', 'Laptop', NULL, 'flexible', NULL, NULL, '2025-07-03 08:31:37', '2025-07-03 08:31:37'),
(133, '8Con-2025-000015', '', 'hybrid', 'Laptop', NULL, 'flexible', NULL, NULL, '2025-07-03 08:44:57', '2025-07-03 08:44:57');

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
(278, 'John Mathew', 'Pelayo', 'Emnacen', '2004-07-02', 'Meycauayan, Bulacan', 'Male', 'emnacenjohnmathew8con@gmail.com', 'College', '2025-07-03 07:05:50', '2025-07-03 07:05:50'),
(279, 'Vincent Benjamin', 'Mega', 'Bautista', '2004-07-02', 'Meycauayan, Bulacan', 'Male', 'starvedar@gmail.com', 'College', '2025-07-03 07:07:32', '2025-07-03 07:07:32'),
(280, 'Albert', 'Borromeo', 'Gonzaga', '2004-07-02', 'Masbate', 'Male', 'gonzagaalbertbpdm@gmail.com', 'College', '2025-07-03 07:08:20', '2025-07-03 07:08:20'),
(281, 'Grace', 'Hulk', 'Maguate', '2004-08-02', 'Marilao', 'Female', 'grace@gmail.com', 'College', '2025-07-03 07:10:49', '2025-07-03 07:10:49'),
(282, 'Patrick Ian', 'Vargas', 'Buenaventura', '2004-08-02', 'Marilao', 'Male', 'buenaventurapatrickian@gmail.com', 'College', '2025-07-03 07:13:31', '2025-07-03 07:13:31'),
(283, 'John', 'Michael', 'Doe', '1995-08-15', 'New York, NY', 'Male', 'johnas@example.com', 'Bachelor\'s Degree in Business Administration', '2025-07-03 07:14:09', '2025-07-03 07:14:09'),
(284, 'Vincent Benjamin', 'Hulk', 'Bautista', '2004-08-02', 'Marilao', 'Male', 'starvadermaelstrom@gmail.com', 'College', '2025-07-03 07:17:47', '2025-07-03 07:17:47'),
(285, 'CJ', 'Pinalba', 'Napoles', '2004-08-02', 'Marilao', 'Male', 'crajeextremeyt@gmail.com', 'College', '2025-07-03 07:23:13', '2025-07-03 07:23:13'),
(286, 'Albertss', 'Borromeo', 'Gonzagaaa', '2000-01-01', 'as', 'Male', 'gonzagaalbasasertbpdm@gmail.com', 'College', '2025-07-03 07:28:31', '2025-07-03 07:28:31'),
(287, 'John', 'Michael', 'Doe', '1995-08-15', 'New York, NY', 'Male', 'johnass@example.com', 'Bachelor\'s Degree in Business Administration', '2025-07-03 07:32:59', '2025-07-03 07:32:59'),
(288, 'Albert', 'aas', 'Gonzaga', '2000-01-01', 'Meycauayan, Bulacan', 'Male', 'asxaasdds@gmail.com', 'College', '2025-07-03 07:44:56', '2025-07-03 07:44:56'),
(289, 'Joshua', 'Pinal', 'Manzano', '2002-02-10', 'Meycauayan, Bulacan', 'Male', 'manzanojoshuaphilip8con@gmail.com', 'College', '2025-07-03 07:59:12', '2025-07-03 07:59:12'),
(290, 'Jhames Andrew', 'Reynoso', 'Macabata', '2000-04-03', 'marilao', 'Female', 'macabatajhamesandrew8con@gmail.com', 'College', '2025-07-03 08:18:33', '2025-07-03 08:18:33'),
(291, 'Mark Rennier', 'Sucandito', 'Navales', '2004-04-23', 'Marilao', 'Female', 'navalesmarkrennier8con@gmail.com', 'College', '2025-07-03 08:31:37', '2025-07-03 08:31:37'),
(292, 'Paolo', 'Borromeo', 'Brown', '2007-04-23', 'Caloocan', 'Male', 'manzanojoshn@gmail.com', 'College', '2025-07-03 08:44:57', '2025-07-03 08:44:57');

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
  `sponsor_id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `coverage_percentage` decimal(5,2) DEFAULT 100.00,
  `scholarship_amount` decimal(15,2) DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `scholarships`
--

INSERT INTO `scholarships` (`scholarship_id`, `sponsor_id`, `student_id`, `coverage_percentage`, `scholarship_amount`, `approved_by`, `notes`, `created_at`, `updated_at`) VALUES
(5, 7, '8Con-2025-000002', 100.00, NULL, NULL, NULL, '2025-07-03 07:07:32', '2025-07-03 07:07:32'),
(6, 8, '8Con-2025-000008', 100.00, NULL, NULL, NULL, '2025-07-03 07:23:13', '2025-07-03 07:23:13'),
(7, 9, '8Con-2025-000015', 100.00, NULL, NULL, NULL, '2025-07-03 08:44:57', '2025-07-03 08:44:57');

--
-- Triggers `scholarships`
--
DELIMITER $$
CREATE TRIGGER `scholarships_audit_insert` AFTER INSERT ON `scholarships` FOR EACH ROW BEGIN
    INSERT INTO audit_log (table_name, operation_type, primary_key_value, new_values, changed_by)
    VALUES ('scholarships', 'INSERT', NEW.scholarship_id, JSON_OBJECT(
        'scholarship_id', NEW.scholarship_id,
        'sponsor_id', NEW.sponsor_id,
        'student_id', NEW.student_id,
        'coverage_percentage', NEW.coverage_percentage,
        'scholarship_amount', NEW.scholarship_amount
    ), NEW.approved_by);
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `scholarships_audit_update` AFTER UPDATE ON `scholarships` FOR EACH ROW BEGIN
    INSERT INTO audit_log (table_name, operation_type, primary_key_value, old_values, new_values, changed_by)
    VALUES ('scholarships', 'UPDATE', NEW.scholarship_id, 
        JSON_OBJECT(
            'sponsor_id', OLD.sponsor_id,
            'student_id', OLD.student_id,
            'coverage_percentage', OLD.coverage_percentage,
            'scholarship_amount', OLD.scholarship_amount
        ),
        JSON_OBJECT(
            'sponsor_id', NEW.sponsor_id,
            'student_id', NEW.student_id,
            'coverage_percentage', NEW.coverage_percentage,
            'scholarship_amount', NEW.scholarship_amount
        ), 
        NEW.approved_by);
END
$$
DELIMITER ;

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

--
-- Dumping data for table `sponsors`
--

INSERT INTO `sponsors` (`sponsor_id`, `sponsor_type_id`, `sponsor_name`, `sponsor_code`, `contact_person`, `contact_email`, `contact_phone`, `address`, `website`, `industry`, `company_size`, `agreement_details`, `agreement_start_date`, `agreement_end_date`, `total_commitment`, `current_commitment`, `students_sponsored`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 6, 'Our Ladys Scholarships program', 'IND-OURLAD-765', 'Patrick Ian Buenaventura', 'patrick@gmail.com', '09704918693', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 1, 1, '2025-06-30 00:53:26', '2025-06-30 00:53:26'),
(2, 9, 'PDM', 'OJT-PDM-669', 'Ryan Lazona', 'Ryan@gmail.com', '09704918693', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 1, 1, '2025-06-30 01:17:35', '2025-06-30 01:17:35'),
(3, 9, 'PDM', 'OJT-PDM-668', 'Albert', 'albertgonzaga689@gmail.com', '+639704918693', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 2, 1, '2025-07-01 20:18:54', '2025-07-02 07:40:26'),
(4, 9, 'PDM', 'OJT-PDM-355', 'Cj Napoles', 'Cj@gmail.com', '+639704918693', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 1, 1, '2025-07-02 05:04:49', '2025-07-02 05:04:49'),
(5, 7, 'Our Ladys Scholarships program', 'COR-OURLAD-301', 'Jhames Andrew Reynoso Macabata', 'macabatajhamesandrew.8con@gmail.com', '+639207866094', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 1, 1, '2025-07-02 05:52:42', '2025-07-02 05:52:42'),
(6, 8, 'Our Ladys Scholarships program', 'COO-OURLAD-559', 'Albert', 'craje@gmail.com', '+639704918693', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 8, 1, '2025-07-02 06:55:56', '2025-07-02 07:17:43'),
(7, 9, '8Con', 'OJT-8CO-609', 'Ryan Lazona', 'Ryan@gmail.com', '+639704928693', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 1, 1, '2025-07-03 07:07:32', '2025-07-03 07:07:32'),
(8, 6, 'Our Ladys Scholarships program', 'IND-OURLAD-511', 'Albert', 'albertgonzaga689@gmail.com', '+639704918693', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 1, 1, '2025-07-03 07:23:13', '2025-07-03 07:23:13'),
(9, 8, 'Our Ladys Scholarships program', 'COO-OURLAD-806', 'Albert Borromeo Gonzaga', 'gonzagaalbertb.pdm@gmail.com', '+639704918693', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 1, 1, '2025-07-03 08:44:57', '2025-07-03 08:44:57');

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
(6, 'Individual', 'Individual sponsor providing support for students', 50.00, 5, 0, 'quarterly', 1, '2025-06-30 08:50:55'),
(7, 'Corporate', 'Corporate sponsorship from companies and organizations', 75.00, 20, 1, 'quarterly', 1, '2025-06-30 08:50:55'),
(8, 'Cooperative', 'Cooperative organizations providing educational support', 60.00, 15, 1, 'quarterly', 1, '2025-06-30 08:50:55'),
(9, 'OJT Program', 'On-the-Job Training program sponsorships', 100.00, 10, 1, 'monthly', 1, '2025-06-30 08:50:55'),
(10, 'Government Agency', 'Government agency sponsored educational programs', 100.00, 50, 1, 'monthly', 1, '2025-06-30 08:50:55');

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
('8Con-2025-000002', 279, 279, '2025-07-03', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000003', 280, 280, '2025-07-03', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000008', 285, 285, '2025-07-03', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000009', 286, 286, '2025-07-03', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000011', 288, 288, '2025-07-03', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000012', 289, 289, '2025-07-03', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000013', 290, 290, '2025-07-03', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000014', 291, 291, '2025-07-03', 'enrolled', NULL, NULL, 'good', NULL),
('8Con-2025-000015', 292, 292, '2025-07-03', 'enrolled', NULL, NULL, 'good', NULL);

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
(90, '8Con-2025-000002', 3, 65000.00, 0.00, NULL, '', '2025-08-02', NULL, 0, NULL, '2025-07-03 07:07:32', '2025-07-03 07:07:32'),
(91, '8Con-2025-000003', 3, 65000.00, 0.00, NULL, '', '2025-08-02', NULL, 0, NULL, '2025-07-03 07:08:20', '2025-07-03 07:08:20'),
(94, '8Con-2025-000008', 3, 65000.00, 0.00, NULL, '', '2025-08-02', NULL, 0, NULL, '2025-07-03 07:23:13', '2025-07-03 07:23:13'),
(95, '8Con-2025-000009', 3, 65000.00, 0.00, NULL, '', '2025-08-02', NULL, 0, NULL, '2025-07-03 07:28:31', '2025-07-03 07:28:31'),
(96, '8Con-2025-000011', 3, 65000.00, 0.00, NULL, '', '2025-08-02', NULL, 0, NULL, '2025-07-03 07:44:56', '2025-07-03 07:44:56'),
(97, '8Con-2025-000012', 3, 65000.00, 0.00, NULL, '', '2025-08-02', NULL, 0, NULL, '2025-07-03 07:59:12', '2025-07-03 07:59:12'),
(98, '8Con-2025-000013', 3, 65000.00, 0.00, NULL, '', '2025-08-02', NULL, 0, NULL, '2025-07-03 08:18:33', '2025-07-03 08:18:33'),
(99, '8Con-2025-000014', 3, 65000.00, 0.00, NULL, '', '2025-08-02', NULL, 0, NULL, '2025-07-03 08:31:37', '2025-07-03 08:31:37'),
(100, '8Con-2025-000015', 3, 65000.00, 0.00, NULL, '', '2025-08-02', NULL, 0, NULL, '2025-07-03 08:44:57', '2025-07-03 08:44:57');

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
(98, '8Con-2025-000002', 3, '2025-07-03 07:07:32', 'enrolled', '2025-09-25 06:16:52', NULL, 0.00, NULL),
(99, '8Con-2025-000003', 3, '2025-07-03 07:08:20', 'enrolled', '2025-09-25 07:07:32', NULL, 0.00, NULL),
(102, '8Con-2025-000008', 3, '2025-07-03 07:23:13', 'enrolled', '2025-09-25 07:18:14', NULL, 0.00, NULL),
(103, '8Con-2025-000009', 3, '2025-07-03 07:28:31', 'enrolled', '2025-09-25 07:23:13', NULL, 0.00, NULL),
(104, '8Con-2025-000011', 3, '2025-07-03 07:44:56', 'enrolled', '2025-09-25 07:28:31', NULL, 0.00, NULL),
(105, '8Con-2025-000012', 3, '2025-07-03 07:59:12', 'enrolled', '2025-09-25 07:44:56', NULL, 0.00, NULL),
(106, '8Con-2025-000013', 3, '2025-07-03 08:18:33', 'enrolled', '2025-09-25 07:59:12', NULL, 0.00, NULL),
(107, '8Con-2025-000014', 3, '2025-07-03 08:31:37', 'enrolled', '2025-09-25 08:18:33', NULL, 0.00, NULL),
(108, '8Con-2025-000015', 3, '2025-07-03 08:44:57', 'enrolled', '2025-09-25 08:31:37', NULL, 0.00, NULL);

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
('8Con-2025-000002', 1, '2025-07-03 07:07:32', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000003', 1, '2025-07-03 07:08:20', NULL, NULL, 'exam', 0, NULL),
('8Con-2025-000003', 2, '2025-07-03 07:08:20', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000008', 1, '2025-07-03 07:23:13', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000009', 1, '2025-07-03 07:28:31', NULL, NULL, 'exam', 0, NULL),
('8Con-2025-000009', 3, '2025-07-03 07:28:31', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000011', 1, '2025-07-03 07:44:56', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000012', 1, '2025-07-03 07:59:12', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000013', 1, '2025-07-03 08:18:33', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000014', 1, '2025-07-03 08:31:37', NULL, NULL, 'exam', 1, NULL),
('8Con-2025-000015', 1, '2025-07-03 08:44:57', NULL, NULL, 'exam', 1, NULL);

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
  ADD KEY `idx_student_id` (`student_id`),
  ADD KEY `idx_competency_id` (`competency_id`) USING BTREE;

--
-- Indexes for table `competency_types`
--
ALTER TABLE `competency_types`
  ADD PRIMARY KEY (`competency_type_id`) USING BTREE,
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
  ADD UNIQUE KEY `unique_student_sponsor` (`student_id`,`sponsor_id`),
  ADD KEY `idx_sponsor_id` (`sponsor_id`),
  ADD KEY `idx_student_id` (`student_id`),
  ADD KEY `scholarships_ibfk_3` (`approved_by`);

--
-- Indexes for table `sponsors`
--
ALTER TABLE `sponsors`
  ADD PRIMARY KEY (`sponsor_id`),
  ADD UNIQUE KEY `sponsor_code` (`sponsor_code`),
  ADD KEY `sponsor_type_id` (`sponsor_type_id`),
  ADD KEY `idx_sponsor_name` (`sponsor_name`),
  ADD KEY `idx_industry` (`industry`);

--
-- Indexes for table `sponsor_types`
--
ALTER TABLE `sponsor_types`
  ADD PRIMARY KEY (`sponsor_type_id`),
  ADD UNIQUE KEY `type_name` (`type_name`),
  ADD KEY `idx_type_name` (`type_name`),
  ADD KEY `idx_sponsor_types_active` (`is_active`),
  ADD KEY `idx_sponsor_types_name` (`type_name`);

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
  MODIFY `account_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=293;

--
-- AUTO_INCREMENT for table `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `audit_log`
--
ALTER TABLE `audit_log`
  MODIFY `log_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=176;

--
-- AUTO_INCREMENT for table `competencies`
--
ALTER TABLE `competencies`
  MODIFY `competency_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `competency_progress`
--
ALTER TABLE `competency_progress`
  MODIFY `progress_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=83;

--
-- AUTO_INCREMENT for table `competency_types`
--
ALTER TABLE `competency_types`
  MODIFY `competency_type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `contact_info`
--
ALTER TABLE `contact_info`
  MODIFY `contact_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=400;

--
-- AUTO_INCREMENT for table `courses`
--
ALTER TABLE `courses`
  MODIFY `course_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `course_offerings`
--
ALTER TABLE `course_offerings`
  MODIFY `offering_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `course_pricing`
--
ALTER TABLE `course_pricing`
  MODIFY `pricing_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

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
  MODIFY `preference_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=134;

--
-- AUTO_INCREMENT for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `token_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `payment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

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
  MODIFY `person_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=293;

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
-- AUTO_INCREMENT for table `scholarships`
--
ALTER TABLE `scholarships`
  MODIFY `scholarship_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `sponsors`
--
ALTER TABLE `sponsors`
  MODIFY `sponsor_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `sponsor_types`
--
ALTER TABLE `sponsor_types`
  MODIFY `sponsor_type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `staff`
--
ALTER TABLE `staff`
  MODIFY `staff_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `student_accounts`
--
ALTER TABLE `student_accounts`
  MODIFY `account_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=101;

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
  MODIFY `enrollment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=109;

--
-- AUTO_INCREMENT for table `student_fees`
--
ALTER TABLE `student_fees`
  MODIFY `student_fee_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_goals`
--
ALTER TABLE `student_goals`
  MODIFY `goal_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

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
  MODIFY `scholarship_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

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
-- Constraints for table `competency_progress`
--
ALTER TABLE `competency_progress`
  ADD CONSTRAINT `fk_competency_progress_competency` FOREIGN KEY (`competency_id`) REFERENCES `competencies` (`competency_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_competency_progress_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE;

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
-- Constraints for table `scholarships`
--
ALTER TABLE `scholarships`
  ADD CONSTRAINT `scholarships_ibfk_1` FOREIGN KEY (`sponsor_id`) REFERENCES `sponsors` (`sponsor_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `scholarships_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `scholarships_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `accounts` (`account_id`) ON DELETE SET NULL ON UPDATE CASCADE;

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
