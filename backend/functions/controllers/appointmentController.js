const asyncHandler = require('express-async-handler');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

// Book
const bookAppointment = asyncHandler(async (req, res) => {
    const { teacherId, date, time, subject } = req.body;
    const studentId = req.user._id;

    if (req.user.role !== 'student') {
        res.status(403);
        throw new Error('Only students can book appointments');
    }

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
});

// Fetch
const getMyAppointments = asyncHandler(async (req, res) => {
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
});

// Update
const updateAppointmentStatus = asyncHandler(async (req, res) => {
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

    if (!isTeacherOfAppointment && !isStudentOfAppointment) {
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
});

// Admin
const getAllAppointments = asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized as admin');
    }

    const appointments = await Appointment.find({})
        .populate('student', 'name email')
        .populate('teacher', 'name email')
        .sort({ createdAt: -1 });

    res.status(200).json(appointments);
});

module.exports = {
    bookAppointment,
    getMyAppointments,
    updateAppointmentStatus,
    getAllAppointments,
};