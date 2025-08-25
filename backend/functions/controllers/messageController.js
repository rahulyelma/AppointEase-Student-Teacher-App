const asyncHandler = require('express-async-handler');
const Message = require('../models/Message');
const User = require('../models/User');

// Send
const sendMessage = asyncHandler(async (req, res) => {
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
});

// Fetch
const getMessagesForUser = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const messages = await Message.find({
                $or: [{ sender: userId }, { recipient: userId }]
            })
            .populate('sender', 'name email')
            .populate('recipient', 'name email')
            .sort({ createdAt: -1 })
            .select('-__v');

    if (!messages || messages.length === 0) {
        return res.status(200).json([]);
    }

    res.status(200).json(messages);
});

// Read
const markMessageAsRead = asyncHandler(async (req, res) => {
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
});

module.exports = {
    sendMessage,
    getMessagesForUser,
    markMessageAsRead,
};