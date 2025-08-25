const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');

// Config
require('dotenv').config({ path: '../.env' });

const app = express();

// CORS
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
     'http://localhost:5173',
    
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
}));

// Body
app.use(express.json());

// DB
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
    console.error("MONGODB_URI is not defined in the .env file. Please check your .env file in the backend folder.");
    process.exit(1);
} else {
    mongoose.connect(mongoURI)
        .then(() => console.log('MongoDB connected successfully!'))
        .catch(err => {
            console.error('MongoDB connection error:', err);
            process.exit(1);
        });
}

// User Schema
const UserSchema = mongoose.Schema(
    {
        name: { type: String, required: [true, 'Please add a name'] },
        email: { type: String, required: [true, 'Please add an email'], unique: true },
        password: { type: String, required: [true, 'Please add a password'] },
        role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
        teacherProfile: {
            subjects: { type: [String], default: [] },
            availability: {
                type: [
                    {
                        day: String,
                        time: String,
                    },
                ],
                default: []
            },
            department: { type: String, default: '' },
        },
        isAdminApproved: { type: Boolean, default: false },
    },
    { timestamps: true }
);

UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', UserSchema);

// Appointment Schema
const AppointmentSchema = mongoose.Schema(
    {
        student: { type: mongoose.Schema.Types.ObjectId, required: [true, 'Appointment must have a student'], ref: 'User' },
        teacher: { type: mongoose.Schema.Types.ObjectId, required: [true, 'Appointment must have a teacher'], ref: 'User' },
        date: { type: Date, required: [true, 'Please provide a date for the appointment'] },
        time: { type: String, required: [true, 'Please provide a time for the appointment'] },
        subject: { type: String, required: [true, 'Please provide a subject for the appointment'] },
        status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
    },
    { timestamps: true }
);
const Appointment = mongoose.model('Appointment', AppointmentSchema);

// Message Schema
const MessageSchema = mongoose.Schema(
    {
        sender: { type: mongoose.Schema.Types.ObjectId, required: [true, 'Message must have a sender'], ref: 'User' },
        recipient: { type: mongoose.Schema.Types.ObjectId, required: [true, 'Message must have a recipient'], ref: 'User' },
        subject: { type: String, default: 'No Subject' },
        content: { type: String, required: [true, 'Message content cannot be empty'] },
        read: { type: Boolean, default: false },
    },
    { timestamps: true }
);
const Message = mongoose.model('Message', MessageSchema);

// Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '1h',
    });
};

// Protect
const protect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            if (!req.user) {
                res.status(401);
                throw new Error('Not authorized, user not found');
            }
            next();
        } catch (error) {
            console.error('Token verification failed:', error.message);
            res.status(401);
            throw new Error('Not authorized, token failed');
        }
    }
    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token');
    }
});

// Authorize
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403);
            throw new Error(`User role ${req.user ? req.user.role : 'none'} is not authorized to access this route`);
        }
        next();
    };
};

// Error
const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

// Register
app.post('/users/register', asyncHandler(async (req, res) => {
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
}));

// Login
app.post('/users/login', asyncHandler(async (req, res) => {
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
}));

// Profile
app.get('/users/me', protect, asyncHandler(async (req, res) => {
    res.status(200).json(req.user);
}));

// Teacher
app.get('/users/teacher/:id', asyncHandler(async (req, res) => {
    const teacher = await User.findById(req.params.id).select('-password');
    if (!teacher || teacher.role !== 'teacher') {
        res.status(404);
        throw new Error('Teacher not found');
    }
    res.status(200).json(teacher);
}));

// All
app.get('/users/teacher', asyncHandler(async (req, res) => {
    const teachers = await User.find({ role: 'teacher' }).select('-password');
    res.status(200).json(teachers);
}));

// Update
app.put('/users/teacher/profile', protect, authorize('teacher'), asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user || user.role !== 'teacher') {
        res.status(403);
        throw new Error('Not authorized to update this profile');
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
}));

// Admin
app.post('/users/admin/user', protect, authorize('admin'), asyncHandler(async (req, res) => {
    const { name, email, password, role, teacherProfile, isAdminApproved } = req.body;
    if (!name || !email || !password || !role) {
        res.status(400);
        throw new Error('Please add all required fields');
    }
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User with this email already exists');
    }
    const user = await User.create({
        name,
        email,
        password,
        role,
        teacherProfile: role === 'teacher' ? (teacherProfile || { subjects: [], availability: [], department: '' }) : undefined,
        isAdminApproved: role === 'student' ? (isAdminApproved !== undefined ? isAdminApproved : false) : true,
    });
    res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        teacherProfile: user.teacherProfile,
        isAdminApproved: user.isAdminApproved,
    });
}));

// Update
app.put('/users/admin/user/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
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
    } else if (userToUpdate.role !== 'teacher') {
        userToUpdate.teacherProfile = undefined;
    }

    if (req.body.password) {
        userToUpdate.password = req.body.password;
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
}));

