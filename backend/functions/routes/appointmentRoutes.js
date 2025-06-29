const express = require('express');
const {
    bookAppointment,
    getMyAppointments,
    updateAppointmentStatus,
    getAllAppointments,
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Base
router.route('/')
    .post(protect, authorize('student'), bookAppointment)
    .get(protect, authorize('admin'), getAllAppointments);

// My
router.get('/my', protect, getMyAppointments);

// Status
router.put('/:id/status', protect, updateAppointmentStatus);

module.exports = router;