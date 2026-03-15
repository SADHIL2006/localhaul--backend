-- =====================================================
-- LocalHaul MySQL Schema — 7 Tables
-- Run: Get-Content schema.sql | mysql -u root -p
-- =====================================================

CREATE DATABASE IF NOT EXISTS localhaul CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE localhaul;

-- ─────────────────────────────────────────
-- TABLE 1: USERS
-- Stores all users: senders, partners, admins
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(10)  PRIMARY KEY,
  fn          VARCHAR(60)  NOT NULL,
  ln          VARCHAR(60)  NOT NULL,
  email       VARCHAR(120) NOT NULL UNIQUE,
  pass_hash   VARCHAR(255) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  role        ENUM('sender','partner','admin') NOT NULL DEFAULT 'sender',
  vehicle     ENUM('bike','car','van')   DEFAULT NULL,
  verified    TINYINT(1)                 DEFAULT 1,
  rating      DECIMAL(3,1)               DEFAULT 0.0,
  trips       INT UNSIGNED               DEFAULT 0,
  joined      DATE         NOT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- TABLE 2: DELIVERIES
-- Stores all delivery requests/shipments
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliveries (
  id          VARCHAR(12)  PRIMARY KEY,
  sid         VARCHAR(10)  NOT NULL,
  pid         VARCHAR(10)  DEFAULT NULL,
  from_loc    VARCHAR(120) NOT NULL,
  to_loc      VARCHAR(120) NOT NULL,
  dist        DECIMAL(6,1) NOT NULL,
  wt          DECIMAL(6,2) NOT NULL,
  description TEXT         NOT NULL,
  vehicle     ENUM('bike','car','van') NOT NULL,
  status      ENUM('pending','active','delivered','cancelled') NOT NULL DEFAULT 'pending',
  price       DECIMAL(8,2) NOT NULL,
  rname       VARCHAR(120) NOT NULL,
  rphone      VARCHAR(20)  NOT NULL,
  notes       TEXT         DEFAULT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sid) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pid) REFERENCES users(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────
-- TABLE 3: PAYMENTS
-- Stores payment record for each delivery
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  delivery_id    VARCHAR(12)  NOT NULL UNIQUE,
  user_id        VARCHAR(10)  NOT NULL,
  amount         DECIMAL(8,2) NOT NULL,
  method         ENUM('cash','upi','card','wallet') NOT NULL DEFAULT 'cash',
  status         ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  transaction_id VARCHAR(100) DEFAULT NULL,
  paid_at        TIMESTAMP    DEFAULT NULL,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- TABLE 4: TRACKING
-- Stores live status updates for deliveries
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracking (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  delivery_id  VARCHAR(12)  NOT NULL,
  status       ENUM('requested','partner_assigned','picked_up','in_transit','delivered','cancelled') NOT NULL,
  location     VARCHAR(200) DEFAULT NULL,
  note         VARCHAR(255) DEFAULT NULL,
  updated_by   VARCHAR(10)  DEFAULT NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by)  REFERENCES users(id)      ON DELETE SET NULL
);

-- ─────────────────────────────────────────
-- TABLE 5: RATINGS
-- Stores ratings given to partners after delivery
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  delivery_id  VARCHAR(12)  NOT NULL UNIQUE,
  sender_id    VARCHAR(10)  NOT NULL,
  partner_id   VARCHAR(10)  NOT NULL,
  stars        TINYINT      NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment      TEXT         DEFAULT NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id)   REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (partner_id)  REFERENCES users(id)      ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- TABLE 6: NOTIFICATIONS
-- Stores alerts sent to users
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      VARCHAR(10)  NOT NULL,
  title        VARCHAR(120) NOT NULL,
  message      TEXT         NOT NULL,
  type         ENUM('info','success','warning','error') NOT NULL DEFAULT 'info',
  is_read      TINYINT(1)   DEFAULT 0,
  delivery_id  VARCHAR(12)  DEFAULT NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────
-- TABLE 7: REFRESH TOKENS
-- Stores JWT refresh tokens for auth
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(10)  NOT NULL,
  token      VARCHAR(512) NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- SEED DATA  (run "npm run seed" for proper hashes)
