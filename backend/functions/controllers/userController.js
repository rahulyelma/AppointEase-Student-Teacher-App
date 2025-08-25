const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '1h',
    });
};

// Register
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const user = await User.create({
        name,
        email,
        password,
        role,
        teacherProfile: role === 'teacher' ? { subjects: [], availability: [], department: '' } : undefined,
        isAdminApproved: role === 'student' ? false : true,
    });

    if (user) {
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            teacherProfile: user.teacherProfile,
            isAdminApproved: user.isAdminApproved,
            token: generateToken(user._id),
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// Login
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            teacherProfile: user.teacherProfile,
            isAdminApproved: user.isAdminApproved,
            token: generateToken(user._id),
        });
    } else {
        res.status(401);
        throw new Error('Invalid credentials');
    }
});

// Profile
const getMe = asyncHandler(async (req, res) => {
    res.status(200).json(req.user);
});

// Teacher
const getTeacherProfile = asyncHandler(async (req, res) => {
    const teacher = await User.findById(req.params.id).select('-password');
    if (!teacher || teacher.role !== 'teacher') {
        res.status(404);
        throw new Error('Teacher not found');
    }
    res.status(200).json(teacher);
});

// All
const getAllTeachers = asyncHandler(async (req, res) => {
    const teachers = await User.find({ role: 'teacher' }).select('-password');
    res.status(200).json(teachers);
});

// Update
const updateTeacherProfile = asyncHandler(async (req, res) => {
    if (req.user.role !== 'teacher' || req.user._id.toString() !== req.body._id && req.body._id !== undefined) {
      if (req.body._id && req.user._id.toString() !== req.body._id.toString()) {
        res.status(403);
        throw new Error('Not authorized to update this profile');
      }
    }

    const user = await User.findById(req.user._id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (user.role !== 'teacher') {
        res.status(403);
        throw new Error('Only teachers can update teacher profiles');
    }

    user.teacherProfile.subjects = req.body.subjects || user.teacherProfile.subjects;
    user.teacherProfile.availability = req.body.availability || user.teacherProfile.availability;
    user.teacherProfile.department = req.body.department || user.teacherProfile.department;

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;

    const updatedUser = await user.save();

    res.status(200).json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        teacherProfile: updatedUser.teacherProfile,
    });
});

// Admin
const adminAddTeacher = asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized as admin');
    }
    res.status(201).json({ message: 'Admin: Teacher creation simulated successfully. Implement actual logic.' });
});

// Update
const adminUpdateUser = asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized as admin');
    }

    const userToUpdate = await User.findById(req.params.id);

    if (!userToUpdate) {
        res.status(404);
        throw new Error('User not found');
    }

    userToUpdate.name = req.body.name || userToUpdate.name;
    userToUpdate.email = req.body.email || userToUpdate.email;
    userToUpdate.role = req.body.role || userToUpdate.role;
    userToUpdate.isAdminApproved = req.body.isAdminApproved !== undefined ? req.body.isAdminApproved : userToUpdate.isAdminApproved;

    if (userToUpdate.role === 'teacher' && req.body.teacherProfile) {
        userToUpdate.teacherProfile.subjects = req.body.teacherProfile.subjects || userToUpdate.teacherProfile.subjects;
        userToUpdate.teacherProfile.availability = req.body.teacherProfile.availability || userToUpdate.teacherProfile.availability;
        userToUpdate.teacherProfile.department = req.body.teacherProfile.department || userToUpdate.teacherProfile.department;
    }

    const updatedUser = await userToUpdate.save();

    res.status(200).json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        teacherProfile: updatedUser.teacherProfile,
        isAdminApproved: updatedUser.isAdminApproved,
    });
});

// Delete
const adminDeleteUser = asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized as admin');
    }

    const userToDelete = await User.findById(req.params.id);

    if (!userToDelete) {
        res.status(404);
        throw new Error('User not found');
    }

    await userToDelete.deleteOne();

    res.status(200).json({ message: 'User removed' });
});

// Users
const adminGetAllUsers = asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized as admin');
    }
    const users = await User.find({}).select('-password');
    res.status(200).json(users);
});

module.exports = {
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
};