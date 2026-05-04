const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.redirect('/login');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fair_intelligence_secret_key');
        req.user = decoded;
        next();
    } catch (err) {
        res.clearCookie('token');
        return res.redirect('/login');
    }
};

const guest = (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
        try {
            jwt.verify(token, process.env.JWT_SECRET || 'fair_intelligence_secret_key');
            return res.redirect('/');
        } catch (err) {
            res.clearCookie('token');
            next();
        }
    } else {
        next();
    }
};

module.exports = { protect, guest };
