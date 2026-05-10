const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../config/database');
const path = require('path');

const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.array('reports'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send('No files uploaded.');
  }

  try {
    const reportDate = req.body.report_date || new Date().toISOString().split('T')[0];
    const insertUpload = db.prepare('INSERT INTO uploads (filename, original_name, report_date, total_leads) VALUES (?, ?, ?, ?)');
    const insertLead = db.prepare(`
      INSERT INTO leads (
        upload_id, request_creation_date, salesman_name, state, last_action, 
        note, name, email, mobile, unit_type, campaign, channel, lead_id, next_action_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((files) => {
      for (const file of files) {
        const workbook = XLSX.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet);

        // Filter out blank/empty rows (where Name, Mobile, and Salesman are all blank)
        const data = rawData.filter(lead => {
          const name = lead['Name'] || lead['الاسم'];
          const mobile = lead['Mobile'] || lead['الموبايل'];
          const salesman = lead['Salesman Name'] || lead['اسم البائع'];
          return (name && String(name).trim() !== '') || 
                 (mobile && String(mobile).trim() !== '') || 
                 (salesman && String(salesman).trim() !== '');
        });

        const info = insertUpload.run(file.filename, file.originalname, reportDate, data.length);
        const uploadId = info.lastInsertRowid;

        for (const lead of data) {
          insertLead.run(
            uploadId,
            lead['Request Creation Date'] || lead['تاريخ الإنشاء'] || '-',
            lead['Salesman Name'] || lead['اسم البائع'] || 'غير معروف',
            lead['State'] || lead['الحالة'] || 'جديد',
            lead['Last Action'] || lead['آخر إجراء'] || '-',
            lead['Note'] || lead['ملاحظة'] || '-',
            lead['Name'] || lead['الاسم'] || 'بدون اسم',
            lead['Email'] || lead['البريد الإلكتروني'] || '-',
            lead['Mobile'] || lead['الموبايل'] || '-',
            lead['Unit-Type'] || lead['نوع الوحدة'] || '-',
            lead['Campaign'] || lead['الحملة'] || 'غير محددة',
            lead['Channel'] || lead['القناة'] || 'غير محددة',
            lead['Lead ID'] || lead['رقم العميل'] || '-',
            lead['Next Action Date'] || lead['موعد الإجراء القادم'] || '-'
          );
        }
      }
    });

    transaction(req.files);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error processing files.');
  }
});

router.get('/view/:id', (req, res) => {
  const uploadId = req.params.id;
  const report = db.prepare('SELECT * FROM uploads WHERE id = ?').get(uploadId);
  const leads = db.prepare('SELECT * FROM leads WHERE upload_id = ?').all(uploadId);
  
  // Calculate stats for this specific report
  const summary = db.prepare(`
    SELECT 
      salesman_name,
      COUNT(*) as total,
      COUNT(CASE WHEN LOWER(state) LIKE '%fresh%' THEN 1 END) as my_fresh,
      COUNT(CASE WHEN LOWER(state) LIKE '%call%back%' THEN 1 END) as callback,
      COUNT(CASE WHEN LOWER(state) LIKE 'follow up%' AND LOWER(state) NOT LIKE '%follow%up%low%' THEN 1 END) as follow_up,
      COUNT(CASE WHEN LOWER(state) = 'eoi' THEN 1 END) as eoi,
      COUNT(CASE WHEN LOWER(state) = 'hot case' THEN 1 END) as hot_case,
      COUNT(CASE WHEN LOWER(state) LIKE '%follow%up%low%' THEN 1 END) as follow_up_low,
      COUNT(CASE WHEN LOWER(state) = 'done deal' THEN 1 END) as done_deal,
      COUNT(CASE WHEN LOWER(state) = 'prospect' THEN 1 END) as prospect,
      COUNT(CASE WHEN LOWER(state) = 'meeting' THEN 1 END) as meeting,
      COUNT(CASE WHEN LOWER(state) LIKE '%schedule%meeting%' THEN 1 END) as schedule_meeting,
      COUNT(CASE WHEN LOWER(state) LIKE '%not%inter%' THEN 1 END) as not_interested,
      COUNT(CASE WHEN LOWER(state) LIKE '%wrong%number%' THEN 1 END) as wrong_number
    FROM leads 
    WHERE upload_id = ?
    GROUP BY salesman_name
  `).all(uploadId);

  // Calculate campaign stats for this report
  const campaignSummary = db.prepare(`
    SELECT 
      channel,
      campaign,
      COUNT(*) as total,
      COUNT(CASE WHEN LOWER(state) LIKE '%fresh%' THEN 1 END) as my_fresh,
      COUNT(CASE WHEN LOWER(state) LIKE '%call%back%' THEN 1 END) as callback,
      COUNT(CASE WHEN LOWER(state) LIKE 'follow up%' AND LOWER(state) NOT LIKE '%follow%up%low%' THEN 1 END) as follow_up,
      COUNT(CASE WHEN LOWER(state) = 'eoi' THEN 1 END) as eoi,
      COUNT(CASE WHEN LOWER(state) = 'hot case' THEN 1 END) as hot_case,
      COUNT(CASE WHEN LOWER(state) LIKE '%follow%up%low%' THEN 1 END) as follow_up_low,
      COUNT(CASE WHEN LOWER(state) = 'done deal' THEN 1 END) as done_deal,
      COUNT(CASE WHEN LOWER(state) = 'prospect' THEN 1 END) as prospect,
      COUNT(CASE WHEN LOWER(state) = 'meeting' THEN 1 END) as meeting,
      COUNT(CASE WHEN LOWER(state) LIKE '%schedule%meeting%' THEN 1 END) as schedule_meeting,
      COUNT(CASE WHEN LOWER(state) LIKE '%not%inter%' THEN 1 END) as not_interested,
      COUNT(CASE WHEN LOWER(state) LIKE '%wrong%number%' THEN 1 END) as wrong_number
    FROM leads 
    WHERE upload_id = ?
    GROUP BY channel, campaign
  `).all(uploadId);

  res.render('report_details', { report, leads, summary, campaignSummary, page: 'history' });
});

router.get('/history', (req, res) => {
  const reports = db.prepare('SELECT * FROM uploads ORDER BY report_date DESC, uploaded_at DESC').all();
  res.render('history', { reports, page: 'history' });
});

// Delete a report
router.post('/delete/:id', (req, res) => {
    const { id } = req.params;
    const deleteLeads = db.prepare('DELETE FROM leads WHERE upload_id = ?');
    const deleteReport = db.prepare('DELETE FROM uploads WHERE id = ?');
    
    const transaction = db.transaction(() => {
        deleteLeads.run(id);
        deleteReport.run(id);
    });
    
    transaction();
    res.redirect('/reports/history');
});

// Delete ALL reports (or reports up to a specific date)
router.post('/delete-all', (req, res) => {
    const { targetDate } = req.body;
    
    const transaction = db.transaction(() => {
        if (targetDate) {
            // Delete all reports up to and including the specific date
            const reportIds = db.prepare('SELECT id FROM uploads WHERE report_date <= ?').all(targetDate).map(r => r.id);
            if (reportIds.length > 0) {
                const placeholders = reportIds.map(() => '?').join(',');
                db.prepare(`DELETE FROM leads WHERE upload_id IN (${placeholders})`).run(...reportIds);
                db.prepare(`DELETE FROM uploads WHERE id IN (${placeholders})`).run(...reportIds);
            }
        } else {
            // Delete everything
            db.prepare('DELETE FROM leads').run();
            db.prepare('DELETE FROM uploads').run();
        }
    });
    
    transaction();
    res.redirect('/reports/history');
});

module.exports = router;
