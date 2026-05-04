const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { guest } = require('../middleware/auth');

router.get('/login', guest, (req, res) => {
    res.render('login', { layout: false, error: null });
});

router.post('/login', guest, (req, res) => {
    const { username, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (user && bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET || 'fair_intelligence_secret_key',
            { expiresIn: '30d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            secure: process.env.NODE_ENV === 'production'
        });

        return res.redirect('/');
    }

    res.render('login', { layout: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
});

router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

module.exports = router;
