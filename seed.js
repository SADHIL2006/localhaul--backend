// scripts/seed.js  –  Run once: npm run seed
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcrypt');
const db     = require('../config/db');

const SALT = 10;

async function seed() {
  console.log('🌱  Seeding demo data...');

  const demoHash  = await bcrypt.hash('demo123',  SALT);
  const adminHash = await bcrypt.hash('admin123', SALT);

  // ── Users ──────────────────────────────────────────────────────────────────
  const users = [
    ['U001','Demo','Sender',  'sender@demo.com',  demoHash,  '9000000001','sender', null,  1, 0.0, 0,  '2025-01-15'],
    ['U002','Rahul','Menon',  'partner@demo.com', demoHash,  '9000000002','partner','car', 1, 4.7, 12, '2025-01-10'],
    ['U003','Admin','User',   'admin@demo.com',   adminHash, '9000000003','admin',  null,  1, 0.0, 0,  '2025-01-01'],
    ['U004','Priya','Nair',   'priya@demo.com',   demoHash,  '9000000004','partner','bike',1, 0.0, 0,  '2025-03-01'],
    ['U005','Arun','Das',     'arun@demo.com',    demoHash,  '9000000005','partner','van', 1, 4.9, 28, '2024-12-20'],
  ];
  for (const u of users) {
    await db.query(
      `INSERT INTO users (id,fn,ln,email,pass_hash,phone,role,vehicle,verified,rating,trips,joined)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE pass_hash=VALUES(pass_hash)`, u
    );
  }
  console.log('  ✅  Users seeded');

  // ── Deliveries ─────────────────────────────────────────────────────────────
  const deliveries = [
    ['LH-0001','U001','U002','Ernakulam','Thrissur',    74,  3.2, 'Documents',    'car', 'delivered',185,'Suresh K','9100001111',''],
    ['LH-0002','U001', null, 'Kochi',    'Alappuzha',   54,  1.8, 'Clothing',     'bike','pending',  120,'Anjali R','9100002222','Fragile'],
    ['LH-0003','U001','U005','Palakkad', 'Coimbatore',  55,  18,  'Machine parts','van', 'active',   420,'Dinesh M','9100003333','Heavy'],
    ['LH-0004','U001', null, 'Calicut',  'Malappuram',  38,  0.5, 'Books',        'bike','pending',   75,'Faisal A','9100004444',''],
  ];
  for (const d of deliveries) {
    await db.query(
      `INSERT INTO deliveries (id,sid,pid,from_loc,to_loc,dist,wt,description,vehicle,status,price,rname,rphone,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE status=VALUES(status)`, d
    );
  }
  console.log('  ✅  Deliveries seeded');

  // ── Payments ───────────────────────────────────────────────────────────────
  const payments = [
    ['LH-0001','U001',185,'upi', 'completed','2025-03-10 10:30:00'],
    ['LH-0002','U001',120,'cash','pending',   null],
    ['LH-0003','U001',420,'card','completed','2025-03-14 09:30:00'],
    ['LH-0004','U001', 75,'cash','pending',   null],
  ];
  for (const p of payments) {
    await db.query(
      `INSERT INTO payments (delivery_id,user_id,amount,method,status,paid_at)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE status=VALUES(status)`, p
    );
  }
  console.log('  ✅  Payments seeded');

  // ── Tracking ───────────────────────────────────────────────────────────────
  const tracking = [
    ['LH-0001','requested',       'Ernakulam','Delivery requested',    'U001'],
    ['LH-0001','partner_assigned','Ernakulam','Partner assigned',       'U002'],
    ['LH-0001','picked_up',       'Ernakulam','Package picked up',      'U002'],
    ['LH-0001','in_transit',      'Chalakudy','On the way',             'U002'],
    ['LH-0001','delivered',       'Thrissur', 'Delivered successfully', 'U002'],
    ['LH-0002','requested',       'Kochi',    'Delivery requested',     'U001'],
    ['LH-0003','requested',       'Palakkad', 'Delivery requested',     'U001'],
    ['LH-0003','partner_assigned','Palakkad', 'Partner assigned',       'U005'],
    ['LH-0003','picked_up',       'Palakkad', 'Package picked up',      'U005'],
    ['LH-0004','requested',       'Calicut',  'Delivery requested',     'U001'],
  ];
  for (const t of tracking) {
    await db.query(
      `INSERT IGNORE INTO tracking (delivery_id,status,location,note,updated_by)
       VALUES (?,?,?,?,?)`, t
    );
  }
  console.log('  ✅  Tracking seeded');

  // ── Ratings ────────────────────────────────────────────────────────────────
  await db.query(
    `INSERT IGNORE INTO ratings (delivery_id,sender_id,partner_id,stars,comment)
     VALUES ('LH-0001','U001','U002',5,'Excellent service! Very fast delivery.')`
  );
  console.log('  ✅  Ratings seeded');

  // ── Notifications ──────────────────────────────────────────────────────────
  const notifs = [
    ['U001','Delivery Accepted', 'Your delivery LH-0001 has been accepted by Rahul Menon','success',1,'LH-0001'],
    ['U001','Package Picked Up', 'Your package LH-0001 has been picked up',               'info',   1,'LH-0001'],
    ['U001','Delivery Complete', 'Your delivery LH-0001 has been delivered successfully!','success',1,'LH-0001'],
    ['U002','New Job Available', 'New job: Ernakulam to Thrissur (₹185)',                 'info',   1,'LH-0001'],
    ['U001','Delivery Accepted', 'Your delivery LH-0003 has been accepted by Arun Das',  'success',0,'LH-0003'],
    ['U005','New Job Available', 'New job: Palakkad to Coimbatore (₹420)',               'info',   1,'LH-0003'],
  ];
  for (const n of notifs) {
    await db.query(
      `INSERT IGNORE INTO notifications (user_id,title,message,type,is_read,delivery_id)
       VALUES (?,?,?,?,?,?)`, n
    );
  }
  console.log('  ✅  Notifications seeded');

  console.log('\n🎉  Seed complete!');
  console.log('   sender@demo.com   / demo123');
  console.log('   partner@demo.com  / demo123');
  console.log('   admin@demo.com    / admin123');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});

