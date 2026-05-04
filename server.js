require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const db = require('./config/database');

const cookieParser = require('cookie-parser');
const { protect } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Set up view engine
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
// Production Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for chart.js and CDNs compatibility
}));
app.use(compression());
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiting for Login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login requests per windowMs
  message: 'محاولات دخول كثيرة جداً، يرجى المحاولة لاحقاً'
});

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
const authRoutes = require('./routes/auth');
app.use('/login', loginLimiter); // Apply rate limit to login
app.use('/', authRoutes);

app.get('/', protect, (req, res) => {
  const stats = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM leads) as totalLeads,
      (SELECT COUNT(DISTINCT salesman_name) FROM leads) as totalSalesmen,
      (SELECT COUNT(*) FROM uploads) as totalReports
  `).get();
  
  const latestLeads = db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 10').all();
  
  res.render('dashboard', { stats, latestLeads, page: 'dashboard' });
});

app.get('/upload', protect, (req, res) => {
  res.render('upload', { page: 'upload' });
});

const reportRoutes = require('./routes/reports');
const analyticsRoutes = require('./routes/analytics');
app.use('/reports', protect, reportRoutes);
app.use('/analytics', protect, analyticsRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`-------------------------------------------`);
  console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`-------------------------------------------`);
});
