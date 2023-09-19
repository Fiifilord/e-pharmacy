// isAdminAuthenticated.js

// Middleware to check if the admin is authenticated
const isAdminAuthenticated = (req, res, next) => {
    if (req.session.isAdminLoggedIn) {
      next(); // Admin is logged in, proceed to the next middleware or route handler
    } else {
      res.redirect('/admin-login'); // Redirect to admin login page if not logged in
    }
  };
  
  module.exports = isAdminAuthenticated;
  