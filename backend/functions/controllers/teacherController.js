/* eslint-disable max-len */
const User = require("../models/User"); // Import the User model

// @desc    Update teacher profile
// @route   PUT /users/teacher/profile
// @access  Private (Teacher only)
// This function allows a logged-in teacher to update their profile information.
const updateTeacherProfile = async (req, res) => {
  // eslint-disable-next-line max-len
  // req.user is populated by the 'protect' middleware, containing the authenticated user's data
  const user = req.user;

  // Check if the authenticated user is actually a teacher
  if (user.role !== "teacher") {
    // eslint-disable-next-line max-len
    return res.status(403).json({message: "Not authorized: Only teachers can update their profiles."});
  }

  const {subjects, availability} = req.body;

  // eslint-disable-next-line max-len
  // Ensure teacherProfile exists, initialize if not (though it should exist for a 'teacher' role)
  if (!user.teacherProfile) {
    user.teacherProfile = {};
  }

  // Update subjects if provided
  if (subjects && Array.isArray(subjects)) {
    user.teacherProfile.subjects = subjects;
  }

  // Update availability if provided
  if (availability && Array.isArray(availability)) {
    // Basic validation for availability structure (optional but recommended)
    const isValidAvailability = availability.every((slot) =>
      typeof slot.day === "string" && typeof slot.time === "string",
    );
    if (!isValidAvailability) {
      return res.status(400).json({message: "Invalid availability format. Each slot must have a \"day\" and \"time\" string."});
    }
    user.teacherProfile.availability = availability;
  }

  try {
    // Save the updated user document
    const updatedUser = await user.save();

    // Respond with the updated teacher profile (excluding sensitive info like password)
    res.status(200).json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      teacherProfile: updatedUser.teacherProfile,
      message: "Teacher profile updated successfully.",
    });
  } catch (error) {
    console.error("Error updating teacher profile:", error);
    res.status(500).json({message: "Server error during profile update."});
  }
};

// @desc    Get a single teacher's profile by ID
// @route   GET /users/teacher/:id
// @access  Public (Anyone can view, but only certain fields are exposed)
// This function allows anyone to view a teacher's public profile information.
const getTeacherProfileById = async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id).select("-password -createdAt -__v"); // Exclude sensitive fields

    if (!teacher) {
      return res.status(404).json({message: "Teacher not found."});
    }

    // Ensure the found user is actually a teacher
    if (teacher.role !== "teacher") {
      return res.status(404).json({message: "User is not a teacher."});
    }

    // Respond with the teacher's public profile
    res.status(200).json({
      _id: teacher._id,
      name: teacher.name,
      email: teacher.email, // Consider if email should be public
      role: teacher.role,
      teacherProfile: teacher.teacherProfile,
    });
  } catch (error) {
    console.error("Error fetching teacher profile:", error);
    // Handle CastError if ID format is invalid
    if (error.name === "CastError") {
      return res.status(400).json({message: "Invalid teacher ID format."});
    }
    res.status(500).json({message: "Server error fetching teacher profile."});
  }
};

// @desc    Get all teachers' profiles
// @route   GET /users/teachers
// @access  Public
// This function allows anyone to view a list of all teachers and their public profiles.
const getAllTeachers = async (req, res) => {
  try {
    // Find all users with the role 'teacher' and select specific fields
    const teachers = await User.find({role: "teacher"}).select("-password -createdAt -__v");

    if (!teachers || teachers.length === 0) {
      return res.status(404).json({message: "No teachers found."});
    }

    // Map to a cleaner output if needed, or send as is
    const teacherProfiles = teachers.map((teacher) => ({
      _id: teacher._id,
      name: teacher.name,
      email: teacher.email, // Consider if email should be public
      role: teacher.role,
      teacherProfile: teacher.teacherProfile,
    }));

    res.status(200).json(teacherProfiles);
  } catch (error) {
    console.error("Error fetching all teachers:", error);
    res.status(500).json({message: "Server error fetching teachers."});
  }
};


module.exports = {
  updateTeacherProfile,
  getTeacherProfileById,
  getAllTeachers,
};
