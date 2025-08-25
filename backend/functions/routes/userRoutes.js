const express = require('express');
const {
    registerUser,
    loginUser,
    getMe,
    getTeacherProfile,
    getAllTeachers,
    updateTeacherProfile,
    adminAddTeacher,
    adminUpdateUser,
    adminDeleteUser,
    adminGetAllUsers,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Public
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/teacher', getAllTeachers);
router.get('/teacher/:id', getTeacherProfile);

// Private
router.get('/me', protect, getMe);

// Teacher
router.put('/teacher/profile', protect, authorize('teacher'), updateTeacherProfile);

// Admin
router.post('/admin/user', protect, authorize('admin'), adminAddTeacher);
router.put('/admin/user/:id', protect, authorize('admin'), adminUpdateUser);
router.delete('/admin/user/:id', protect, authorize('admin'), adminDeleteUser);
router.get('/admin/all', protect, authorize('admin'), adminGetAllUsers);

module.exports = router;