-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 17, 2025 at 05:56 AM
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
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_calculate_student_eligibility` (IN `p_student_id` VARCHAR(20), IN `p_course_id` INT, OUT `p_eligibility_status` VARCHAR(20), OUT `p_eligibility_score` DECIMAL(5,2))   BEGIN
    DECLARE v_total_weight DECIMAL(5,2) DEFAULT 0;
    DECLARE v_achieved_weight DECIMAL(5,2) DEFAULT 0;
    DECLARE v_mandatory_failed BOOLEAN DEFAULT FALSE;
    
    -- Calculate weighted eligibility score
    SELECT 
        SUM(cer.weight_override) as total_weight,
        SUM(CASE 
            WHEN sea.assessment_status = 'meets_criteria' THEN cer.weight_override
            WHEN sea.assessment_status = 'exempted' THEN cer.weight_override
            ELSE 0 
        END) as achieved_weight,
        MAX(CASE 
            WHEN cer.is_required = TRUE AND sea.assessment_status NOT IN ('meets_criteria', 'exempted') THEN TRUE
            ELSE FALSE 
        END) as mandatory_failed
    INTO v_total_weight, v_achieved_weight, v_mandatory_failed
    FROM course_eligibility_requirements cer
    LEFT JOIN student_eligibility_assessments sea ON cer.criteria_id = sea.criteria_id AND sea.student_id = p_student_id
    WHERE cer.course_id = p_course_id;
    
    -- Calculate percentage score
    IF v_total_weight > 0 THEN
        SET p_eligibility_score = (v_achieved_weight / v_total_weight) * 100;
    ELSE
        SET p_eligibility_score = 100.00;
    END IF;
    
    -- Determine eligibility status
    IF v_mandatory_failed = TRUE THEN
        SET p_eligibility_status = 'not_eligible';
    ELSEIF p_eligibility_score >= 80.00 THEN
        SET p_eligibility_status = 'eligible';
    ELSE
        SET p_eligibility_status = 'pending';
    END IF;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_enroll_student` (IN `p_student_id` VARCHAR(20), IN `p_offering_id` INT, IN `p_pricing_type` ENUM('regular','early_bird','group','scholarship','special'), OUT `p_result` VARCHAR(100))   BEGIN
    DECLARE v_max_enrollees INT;
    DECLARE v_current_enrollees INT;
    DECLARE v_pricing_amount DECIMAL(10,2);
    DECLARE v_account_id INT;
    DECLARE v_enrollment_id INT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'ERROR: Enrollment failed due to database error';
    END;
    
    START TRANSACTION;
    
    -- Check if offering has available slots
    SELECT max_enrollees, current_enrollees 
    INTO v_max_enrollees, v_current_enrollees
    FROM course_offerings 
    WHERE offering_id = p_offering_id AND status = 'active';
    
    IF v_current_enrollees >= v_max_enrollees THEN
        SET p_result = 'ERROR: Course offering is full';
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
            SET p_result = 'ERROR: Pricing not found for selected type';
            ROLLBACK;
        ELSE
            -- Create enrollment
            INSERT INTO student_enrollments (student_id, offering_id)
            VALUES (p_student_id, p_offering_id);
            
            SET v_enrollment_id = LAST_INSERT_ID();
            
            -- Create student account
            INSERT INTO student_accounts (student_id, offering_id, total_due)
            VALUES (p_student_id, p_offering_id, v_pricing_amount);
            
            -- Update current enrollees count
            UPDATE course_offerings 
            SET current_enrollees = current_enrollees + 1
            WHERE offering_id = p_offering_id;
            
            SET p_result = CONCAT('SUCCESS: Student enrolled with enrollment ID ', v_enrollment_id);
            COMMIT;
        END IF;
    END IF;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_process_payment` (IN `p_account_id` INT, IN `p_method_id` INT, IN `p_payment_amount` DECIMAL(10,2), IN `p_reference_number` VARCHAR(50), IN `p_processed_by` INT, OUT `p_result` VARCHAR(100))   BEGIN
    DECLARE v_balance DECIMAL(10,2);
    DECLARE v_payment_id INT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'ERROR: Payment processing failed';
    END;
    
    START TRANSACTION;
    
    -- Check account balance
    SELECT balance INTO v_balance
    FROM student_accounts 
    WHERE account_id = p_account_id;
    
    IF p_payment_amount > v_balance THEN
        SET p_result = 'ERROR: Payment amount exceeds outstanding balance';
        ROLLBACK;
    ELSE
        -- Insert payment record
        INSERT INTO payments (account_id, method_id, payment_amount, reference_number, processed_by, payment_status)
        VALUES (p_account_id, p_method_id, p_payment_amount, p_reference_number, p_processed_by, 'confirmed');
        
        SET v_payment_id = LAST_INSERT_ID();
        
        -- Update student account
        UPDATE student_accounts 
        SET amount_paid = amount_paid + p_payment_amount,
            last_payment_date = CURRENT_DATE,
            account_status = CASE WHEN (amount_paid + p_payment_amount) >= total_due THEN 'paid' ELSE 'active' END
        WHERE account_id = p_account_id;
        
        SET p_result = CONCAT('SUCCESS: Payment processed with ID ', v_payment_id);
        COMMIT;
    END IF;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_register_user_with_synced_ids` (IN `p_username` VARCHAR(15), IN `p_password_hash` VARCHAR(255), IN `p_first_name` VARCHAR(50), IN `p_middle_name` VARCHAR(50), IN `p_last_name` VARCHAR(50), IN `p_birth_date` DATE, IN `p_birth_place` VARCHAR(100), IN `p_gender` ENUM('Male','Female','Other'), IN `p_email` VARCHAR(100), IN `p_education` VARCHAR(100), IN `p_phone_no` VARCHAR(15), IN `p_address` TEXT, IN `p_role_name` VARCHAR(50), OUT `p_account_id` INT, OUT `p_result` VARCHAR(100))   BEGIN
    DECLARE v_role_id INT;
    DECLARE v_person_id INT;
    DECLARE v_student_id VARCHAR(20);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'ERROR: Registration failed';
        SET p_account_id = NULL;
    END;

    START TRANSACTION;

    -- Create account first
    INSERT INTO accounts (username, password_hash, token, account_status)
    VALUES (p_username, p_password_hash, '', 'active');
    
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
            
            IF p_email IS NOT NULL THEN
                INSERT INTO contact_info (person_id, student_id, contact_type, contact_value, is_primary)
                VALUES (p_account_id, v_student_id, 'email', p_email, 1);
            END IF;
            
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
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `accounts`
--

