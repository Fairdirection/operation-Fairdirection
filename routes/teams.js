const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET / - Team management panel
router.get('/', (req, res) => {
    try {
        // Fetch teams with member counts
        const teams = db.prepare(`
            SELECT t.id, t.name, t.created_at, COUNT(tm.id) as member_count
            FROM teams t
            LEFT JOIN team_members tm ON t.id = tm.team_id
            GROUP BY t.id
            ORDER BY t.name ASC
        `).all();

        // Fetch distinct salesman names from leads (excluding empty ones)
        const salesmen = db.prepare(`
            SELECT DISTINCT salesman_name 
            FROM leads 
            WHERE salesman_name IS NOT NULL 
              AND TRIM(salesman_name) != '' 
              AND salesman_name != '-'
              AND salesman_name != 'غير معروف'
            ORDER BY salesman_name ASC
        `).all().map(s => s.salesman_name);

        // Fetch all team members to map them in memory
        const allMembers = db.prepare('SELECT * FROM team_members').all();
        
        // Group members by team_id
        const teamMembers = {};
        allMembers.forEach(m => {
            if (!teamMembers[m.team_id]) {
                teamMembers[m.team_id] = [];
            }
            teamMembers[m.team_id].push(m.salesman_name);
        });

        res.render('teams', { 
            teams, 
            salesmen, 
            teamMembers, 
            page: 'teams' 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('حدث خطأ أثناء تحميل الفرق.');
    }
});

// POST /add - Add new team
router.post('/add', (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === '') {
        return res.status(400).send('اسم الفريق مطلوب.');
    }

    try {
        const insertTeam = db.prepare('INSERT INTO teams (name) VALUES (?)');
        insertTeam.run(name.trim());
        res.redirect('/teams');
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).send('هذا الفريق موجود بالفعل.');
        }
        console.error(err);
        res.status(500).send('حدث خطأ أثناء إنشاء الفريق.');
    }
});

// POST /delete/:id - Delete team
router.post('/delete/:id', (req, res) => {
    const teamId = req.params.id;

    try {
        const deleteTeam = db.prepare('DELETE FROM teams WHERE id = ?');
        deleteTeam.run(teamId);
        res.redirect('/teams');
    } catch (err) {
        console.error(err);
        res.status(500).send('حدث خطأ أثناء حذف الفريق.');
    }
});

// POST /members/:id - Update team members
router.post('/members/:id', (req, res) => {
    const teamId = req.params.id;
    let { members } = req.body;

    if (!members) {
        members = [];
    } else if (!Array.isArray(members)) {
        members = [members];
    }

    try {
        const deleteMembers = db.prepare('DELETE FROM team_members WHERE team_id = ?');
        const insertMember = db.prepare('INSERT INTO team_members (team_id, salesman_name) VALUES (?, ?)');

        const transaction = db.transaction(() => {
            deleteMembers.run(teamId);
            for (const member of members) {
                insertMember.run(teamId, String(member).trim());
            }
        });

        transaction();
        res.redirect('/teams');
    } catch (err) {
        console.error(err);
        res.status(500).send('حدث خطأ أثناء تحديث أعضاء الفريق.');
    }
});

module.exports = router;