// Delete
app.delete('/users/admin/user/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) {
        res.status(404);
        throw new Error('User not found');
    }
    await userToDelete.deleteOne();
    res.status(200).json({ message: 'User removed' });
}));

// Users
app.get('/users/admin/all', protect, authorize('admin'), asyncHandler(async (req, res) => {
    const users = await User.find({}).select('-password');
    res.status(200).json(users);
}));

// Book
app.post('/appointments', protect, authorize('student'), asyncHandler(async (req, res) => {
    const { teacherId, date, time, subject } = req.body;
    const studentId = req.user._id;

    if (!teacherId || !date || !time || !subject) {
        res.status(400);
        throw new Error('Please provide teacher, date, time, and subject for the appointment');
    }

    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
        res.status(404);
        throw new Error('Selected teacher not found or is not a teacher');
    }

    const appointment = await Appointment.create({
        student: studentId,
        teacher: teacherId,
        date: new Date(date),
        time,
        subject,
        status: 'pending',
    });

    await appointment.populate('student', 'name email');
    await appointment.populate('teacher', 'name email');

    res.status(201).json({
        message: 'Appointment booked successfully.',
        appointment: appointment
    });
}));

// My
app.get('/appointments/my', protect, asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const userRole = req.user.role;

    let appointments;
    if (userRole === 'student') {
        appointments = await Appointment.find({ student: userId })
            .populate('teacher', 'name email')
            .sort({ date: 1, time: 1 });
    } else if (userRole === 'teacher') {
        appointments = await Appointment.find({ teacher: userId })
            .populate('student', 'name email')
            .sort({ date: 1, time: 1 });
    } else {
        res.status(403);
        throw new Error('Invalid role for this operation');
    }
    res.status(200).json(appointments);
}));

// Update
app.put('/appointments/:id/status', protect, asyncHandler(async (req, res) => {
    const appointmentId = req.params.id;
    const { status } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
        res.status(404);
        throw new Error('Appointment not found');
    }

    const isTeacherOfAppointment = appointment.teacher.toString() === userId.toString() && userRole === 'teacher';
    const isStudentOfAppointment = appointment.student.toString() === userId.toString() && userRole === 'student';

    if (!isTeacherOfAppointment && !isStudentOfAppointment && userRole !== 'admin') {
        res.status(403);
        throw new Error('Not authorized to update this appointment');
    }

    if (isStudentOfAppointment && status !== 'cancelled' && appointment.status === 'pending') {
        res.status(403);
        throw new Error('Students can only cancel their own pending appointments');
    }
    if (isTeacherOfAppointment && !['confirmed', 'cancelled', 'completed'].includes(status)) {
        res.status(400);
        throw new Error('Invalid status update for teacher');
    }
    if (appointment.status === 'completed' || appointment.status === 'cancelled') {
        res.status(400);
        throw new Error('Cannot update a completed or cancelled appointment');
    }

    appointment.status = status;
    const updatedAppointment = await appointment.save();

    await updatedAppointment.populate('student', 'name email');
    await updatedAppointment.populate('teacher', 'name email');

    res.status(200).json({
        message: 'Appointment status updated successfully.',
        appointment: updatedAppointment
    });
}));

// All
app.get('/appointments', protect, authorize('admin'), asyncHandler(async (req, res) => {
    const appointments = await Appointment.find({})
        .populate('student', 'name email')
        .populate('teacher', 'name email')
        .sort({ createdAt: -1 });
    res.status(200).json(appointments);
}));

// Send
app.post('/messages', protect, asyncHandler(async (req, res) => {
    const senderId = req.user._id;
    const { recipientId, subject, content } = req.body;

    if (!recipientId || !content) {
        res.status(400);
        throw new Error('Please provide recipient and message content.');
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
        res.status(404);
        throw new Error('Recipient user not found.');
    }

    if (senderId.toString() === recipientId.toString()) {
        res.status(400);
        throw new Error('Cannot send message to yourself.');
    }

    const message = await Message.create({
        sender: senderId,
        recipient: recipientId,
        subject: subject || 'No Subject',
        content,
    });

    await message.populate('sender', 'name email role');
    await message.populate('recipient', 'name email role');

    res.status(201).json({
        message: 'Message sent successfully.',
        message: message
    });
}));

// My
app.get('/messages/my', protect, asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const messages = await Message.find({
                $or: [{ sender: userId }, { recipient: userId }]
            })
            .populate('sender', 'name email')
            .populate('recipient', 'name email')
            .sort({ createdAt: -1 })
            .select('-__v');

    res.status(200).json(messages);
}));

// Read
app.put('/messages/:id/read', protect, asyncHandler(async (req, res) => {
    const messageId = req.params.id;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
        res.status(404);
        throw new Error('Message not found.');
    }

    if (message.recipient.toString() !== userId.toString()) {
        res.status(403);
        throw new Error('Not authorized to mark this message as read.');
    }

    message.read = true;
    await message.save();

    res.status(200).json({ message: 'Message marked as read.', updatedMessage: message });
}));

// Error
app.use(errorHandler);

// Export
exports.api = functions.https.onRequest(app);