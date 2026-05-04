require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const expressLayouts = require('express-ejs-layouts');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Set up view engine
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for Excel uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Routes
app.get('/', (req, res) => {
  const stats = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM leads) as totalLeads,
      (SELECT COUNT(DISTINCT salesman_name) FROM leads) as totalSalesmen,
      (SELECT COUNT(*) FROM uploads) as totalReports
  `).get();
  
  const latestLeads = db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 10').all();
  
  res.render('dashboard', { stats, latestLeads, page: 'dashboard' });
});

app.get('/upload', (req, res) => {
  res.render('upload', { page: 'upload' });
});

const reportRoutes = require('./routes/reports');
const analyticsRoutes = require('./routes/analytics');
app.use('/reports', reportRoutes);
app.use('/analytics', analyticsRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`-------------------------------------------`);
  console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`-------------------------------------------`);
});
