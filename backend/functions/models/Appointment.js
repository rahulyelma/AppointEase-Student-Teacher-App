/* eslint-disable max-len */
const mongoose = require("mongoose"); // Import Mongoose

// eslint-disable-next-line new-cap
const AppointmentSchema = mongoose.Schema(
    {
      // Reference to the Teacher (User model)
      teacher: {
        type: mongoose.Schema.Types.ObjectId, // Store as ObjectId
        required: true,
        ref: "User", // References the 'User' model
      },
      // Reference to the Student (User model)
      student: {
        type: mongoose.Schema.Types.ObjectId, // Store as ObjectId
        required: true,
        ref: "User", // References the 'User' model
      },
      // Date of the appointment
      date: {
        type: Date,
        required: true,
      },
      // Time slot of the appointment (e.g., "10:00 AM")
      time: {
        type: String,
        required: true,
      },
      // Status of the appointment (e.g., 'pending', 'confirmed', 'cancelled', 'completed')
      status: {
        type: String,
        required: true,
        default: "pending", // Default status when an appointment is first booked
        enum: ["pending", "confirmed", "cancelled", "completed"], // Allowed values
      },
      // Optional: Subject of the appointment
      subject: {
        type: String,
        required: false, // Not strictly required for all appointments
      },
    },
    {
      timestamps: true, // Adds createdAt and updatedAt timestamps automatically
    },
);

module.exports = mongoose.model("Appointment", AppointmentSchema);
