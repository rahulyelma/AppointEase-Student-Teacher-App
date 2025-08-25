const express = require('express');
const {
    sendMessage,
    getMessagesForUser,
    markMessageAsRead
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Send
router.route('/').post(protect, sendMessage);

// My
router.route('/my').get(protect, getMessagesForUser);

// Read
router.route('/:id/read').put(protect, markMessageAsRead);

module.exports = router;