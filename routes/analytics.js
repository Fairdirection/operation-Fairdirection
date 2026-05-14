const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/total', (req, res) => {
    const { startDate, endDate, teamId, salesmen } = req.query;
    const conditions = [];
    const queryParams = [];

    // Date range filter
    if (startDate && endDate) {
        conditions.push('u.report_date BETWEEN ? AND ?');
        queryParams.push(startDate, endDate);
    }

    // Team or Specific Salesmen filter
    let selectedTeam = null;
    if (teamId && teamId !== '') {
        selectedTeam = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
        if (selectedTeam) {
            conditions.push('l.salesman_name IN (SELECT salesman_name FROM team_members WHERE team_id = ?)');
            queryParams.push(teamId);
        }
    } else if (salesmen) {
        const selectedSalesmen = (Array.isArray(salesmen) ? salesmen : [salesmen]).map(s => String(s).trim());
        if (selectedSalesmen.length > 0) {
            const placeholders = selectedSalesmen.map(() => '?').join(',');
            conditions.push(`l.salesman_name IN (${placeholders})`);
            queryParams.push(...selectedSalesmen);
        }
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Aggregate data from leads filtered by upload report_date, team, and salesman names
    const summary = db.prepare(`
        SELECT 
            l.salesman_name,
            COUNT(*) as total,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%fresh%' THEN 1 END) as my_fresh,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%call%back%' THEN 1 END) as callback,
            COUNT(CASE WHEN LOWER(l.state) LIKE 'follow up%' AND LOWER(l.state) NOT LIKE '%follow%up%low%' THEN 1 END) as follow_up,
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
        ${whereClause}
        GROUP BY l.salesman_name
        ORDER BY total DESC
    `).all(...queryParams);

    const campaignSummary = db.prepare(`
        SELECT 
            l.channel,
            l.campaign,
            COUNT(*) as total,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%fresh%' THEN 1 END) as my_fresh,
            COUNT(CASE WHEN LOWER(l.state) LIKE '%call%back%' THEN 1 END) as callback,
            COUNT(CASE WHEN LOWER(l.state) LIKE 'follow up%' AND LOWER(l.state) NOT LIKE '%follow%up%low%' THEN 1 END) as follow_up,
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
        ${whereClause}
        GROUP BY l.channel, l.campaign
        ORDER BY total DESC
    `).all(...queryParams);

    // Fetch list of all teams and distinct salesmen for dropdown lists
    const teams = db.prepare('SELECT * FROM teams ORDER BY name ASC').all();
    
    const allSalesmen = db.prepare(`
        SELECT DISTINCT salesman_name 
        FROM leads 
        WHERE salesman_name IS NOT NULL 
          AND TRIM(salesman_name) != '' 
          AND salesman_name != '-'
          AND salesman_name != 'غير معروف'
        ORDER BY salesman_name ASC
    `).all().map(s => s.salesman_name);

    res.render('total_summary', { 
        summary, 
        campaignSummary, 
        teams,
        allSalesmen,
        filters: { 
            startDate: startDate || '', 
            endDate: endDate || '', 
            teamId: teamId || '', 
            salesmen: Array.isArray(salesmen) ? salesmen : (salesmen ? [salesmen] : [])
        },
        page: 'total'
    });
});

module.exports = router;
