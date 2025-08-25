/* eslint-disable max-len */
// eslint-disable-next-line max-len
const jwt = require("jsonwebtoken"); // Import jsonwebtoken for token verification
const User = require("../models/User");
// Import the User model to find user by ID

// Middleware to protect routes (ensure user is authenticated)
// This function checks for a valid JWT token in the request headers
const protect = async (req, res, next) => {
  let token;

  // Check if the Authorization header exists and starts with 'Bearer'
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      // Get token from header (remove 'Bearer ' prefix)
      token = req.headers.authorization.split(" ")[1];

      // Verify token using our JWT_SECRET
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find the user by ID from the decoded token (excluding password)
      // Attach the user object to the request for subsequent middleware/route handlers
      req.user = await User.findById(decoded.id).select("-password");

      // If user is not found, it means the token is valid but the user doesn't exist
      if (!req.user) {
        return res.status(401).json({message: "Not authorized, user not found"});
      }

      next(); // Proceed to the next middleware or route handler
    } catch (error) {
      // If token is invalid or expired
      console.error("Token verification failed:", error.message);
      res.status(401).json({message: "Not authorized, token failed"});
    }
  }

  // If no token is provided in the header
  if (!token) {
    res.status(401).json({message: "Not authorized, no token"});
  }
};

// Middleware to authorize users based on their roles
// This function takes an array of allowed roles and checks if the authenticated user's role is included
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // Check if req.user exists (meaning 'protect' middleware ran successfully)
    // and if the user's role is included in the allowed roles
    if (!req.user || !roles.includes(req.user.role)) {
      // If not authorized, send a 403 Forbidden error
      return res.status(403).json({message: `User role ${req.user ? req.user.role : "unknown"} is not authorized to access this route`});
    }
    next(); // Proceed to the next middleware or route handler
  };
};

module.exports = {protect, authorizeRoles};
