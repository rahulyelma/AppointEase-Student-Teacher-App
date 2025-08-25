const express = require("express"); // Import Express to create a router
const {
  updateTeacherProfile,
  getTeacherProfileById,
  getAllTeachers,
} = require("../controllers/teacherController"); // Import controller functions
// eslint-disable-next-line max-len
const {protect, authorizeRoles} = require("../middleware/authMiddleware"); // Import authentication middleware

// eslint-disable-next-line new-cap
const router = express.Router(); // Create an Express router instance

// @route   PUT /users/teacher/profile
// @desc    Update teacher's own profile (subjects, availability)
// @access  Private (Teacher only)
// eslint-disable-next-line max-len
// This route requires authentication ('protect') and ensures the user has the 'teacher' role ('authorizeRoles('teacher'))
// eslint-disable-next-line max-len
router.route("/profile").put(protect, authorizeRoles("teacher"), updateTeacherProfile);

// @route   GET /users/teacher/:id
// @desc    Get a single teacher's public profile by ID
// @access  Public (No authentication required to view public profiles)
router.route("/:id").get(getTeacherProfileById);

// @route   GET /users/teachers
// @desc    Get all teachers' public profiles
// @access  Public (No authentication required to view a list of teachers)
router.route("/").get(getAllTeachers);


module.exports = router; // Export the router to be used in index.js
