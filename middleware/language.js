const translations = require('../config/translations');

module.exports = (req, res, next) => {
  // 1. Determine active language: priority to query param (?lang=XX), then cookie (lang), then default (ar)
  let lang = req.query.lang || req.cookies.lang || 'ar';
  
  // Normalize to supported languages
  if (lang !== 'en' && lang !== 'ar') {
    lang = 'ar';
  }

  // 2. Persist chosen language in cookie if it changed or wasn't set
  if (req.query.lang && req.query.lang !== req.cookies.lang) {
    res.cookie('lang', lang, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false });
  }

  // 3. Bind helper function and state variables to templates
  res.locals.lang = lang;
  res.locals.__ = (key) => {
    if (translations[lang] && translations[lang][key] !== undefined) {
      return translations[lang][key];
    }
    // Fallback to Arabic translation if translation is missing
    if (translations['ar'] && translations['ar'][key] !== undefined) {
      return translations['ar'][key];
    }
    return key;
  };

  next();
};
