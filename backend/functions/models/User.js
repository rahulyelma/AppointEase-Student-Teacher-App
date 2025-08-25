/* eslint-disable max-len */
// eslint-disable-next-line max-len
const {Schema, model} = require("mongoose"); // Import Mongoose for schema definition and modeling
// eslint-disable-next-line max-len
const {genSalt, hash, compare} = require("bcryptjs"); // Import bcryptjs for password hashing

// Define the User Schema
// eslint-disable-next-line max-len
// This schema outlines the structure and validation rules for user documents in MongoDB
const UserSchema = new Schema({
// eslint-disable-next-line indent
name: {
    type: String,
    required: true, // Name is a mandatory field
    // eslint-disable-next-line comma-dangle
    trim: true // Remove whitespace from both ends of a string
    // eslint-disable-next-line indent
        },
  email: {
    type: String,
    required: true,
    unique: true, // Email must be unique (no two users can have the same email)
    trim: true,
    lowercase: true, // Store emails in lowercase for consistency
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: [
      "student",
      "teacher",
      "admin",
    ], // User can only be one of these roles
    default: "student", // Default role is 'student' if not specified
  },
  // eslint-disable-next-line max-len
  // For teachers, we might add specific fields like subjects taught, availability, etc.
  // For simplicity, we'll keep it basic for now and expand later if needed.
  teacherProfile: {
    subjects: [{type: String}], // Array of subjects a teacher can teach
    availability: [{ // Array of available time slots
      day: {type: String, required: true},
      time: {type: String, required: true},
    }],
    // Add other teacher-specific fields as needed, e.g., qualifications, bio
  },
  createdAt: {
    type: Date,
    default: Date.now, // Automatically set creation timestamp
  },
});

// Pre-save hook to hash the password before saving a new user or updating password
// 'pre' middleware functions are executed one after another, when each middleware calls next().
UserSchema.pre("save", async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) {
    return next(); // Move to the next middleware or save operation
  }
  try {
    // Generate a salt (random string) to hash the password with
    const salt = await genSalt(10); // 10 rounds is a good balance for security and performance
    // Hash the password using the generated salt
    this.password = await hash(this.password, salt);
    next(); // Proceed with saving the user
  } catch (error) {
    next(error); // Pass any error to the next middleware
  }
});

// Method to compare entered password with hashed password in the database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  // Use bcrypt.compare to compare the plain text password with the hashed password
  return await compare(enteredPassword, this.password);
};

// Create and export the User model based on the schema
const User = model("User", UserSchema);
module.exports = User;