-- =====================================================
INSERT IGNORE INTO users (id,fn,ln,email,pass_hash,phone,role,vehicle,verified,rating,trips,joined)
VALUES
  ('U001','Demo','Sender',  'sender@demo.com', '$2b$10$PLACEHOLDER','9000000001','sender', NULL,  1,0.0, 0,'2025-01-15'),
  ('U002','Rahul','Menon',  'partner@demo.com','$2b$10$PLACEHOLDER','9000000002','partner','car', 1,4.7,12,'2025-01-10'),
  ('U003','Admin','User',   'admin@demo.com',  '$2b$10$PLACEHOLDER','9000000003','admin',  NULL,  1,0.0, 0,'2025-01-01'),
  ('U004','Priya','Nair',   'priya@demo.com',  '$2b$10$PLACEHOLDER','9000000004','partner','bike',1,0.0, 0,'2025-03-01'),
  ('U005','Arun','Das',     'arun@demo.com',   '$2b$10$PLACEHOLDER','9000000005','partner','van', 1,4.9,28,'2024-12-20');

INSERT IGNORE INTO deliveries (id,sid,pid,from_loc,to_loc,dist,wt,description,vehicle,status,price,rname,rphone,notes,created_at)
VALUES
  ('LH-0001','U001','U002','Ernakulam','Thrissur',  74, 3.2,'Documents',    'car', 'delivered',185,'Suresh K','9100001111','',       '2025-03-10 10:00:00'),
  ('LH-0002','U001',NULL,  'Kochi',    'Alappuzha', 54, 1.8,'Clothing',     'bike','pending',  120,'Anjali R','9100002222','Fragile','2025-03-13 14:00:00'),
  ('LH-0003','U001','U005','Palakkad', 'Coimbatore',55,18.0,'Machine parts','van', 'active',   420,'Dinesh M','9100003333','Heavy', '2025-03-14 09:00:00'),
  ('LH-0004','U001',NULL,  'Calicut',  'Malappuram',38, 0.5,'Books',        'bike','pending',   75,'Faisal A','9100004444','',       '2025-03-14 11:00:00');

INSERT IGNORE INTO payments (delivery_id,user_id,amount,method,status,paid_at)
VALUES
  ('LH-0001','U001',185,'upi', 'completed','2025-03-10 10:30:00'),
  ('LH-0002','U001',120,'cash','pending',   NULL),
  ('LH-0003','U001',420,'card','completed','2025-03-14 09:30:00'),
  ('LH-0004','U001', 75,'cash','pending',   NULL);

INSERT IGNORE INTO tracking (delivery_id,status,location,note,updated_by,created_at)
VALUES
  ('LH-0001','requested',       'Ernakulam','Delivery requested',     'U001','2025-03-10 10:00:00'),
  ('LH-0001','partner_assigned','Ernakulam','Partner assigned',        'U002','2025-03-10 10:05:00'),
  ('LH-0001','picked_up',       'Ernakulam','Package picked up',       'U002','2025-03-10 10:15:00'),
  ('LH-0001','in_transit',      'Chalakudy','On the way',              'U002','2025-03-10 11:00:00'),
  ('LH-0001','delivered',       'Thrissur', 'Delivered successfully',  'U002','2025-03-10 12:00:00'),
  ('LH-0002','requested',       'Kochi',    'Delivery requested',      'U001','2025-03-13 14:00:00'),
  ('LH-0003','requested',       'Palakkad', 'Delivery requested',      'U001','2025-03-14 09:00:00'),
  ('LH-0003','partner_assigned','Palakkad', 'Partner assigned',        'U005','2025-03-14 09:10:00'),
  ('LH-0003','picked_up',       'Palakkad', 'Package picked up',       'U005','2025-03-14 09:20:00'),
  ('LH-0004','requested',       'Calicut',  'Delivery requested',      'U001','2025-03-14 11:00:00');

INSERT IGNORE INTO ratings (delivery_id,sender_id,partner_id,stars,comment,created_at)
VALUES
  ('LH-0001','U001','U002',5,'Excellent service! Very fast delivery.','2025-03-10 13:00:00');

INSERT IGNORE INTO notifications (user_id,title,message,type,is_read,delivery_id,created_at)
VALUES
  ('U001','Delivery Accepted', 'Your delivery LH-0001 has been accepted by Rahul Menon',    'success',1,'LH-0001','2025-03-10 10:05:00'),
  ('U001','Package Picked Up', 'Your package LH-0001 has been picked up',                   'info',   1,'LH-0001','2025-03-10 10:15:00'),
  ('U001','Delivery Complete', 'Your delivery LH-0001 has been delivered successfully! ✅', 'success',1,'LH-0001','2025-03-10 12:00:00'),
  ('U002','New Job Available', 'New job: Ernakulam to Thrissur (₹185)',                      'info',   1,'LH-0001','2025-03-10 10:00:00'),
  ('U001','Delivery Accepted', 'Your delivery LH-0003 has been accepted by Arun Das',       'success',0,'LH-0003','2025-03-14 09:10:00'),
  ('U005','New Job Available', 'New job: Palakkad to Coimbatore (₹420)',                     'info',   1,'LH-0003','2025-03-14 09:00:00');
