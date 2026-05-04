const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/total', (req, res) => {
    const { startDate, endDate } = req.query;
    let dateFilter = '';
    const params = [];

    if (startDate && endDate) {
        dateFilter = 'WHERE u.report_date BETWEEN ? AND ?';
        params.push(startDate, endDate);
    }

    // Aggregate data from leads filtered by upload report_date
    const summary = db.prepare(`
        SELECT 
            l.salesman_name,
            COUNT(*) as total,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%fresh%' THEN 1 END) as my_fresh,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%call%back%' THEN 1 END) as callback,
            COUNT(CASE WHEN LOWER(l.state) LIKE 'follow up%' THEN 1 END) as follow_up,
            COUNT(CASE WHEN LOWER(l.state) = 'eoi' THEN 1 END) as eoi,
            COUNT(CASE WHEN LOWER(l.state) = 'hot case' THEN 1 END) as hot_case,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%follow%up%low%' THEN 1 END) as follow_up_low,
            COUNT(CASE WHEN LOWER(l.state) = 'done deal' THEN 1 END) as done_deal,
            COUNT(CASE WHEN LOWER(l.state) = 'prospect' THEN 1 END) as prospect,
            COUNT(CASE WHEN LOWER(l.state) = 'meeting' THEN 1 END) as meeting,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%schedule%meeting%' THEN 1 END) as schedule_meeting,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%not%inter%' THEN 1 END) as not_interested,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%wrong%number%' THEN 1 END) as wrong_number
        FROM leads l
        JOIN uploads u ON l.upload_id = u.id
        ${dateFilter}
        GROUP BY l.salesman_name
        ORDER BY total DESC
    `).all(...params);

    const campaignSummary = db.prepare(`
        SELECT 
            l.channel,
            l.campaign,
            COUNT(*) as total,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%fresh%' THEN 1 END) as my_fresh,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%call%back%' THEN 1 END) as callback,
            COUNT(CASE WHEN LOWER(l.state) LIKE 'follow up%' THEN 1 END) as follow_up,
            COUNT(CASE WHEN LOWER(l.state) = 'eoi' THEN 1 END) as eoi,
            COUNT(CASE WHEN LOWER(l.state) = 'hot case' THEN 1 END) as hot_case,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%follow%up%low%' THEN 1 END) as follow_up_low,
            COUNT(CASE WHEN LOWER(l.state) = 'done deal' THEN 1 END) as done_deal,
            COUNT(CASE WHEN LOWER(l.state) = 'prospect' THEN 1 END) as prospect,
            COUNT(CASE WHEN LOWER(l.state) = 'meeting' THEN 1 END) as meeting,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%schedule%meeting%' THEN 1 END) as schedule_meeting,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%not%inter%' THEN 1 END) as not_interested,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%wrong%number%' THEN 1 END) as wrong_number
        FROM leads l
        JOIN uploads u ON l.upload_id = u.id
        ${dateFilter}
        GROUP BY l.channel, l.campaign
        ORDER BY total DESC
    `).all(...params);

    res.render('total_summary', { 
        summary, 
        campaignSummary, 
        filters: { startDate, endDate },
        page: 'total'
    });
});

module.exports = router;