CREATE TABLE `accounts` (
  `account_id` int(11) NOT NULL,
  `username` varchar(15) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `account_status` enum('active','inactive','suspended') DEFAULT 'active',
  `last_login` timestamp NULL DEFAULT NULL,
  `failed_login_attempts` int(11) DEFAULT 0,
  `locked_until` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `accounts`
--

INSERT INTO `accounts` (`account_id`, `username`, `password_hash`, `token`, `account_status`, `last_login`, `failed_login_attempts`, `locked_until`, `created_at`, `updated_at`) VALUES
(8, 'janesmith85', '$2a$12$W8YsEd6wAAfxevFI.GwcweULIZHV5trLIKzAL2N.q8WWt8/bsPylW', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjgsInVzZXJuYW1lIjoiamFuZXNtaXRoODUiLCJyb2xlIjoic3RhZmYiLCJpYXQiOjE3NDk2OTUyMTEsImV4cCI6MTc0OTc4MTYxMX0.json_S-oZ7wkV8HLjKhAxHNeQIEtdZo6mcJlhfHjNtE', 'active', '2025-06-12 04:37:32', 0, NULL, '2025-06-12 02:26:51', '2025-06-12 04:37:32'),
(9, 'janesmith20', '$2a$12$6tuEYRIpBwsBE66.1afYCuewfEfU9GVkDoeiO1uPirLQ9B1qdtksu', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjksInVzZXJuYW1lIjoiamFuZXNtaXRoMjAiLCJyb2xlIjoic3RhZmYiLCJpYXQiOjE3NDk3ODY0MTcsImV4cCI6MTc0OTg3MjgxN30.JBJnniKh4rD9IuvnLhHL2zYYx2Ic895nbAr1TbXNYkk', 'active', '2025-06-13 03:46:57', 0, NULL, '2025-06-12 04:40:18', '2025-06-13 03:46:57'),
(10, 'janesmith21', '$2b$12$oQI.A8XG5pPZtDzyhTQ0J.DSEeNzs7g8qYuG9UP6/ryrb9GLJsf1u', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEwLCJ1c2VybmFtZSI6ImphbmVzbWl0aDIxIiwicm9sZSI6InN0YWZmIiwiaWF0IjoxNzQ5Nzg3MTgxLCJleHAiOjE3NDk4NzM1ODF9.TcZujI-oI3CSWBaTrDsnHEpXY6uBLZXmGoNtqBS_nl8', 'active', NULL, 0, NULL, '2025-06-13 03:59:40', '2025-06-13 03:59:41'),
(13, 'johndoe123', '$2b$12$WKbua14t/EIfUOhWgG3vA.nEZfZCyC0RONabHe/0ecJFFqMKwbT7O', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEzLCJ1c2VybmFtZSI6ImpvaG5kb2UxMjMiLCJyb2xlIjoic3R1ZGVudCIsImlhdCI6MTc1MDEzMjQzOCwiZXhwIjoxNzUwMjE4ODM4fQ.VtQea8KITM11m9Mj78ndD7x7g-bP0RRtTSV0yYW2WAU', 'active', '2025-06-17 03:53:58', 0, NULL, '2025-06-13 04:50:42', '2025-06-17 03:53:58');

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
(8, 2, '2025-06-12 02:26:51', NULL, 1, NULL),
(9, 2, '2025-06-12 04:40:18', NULL, 1, NULL),
(10, 2, '2025-06-13 03:59:40', NULL, 1, NULL),
(13, 3, '2025-06-13 04:50:42', NULL, 1, NULL);

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
(6, 13, 'profile_updated', 'User profile was updated', NULL, NULL, NULL, '2025-06-16 09:01:43');

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
(3, 'students', 'UPDATE', 'S1749790242780_13', '{\"graduation_status\": \"enrolled\", \"gpa\": null, \"academic_standing\": \"good\"}', '{\"graduation_status\": \"enrolled\", \"gpa\": null, \"academic_standing\": \"good\"}', 13, NULL, NULL, NULL, '2025-06-16 07:36:12');

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
(1, 1, 'BASIC001', 'Trading Fundamentals', 'Understanding basic trading concepts and terminology', NULL, NULL, 1.00, NULL, 1),
(2, 1, 'BASIC002', 'Market Analysis', 'Introduction to technical and fundamental analysis', NULL, NULL, 1.00, NULL, 1),
(3, 2, 'COMM001', 'Risk Management', 'Understanding and implementing risk management strategies', NULL, NULL, 1.00, NULL, 1),
(4, 2, 'COMM002', 'Portfolio Construction', 'Building and managing investment portfolios', NULL, NULL, 1.00, NULL, 1),
(5, 3, 'CORE001', 'Advanced Strategies', 'Complex trading strategies and execution', NULL, NULL, 1.00, NULL, 1),
(6, 3, 'CORE002', 'Quantitative Analysis', 'Statistical and mathematical analysis methods', NULL, NULL, 1.00, NULL, 1);

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
(1, 13, 'S1749790242780_13', 'phone', '09234567890', 1, 0, '2025-06-13 04:50:42', '2025-06-16 09:01:43'),
(2, 13, 'S1749790242780_13', 'address', '123 Main Street, New York, NY', 1, 0, '2025-06-13 04:50:42', '2025-06-16 09:01:43'),
(3, 13, 'S1749790242780_13', 'email', 'johndoe@gmail.com', 1, 0, '2025-06-13 04:50:42', '2025-06-16 09:01:43');

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
(2, 'Form 137', 'Official academic transcript', 'academic', 1, 'enrollment', 10, 'pdf,jpg,jpeg,png,doc,docx', 7, 1, 1, '2025-06-12 01:17:29'),
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
(4, 'Technology Fee', 'Platform and software access', 'technology', 800.00, 1, 0, 'all', 1, '2025-06-12 01:17:29');

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
(1, 'S1749790242780_13', '', 'hybrid', 'Desktop,Mobile', NULL, 'flexible', NULL, NULL, '2025-06-13 04:50:42', '2025-06-16 08:28:58');

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
(3, 'Special Payment', 'Customized payment arrangement', 1, 5.00, 0.00, 5.00, 7, 1, '2025-06-12 01:17:29');

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
  `gender` enum('Male','Female','Other') NOT NULL,
  `email` varchar(100) NOT NULL,
  `education` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `persons`
--

INSERT INTO `persons` (`person_id`, `first_name`, `middle_name`, `last_name`, `birth_date`, `birth_place`, `gender`, `email`, `education`, `created_at`, `updated_at`) VALUES
(8, 'Jane', 'Elizabeth', 'Smith', '1985-05-20', 'San Francisco, CA', 'Female', 'jane.smith@example.com', 'Bachelor of Science in Library Science', '2025-06-12 02:26:51', '2025-06-12 02:26:51'),
(9, 'Jane', 'Elizabeth', 'Smith', '1985-05-20', 'San Francisco, CA', 'Female', 'janes.smith@example.com', 'Bachelor of Science in Library Science', '2025-06-12 04:40:18', '2025-06-12 04:40:18'),
(10, 'Janice', 'Elizabeth', 'Smith', '1985-05-20', 'San Francisco, CA', 'Female', 'janessmith@gmail.com', 'Bachelor of Science in Library Science', '2025-06-13 03:59:40', '2025-06-13 03:59:40'),
(13, 'John', 'Michael Doja', 'Catering', '1990-05-04', 'Marilao Bulacan', 'Male', 'johndoe@gmail.com', 'Bachelor\'s Degree', '2025-06-13 04:50:42', '2025-06-16 09:01:43');

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
(4, 'instructor', 'Course Instructor', '{\"students\": \"read\", \"courses\": \"read_write\", \"progress\": \"read_write\"}', 1, '2025-06-12 01:17:28');

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
(4, 'OJT Program', 'On-the-job training sponsorship', 75.00, NULL, 1, 'quarterly', 1, '2025-06-12 01:17:29');

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

--
-- Dumping data for table `staff`
--

INSERT INTO `staff` (`staff_id`, `person_id`, `account_id`, `employee_id`, `hire_date`, `termination_date`, `employment_status`, `emergency_contact`, `notes`) VALUES
(1, 8, 8, 'EMP1749695211711', '2025-06-12', NULL, 'active', NULL, NULL),
(2, 9, 9, 'EMP1749703218926', '2025-06-12', NULL, 'active', NULL, NULL),
(3, 10, 10, 'EMP1749787180992', '2025-06-13', NULL, 'active', NULL, NULL);

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
('S1749790242780_13', 13, 13, '2025-06-13', 'enrolled', NULL, NULL, 'good', NULL);

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
  `completion_date` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `final_grade` decimal(5,2) DEFAULT NULL,
  `completion_percentage` decimal(5,2) DEFAULT 0.00,
  `attendance_percentage` decimal(5,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
('S1749790242780_13', 1, '2025-06-13 04:50:42', NULL, NULL, 'exam', 0, NULL),
('S1749790242780_13', 1, '2025-06-16 08:09:26', NULL, NULL, 'exam', 0, NULL),
('S1749790242780_13', 1, '2025-06-16 08:23:57', NULL, NULL, 'exam', 0, NULL),
('S1749790242780_13', 1, '2025-06-16 08:27:38', NULL, NULL, 'exam', 0, NULL),
('S1749790242780_13', 1, '2025-06-16 08:28:42', NULL, NULL, 'exam', 0, NULL),
('S1749790242780_13', 1, '2025-06-16 08:28:49', NULL, NULL, 'exam', 0, NULL),
('S1749790242780_13', 1, '2025-06-16 08:28:58', NULL, NULL, 'exam', 0, NULL),
('S1749790242780_13', 1, '2025-06-16 08:41:06', NULL, NULL, 'exam', 0, NULL),
('S1749790242780_13', 1, '2025-06-16 09:01:43', NULL, NULL, 'exam', 1, NULL);

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
(1, 'Beginner', 'New to trading, learning basic concepts', 0.00, NULL, 8, 10000.00, 'medium'),
(2, 'Intermediate', 'Has basic knowledge, developing strategies', 70.00, 1, 12, 50000.00, 'medium'),
(3, 'Advanced', 'Experienced trader with proven track record', 85.00, 2, 16, 200000.00, 'medium');

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
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `idx_username` (`username`),
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
  ADD UNIQUE KEY `unique_student_offering` (`student_id`,`offering_id`),
  ADD KEY `offering_id` (`offering_id`),
  ADD KEY `idx_enrollment_date` (`enrollment_date`),
  ADD KEY `idx_enrollment_status` (`enrollment_status`),
  ADD KEY `idx_student_enrollments_status` (`enrollment_status`);

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
  MODIFY `account_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `audit_log`
--
ALTER TABLE `audit_log`
  MODIFY `log_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `competencies`
--
ALTER TABLE `competencies`
  MODIFY `competency_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `competency_types`
--
ALTER TABLE `competency_types`
  MODIFY `competency_type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `contact_info`
--
ALTER TABLE `contact_info`
  MODIFY `contact_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `courses`
--
ALTER TABLE `courses`
  MODIFY `course_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `course_offerings`
--
ALTER TABLE `course_offerings`
  MODIFY `offering_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `course_pricing`
--
ALTER TABLE `course_pricing`
  MODIFY `pricing_id` int(11) NOT NULL AUTO_INCREMENT;

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
  MODIFY `fee_type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `learning_preferences`
--
ALTER TABLE `learning_preferences`
  MODIFY `preference_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `token_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `payment_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payment_methods`
--
ALTER TABLE `payment_methods`
  MODIFY `method_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `payment_schemes`
--
ALTER TABLE `payment_schemes`
  MODIFY `scheme_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `persons`
--
ALTER TABLE `persons`
  MODIFY `person_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

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
  MODIFY `role_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `sponsors`
--
ALTER TABLE `sponsors`
  MODIFY `sponsor_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sponsor_types`
--
ALTER TABLE `sponsor_types`
  MODIFY `sponsor_type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `staff`
--
ALTER TABLE `staff`
  MODIFY `staff_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `student_accounts`
--
ALTER TABLE `student_accounts`
  MODIFY `account_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_backgrounds`
--
ALTER TABLE `student_backgrounds`
  MODIFY `background_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_documents`
--
ALTER TABLE `student_documents`
  MODIFY `document_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_eligibility_assessments`
--
ALTER TABLE `student_eligibility_assessments`
  MODIFY `assessment_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_enrollments`
--
ALTER TABLE `student_enrollments`
  MODIFY `enrollment_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_fees`
--
ALTER TABLE `student_fees`
  MODIFY `student_fee_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_goals`
--
ALTER TABLE `student_goals`
  MODIFY `goal_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_progress`
--
ALTER TABLE `student_progress`
  MODIFY `progress_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_referrals`
--
ALTER TABLE `student_referrals`
  MODIFY `referral_id` int(11) NOT NULL AUTO_INCREMENT;

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
  MODIFY `level_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

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
