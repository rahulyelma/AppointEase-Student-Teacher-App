    import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

    const GlobalStyles = () => (
      <style>
        {`
        /* Custom styles for nav-button, explicitly written out from Tailwind properties */
        .nav-button {
          padding: 0.5rem 1rem; /* py-2 px-4 */
          border-radius: 0.5rem; /* rounded-lg */
          font-weight: 600;      /* font-semibold */
          background-color: transparent; /* Default transparent */
          color: white; /* Default text color */
          transition: background-color 300ms ease-in-out, box-shadow 300ms ease-in-out; /* transition duration-300 */
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); /* shadow-md */
        }

        .nav-button:hover {
          background-color: #2563eb; /* hover:bg-blue-600 */
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); /* hover:shadow-lg */
        }

        /* Basic body font and background for consistency */
        body {
          font-family: "Inter", sans-serif;
          background-color: #f9fafb; /* bg-gray-50 */
        }
        `}
      </style>
    );


    // --- Helper function to generate a MongoDB-like ObjectId string ---
    // This function creates a 24-character hexadecimal string, mimicking MongoDB's ObjectId format.
    // It's used for client-side generated IDs or fallback data when real backend IDs aren't available.
    const generateMongoId = () => {
      const chars = '0123456789abcdef';
      let result = '';
      for (let i = 0; i < 24; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    };


    // --- 1. AuthContext.js (Authentication Context) ---
    // This React Context manages the global authentication state of the user.
    // It provides user data, authentication token, and functions to log in/out.
    const AuthContext = createContext();

    export const AuthProvider = ({ children }) => {
      const [user, setUser] = useState(null); // Stores the authenticated user object.
      const [token, setToken] = useState(localStorage.getItem('token') || null); // Stores the JWT token.
      const [loading, setLoading] = useState(true); // Indicates if the initial auth state check is in progress.

      // useEffect runs once on component mount to check for existing user session in localStorage.
      useEffect(() => {
        try {
          const storedToken = localStorage.getItem('token');
          const storedUser = localStorage.getItem('user');

          if (storedToken && storedUser) {
            // If token and user data exist, parse and set them.
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setToken(storedToken);
          }
        } catch (error) {
          // Handle potential errors during localStorage parsing (e.g., malformed JSON).
          console.error("Error loading user from localStorage:", error);
          // Clear invalid data to prevent persistent issues.
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          setUser(null);
          setToken(null);
        } finally {
          setLoading(false); // Authentication state check is complete, regardless of outcome.
        }
      }, []); // Empty dependency array ensures this runs only once.

      // useCallback memoizes these functions to prevent unnecessary re-renders of children.
      // Function to handle user login: updates state and persists to localStorage.
      const login = useCallback((userData, userToken) => {
        setUser(userData);
        setToken(userToken);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', userToken);
      }, []);

      // Function to handle user logout: clears state and removes from localStorage.
      const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }, []);

      // Provide the authentication state and functions to all components wrapped by AuthProvider.
      return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
          {children}
        </AuthContext.Provider>
      );
    };

    // Custom hook to easily consume the AuthContext in functional components.
    export const useAuth = () => useContext(AuthContext);

    // --- 2. api.js (API Service) ---
    // This object centralizes all API calls to the backend.
    // It handles common concerns like setting headers and error handling.
    // IMPORTANT: Replace 'YOUR_PROJECT_ID' with your actual Firebase Project ID.
    const API_BASE_URL = 'http://127.0.0.1:5001/student-teacher-booking-c7c51/us-central1/api'; // Example: 'http://127.0.0.1:5001/your-project-id/us-central1/api'

    const api = {
      // Generic request function to handle all HTTP methods.
      // It automatically includes the Authorization header if a token is available.
      async request(endpoint, method = 'GET', data = null, token = null) {
        const headers = {
          'Content-Type': 'application/json',
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`; // Attach JWT token for authentication.
        }

        const config = {
          method,
          headers,
          body: data ? JSON.stringify(data) : null, // Stringify data for POST/PUT requests.
        };

        try {
          const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
          const responseData = await response.json(); // Parse JSON response.

          if (!response.ok) {
            // If response status is not OK (e.g., 4xx, 5xx), throw an error.
            const error = new Error(responseData.message || `API Error: ${response.status} for ${endpoint}`);
            error.status = response.status;
            error.data = responseData; // Include full response data for detailed debugging.
            throw error;
          }
          return responseData; // Return successful response data.
        } catch (error) {
          console.error(`API request to ${endpoint} failed:`, error);
          throw error; // Re-throw the error to be handled by the calling component.
        }
      },

      // Specific API call wrappers for different functionalities.
      register: (userData) => api.request('/users/register', 'POST', userData),
      login: (credentials) => api.request('/users/login', 'POST', credentials),
      updateTeacherProfile: (profileData, token) => api.request('/users/teacher/profile', 'PUT', profileData, token),
      getTeacherProfile: (id) => api.request(`/users/teacher/${id}`),
      getAllTeachers: () => api.request('/users/teacher'), // This will now fetch from backend
      bookAppointment: (appointmentData, token) => api.request('/appointments', 'POST', appointmentData, token),
      getMyAppointments: (token) => api.request('/appointments/my', 'GET', null, token),
      updateAppointmentStatus: (appointmentId, statusData, token) => api.request(`/appointments/${appointmentId}/status`, 'PUT', statusData, token),
      getAllAppointments: (token) => api.request('/appointments', 'GET', null, token), // Admin only

      // --- Messaging API Calls ---
      sendMessage: (messageData, token) => api.request('/messages', 'POST', messageData, token),
      getMessagesForUser: (token) => api.request('/messages/my', 'GET', null, token),

      // --- Admin Specific API Calls (Now interacting with backend) ---
      // These are no longer simulated; they call the actual backend routes.
      addUser: (userData, token) => api.request('/users/admin/user', 'POST', userData, token),
      updateUser: (userId, updateData, token) => api.request(`/users/admin/user/${userId}`, 'PUT', updateData, token),
      deleteUser: (userId, token) => api.request(`/users/admin/user/${userId}`, 'DELETE', null, token),
      getAllUsers: (token) => api.request('/users/admin/all', 'GET', null, token),
    };


    // --- 3. AuthPage.js (Login/Register Component) ---
    // Handles user authentication forms (login and registration).
    const AuthPage = ({ onAuthSuccess }) => {
      const [isLogin, setIsLogin] = useState(true); // Toggles between login and register forms.
      const [name, setName] = useState('');
      const [email, setEmail] = useState('');
      const [password, setPassword] = useState('');
      const [role, setRole] = useState('student'); // Default role for registration.
      const [message, setMessage] = useState(''); // Feedback message for user (success/error).
      const { login: authLogin } = useAuth(); // Destructure login function from AuthContext.
      const [isLoading, setIsLoading] = useState(false); // Loading state for auth operations.

      // Handles form submission for both login and registration.
      const handleSubmit = async (e) => {
        e.preventDefault(); // Prevent default form submission behavior.
        setMessage(''); // Clear any previous messages.
        setIsLoading(true); // Set loading state to true.

        try {
          let response;
          if (isLogin) {
            // Call backend login API.
            response = await api.login({ email, password });
          } else {
            // Call backend register API.
            response = await api.register({ name, email, password, role });
          }

          // On successful authentication, update AuthContext and trigger success callback.
          authLogin({ _id: response._id, name: response.name, email: response.email, role: response.role, teacherProfile: response.teacherProfile, isAdminApproved: response.isAdminApproved }, response.token);
          onAuthSuccess(); // Navigate to home page or dashboard.
        } catch (error) {
          // Display error message from API or a generic one.
          setMessage(error.data?.message || error.message || 'Authentication failed. Please try again.');
        } finally {
          setIsLoading(false); // Always set loading state to false.
        }
      };

      // Background image for the login/register page.
      const backgroundImage = 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

      return (
        <div
          className="min-h-screen flex items-center justify-center p-4 font-inter bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        >
          <div className="absolute inset-0 bg-black opacity-60"></div> {/* Semi-transparent overlay for readability */}
          <div className="relative bg-white p-8 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 hover:scale-105 z-10">
            <h1 className="text-5xl font-extrabold text-center mb-6 text-gray-900 drop-shadow-lg">
              <span className="text-blue-700">Appoint</span><span className="text-indigo-800">Ease</span>
            </h1>
            <h2 className="text-3xl font-extrabold text-center mb-8 text-gray-800">
              {isLogin ? 'Welcome Back!' : 'Join Us!'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && ( // Render name field only for registration.
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="name">Name</label>
                  <input
                    type="text"
                    id="name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin} // Required only if registering.
                    disabled={isLoading} // Disable input during loading.
                  />
                </div>
              )}
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading} // Disable input during loading.
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading} // Disable input during loading.
                />
              </div>
              {!isLogin && ( // Render role selection only for registration.
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="role">Role</label>
                  <select
                    id="role"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 bg-white"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required={!isLogin} // Required only if registering.
                    disabled={isLoading} // Disable select during loading.
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-bold text-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-300 shadow-md hover:shadow-lg"
                disabled={isLoading} // Disable button during loading.
              >
                {isLoading ? (isLogin ? 'Logging In...' : 'Registering...') : (isLogin ? 'Login' : 'Register')}
              </button>
            </form>
            {message && ( // Display feedback message.
              <p className="mt-6 text-center text-red-600 text-sm font-medium bg-red-100 p-3 rounded-md border border-red-200">{message}</p>
            )}
            <p className="mt-8 text-center text-gray-600 text-base">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)} // Toggle between login and register forms.
                className="text-blue-600 hover:text-blue-800 hover:underline font-semibold transition duration-200"
                disabled={isLoading} // Disable button during loading.
              >
                {isLogin ? 'Register here' : 'Login here'}
              </button>
            </p>
          </div>
        </div>
      );
    };


    // --- 4. App.js (Main Application Component) ---
    // This is the root component that sets up the AuthProvider and handles simple routing.
    const App = () => {
      const { user, loading, logout } = useAuth(); // Get user, loading, and logout from AuthContext.
      const [currentPage, setCurrentPage] = useState('home'); // State for simple client-side routing.

      // State to manage the list of all teachers, fetched from backend.
      const [allTeachers, setAllTeachers] = useState([]);

      // Effect to fetch teachers from the backend on component mount and when user/token changes.
      useEffect(() => {
        const fetchTeachers = async () => {
          if (!user) return; // Only fetch if user is logged in (though homepage is public for teachers)
          try {
            const teachersData = await api.getAllTeachers();
            setAllTeachers(teachersData);
          } catch (error) {
            console.error("Failed to fetch teachers:", error);
            // Optionally set a message to the user here.
          }
        };
        fetchTeachers();
      }, [user]); // Re-fetch when user object changes (e.g., after login/logout).


      // Show loading state while authentication is being checked.
      if (loading) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 font-inter">
            <p className="text-white text-xl animate-pulse">Loading application...</p>
          </div>
        );
      }

      // If not logged in, show the AuthPage.
      if (!user) {
        return <AuthPage onAuthSuccess={() => setCurrentPage('home')} />;
      }

      // Main application layout once logged in.
      return (
        <div className="min-h-screen bg-gray-50 font-inter flex flex-col">
          <GlobalStyles /> {/* Include the global styles component here */}
          {/* Navigation Bar */}
          <nav className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-4 shadow-lg">
            <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
              <h1 className="text-3xl font-extrabold mb-2 md:mb-0">
                <span className="text-blue-200">Appoint</span><span className="text-white">Ease</span>
              </h1>
              <div className="flex flex-wrap justify-center items-center space-x-4 text-lg">
                {/* Navigation buttons based on current page and user role. */}
                <button onClick={() => setCurrentPage('home')} className="nav-button">Home</button>
                {user.role === 'teacher' && (
                  <button onClick={() => setCurrentPage('teacher-dashboard')} className="nav-button">Teacher Dashboard</button>
                )}
                {user.role === 'student' && (
                  <button onClick={() => setCurrentPage('student-dashboard')} className="nav-button">Student Dashboard</button>
                )}
                {user.role === 'admin' && (
                  <button onClick={() => setCurrentPage('admin-dashboard')} className="nav-button">Admin Dashboard</button>
                )}
                <span className="text-blue-300 hidden md:inline">|</span>
                <span className="text-blue-100 font-medium text-base md:text-lg">Welcome, {user.name} ({user.role})</span>
                {/* Logout button. */}
                <button onClick={logout} className="ml-4 bg-red-500 px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition duration-300 shadow-md">Logout</button>
              </div>
            </div>
          </nav>

          {/* Main Content Area with background */}
          <main
            className="flex-grow container mx-auto p-6 md:p-8 my-8 relative bg-cover bg-center rounded-lg shadow-xl overflow-hidden"
            style={{ backgroundImage: `url('https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')` }}
          >
            <div className="absolute inset-0 bg-white opacity-90 rounded-lg"></div> {/* Semi-transparent overlay */}
            <div className="relative z-10"> {/* Content wrapper */}
              {/* Simple Routing Logic based on currentPage state. */}
              {currentPage === 'home' && (
                <HomePage user={user} setCurrentPage={setCurrentPage} allTeachers={allTeachers} />
              )}
              {currentPage === 'teacher-dashboard' && user.role === 'teacher' && (
                <TeacherDashboard user={user} />
              )}
              {currentPage === 'student-dashboard' && user.role === 'student' && (
                <StudentDashboard user={user} allTeachers={allTeachers} />
              )}
              {currentPage === 'admin-dashboard' && user.role === 'admin' && (
                <AdminDashboard user={user} allTeachers={allTeachers} setAllTeachers={setAllTeachers} />
              )}
            </div>
          </main>

          {/* Footer */}
          <footer className="bg-gray-800 text-white p-4 text-center text-sm shadow-inner">
            <p>&copy; 2025 AppointEase. All rights reserved.</p>
          </footer>
        </div>
      );
    };

    // --- HomePage Component ---
    // Displays available teachers for students and directs other roles to their dashboards.
    const HomePage = ({ user, setCurrentPage, allTeachers }) => {
      const [message, setMessage] = useState(''); // Message for user feedback.
      const [searchTerm, setSearchTerm] = useState(''); // State for teacher search input.

      // Filters teachers based on search term (name, email, or subjects).
      const filteredTeachers = allTeachers.filter(teacher =>
        teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.teacherProfile?.subjects?.some(subject =>
          subject.toLowerCase().includes(searchTerm.toLowerCase())
        ) ||
        teacher.teacherProfile?.department?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return (
        <div className="space-y-8">
          <h2 className="text-4xl font-extrabold text-gray-900 text-center mb-6">Welcome to AppointEase!</h2>
          <p className="text-xl text-gray-700 text-center mb-4">
            Hello, <span className="font-semibold text-blue-700">{user.name}</span>! You are logged in as a <span className="font-semibold text-purple-700">{user.role}</span>.
          </p>

          {user.role === 'student' && (
            <div className="bg-blue-50 p-6 rounded-xl shadow-inner border border-blue-200">
              <h3 className="text-2xl font-bold mb-5 text-blue-800">Available Teachers</h3>
              {message && <p className="text-red-600 mb-4 bg-red-100 p-3 rounded-md border border-red-200">{message}</p>}

              {/* Search Bar for Teachers */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search teachers by name, email, subject, or department..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {filteredTeachers.length === 0 ? (
                <p className="text-gray-600 text-lg">No teachers found matching your search criteria.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTeachers.map(teacher => (
                    <div key={teacher._id} className="bg-white p-5 rounded-xl shadow-lg border border-gray-200 transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
                      <h4 className="text-xl font-bold text-gray-800 mb-2">{teacher.name}</h4>
                      <p className="text-gray-600 text-sm mb-3">Email: {teacher.email}</p>
                      {teacher.teacherProfile && (
                        <>
                          <p className="text-gray-700 font-medium text-base">Department: <span className="text-indigo-700">{teacher.teacherProfile.department || 'N/A'}</span></p>
                          <p className="text-gray-700 font-medium text-base">Subjects: <span className="text-indigo-700">{teacher.teacherProfile.subjects?.join(', ') || 'N/A'}</span></p>
                          <p className="text-gray-700 font-medium mt-2">Availability:</p>
                          <ul className="list-disc list-inside text-gray-600 text-sm ml-4">
                            {/* Display availability if available, otherwise 'N/A' */}
                            {teacher.teacherProfile.availability && teacher.teacherProfile.availability.length > 0 ? (
                              teacher.teacherProfile.availability.map((slot, idx) => (
                                <li key={idx} className="mb-1">{slot.day} at {slot.time}</li>
                              ))
                            ) : (
                              <li>N/A</li>
                            )}
                          </ul>
                        </>
                      )}
                      <button
                        onClick={() => {
                          setMessage(`You are about to book with ${teacher.name}. Navigate to Student Dashboard to complete.`);
                          setCurrentPage('student-dashboard'); // Redirect to student dashboard to book.
                        }}
                        className="mt-5 w-full bg-gradient-to-r from-green-500 to-teal-600 text-white px-5 py-2 rounded-lg font-semibold hover:from-green-600 hover:to-teal-700 transition duration-300 shadow-md hover:shadow-lg"
                      >
                        Book Appointment
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {user.role === 'teacher' && (
            <div className="bg-purple-50 p-6 rounded-xl shadow-inner border border-purple-200 text-center">
              <h3 className="text-2xl font-bold mb-4 text-purple-800">Your Teacher Hub</h3>
              <p className="text-gray-700 text-lg mb-6">Manage your profile, availability, and appointments from your dedicated dashboard.</p>
              <button
                onClick={() => setCurrentPage('teacher-dashboard')}
                className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white px-6 py-3 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-indigo-800 transition duration-300 shadow-md hover:shadow-lg"
              >
                Go to Teacher Dashboard
              </button>
            </div>
          )}

          {user.role === 'admin' && (
            <div className="bg-red-50 p-6 rounded-xl shadow-inner border border-red-200 text-center">
              <h3 className="text-2xl font-bold mb-4 text-red-800">Admin Control Panel</h3>
              <p className="text-gray-700 text-lg mb-6">Oversee all users and appointments across the system for comprehensive management.</p>
              <button
                onClick={() => setCurrentPage('admin-dashboard')}
                className="bg-gradient-to-r from-red-600 to-pink-700 text-white px-6 py-3 rounded-lg font-bold text-lg hover:from-red-700 hover:to-pink-800 transition duration-300 shadow-md hover:shadow-lg"
              >
                Go to Admin Dashboard
              </button>
            </div>
          )}
        </div>
      );
    };

    // --- TeacherDashboard Component ---
    // Allows teachers to manage their profile, appointments, and view messages.
    const TeacherDashboard = ({ user }) => {
      const { token } = useAuth();
      // Initialize profile from user data, with defaults if not present.
      const [profile, setProfile] = useState(user.teacherProfile || { subjects: [], availability: [], department: '' });
      const [appointments, setAppointments] = useState([]);
      const [messages, setMessages] = useState([]);
      const [message, setMessage] = useState('');
      const [isLoading, setIsLoading] = useState(false); // Loading state for API operations.

      // States for editing profile fields, initialized from current user profile.
      const [editingSubjects, setEditingSubjects] = useState(profile.subjects.join(', '));
      const [editingAvailability, setEditingAvailability] = useState(profile.availability.map(s => `${s.day} ${s.time}`).join('\n'));
      const [editingDepartment, setEditingDepartment] = useState(profile.department || ''); // New state for department

      // useCallback memoizes the fetchData function to prevent unnecessary re-creation.
      const fetchData = useCallback(async () => {
        setIsLoading(true); // Set loading true when fetching starts.
        setMessage(''); // Clear previous messages.
        try {
          // Fetch teacher's specific profile to ensure it's up-to-date.
          const profileData = await api.getTeacherProfile(user._id);
          // Ensure profileData.teacherProfile exists before accessing its properties
          setProfile(profileData.teacherProfile || { subjects: [], availability: [], department: '' });
          setEditingSubjects(profileData.teacherProfile?.subjects?.join(', ') || '');
          setEditingAvailability(profileData.teacherProfile?.availability?.map(s => `${s.day} ${s.time}`).join('\n') || '');
          setEditingDepartment(profileData.teacherProfile?.department || ''); // Set department for editing

          // Fetch teacher's appointments.
          const myAppointments = await api.getMyAppointments(token);
          setAppointments(myAppointments);

          // Fetch messages for the teacher.
          const myMessages = await api.getMessagesForUser(token);
          setMessages(myMessages);

        } catch (error) {
          setMessage(error.data?.message || error.message || 'Failed to fetch dashboard data.');
        } finally {
          setIsLoading(false); // Set loading false when fetching ends.
        }
      }, [user._id, token]); // Dependencies: user ID and token.

      // Effect to call fetchData on component mount and when dependencies change.
      useEffect(() => {
        fetchData();
      }, [fetchData]); // Dependency: memoized fetchData.

      // Handles updating the teacher's profile.
      const handleProfileUpdate = async (e) => {
        e.preventDefault(); // Prevent default form submission.
        setMessage('');
        setIsLoading(true); // Set loading true.
        try {
          // Parse subjects from comma-separated string to array.
          const subjectsArray = editingSubjects.split(',').map(s => s.trim()).filter(s => s);
          // Parse availability from newline-separated string to array of objects.
          const availabilityArray = editingAvailability.split('\n').map(line => {
            const parts = line.trim().split(' ');
            if (parts.length >= 2) {
              // Assuming format "Day Time", e.g., "Monday 10:00 AM"
              return { day: parts[0], time: parts.slice(1).join(' ') };
            }
            return null; // Invalid format.
          }).filter(s => s); // Filter out any nulls from invalid lines.

          const updatedData = {
            _id: user._id, // Send user's own ID for update endpoint.
            subjects: subjectsArray,
            availability: availabilityArray,
            department: editingDepartment, // Include department in update.
          };

          const data = await api.updateTeacherProfile(updatedData, token);
          setProfile(data.teacherProfile); // Update local profile state.
          setMessage('Profile updated successfully!');
        } catch (error) {
          setMessage(error.data?.message || error.message || 'Failed to update profile.');
        } finally {
          setIsLoading(false); // Set loading false.
        }
      };

      // Handles updating the status of an appointment.
      const handleAppointmentStatusUpdate = async (appointmentId, newStatus) => {
        setMessage('');
        setIsLoading(true);
        try {
          const data = await api.updateAppointmentStatus(appointmentId, { status: newStatus }, token);
          // Update the local appointments state with the updated appointment.
          setAppointments(prev => prev.map(app => app._id === appointmentId ? data.appointment : app));
          setMessage(`Appointment ${appointmentId} status updated to ${newStatus}.`);
        } catch (error) {
          setMessage(error.data?.message || error.message || 'Failed to update appointment status.');
        } finally {
          setIsLoading(false);
        }
      };

      // Handles marking a message as read.
      const handleMarkMessageAsRead = async (messageId) => {
        setMessage('');
        setIsLoading(true);
        try {
          await api.request(`/messages/${messageId}/read`, 'PUT', null, token);
          // Update the message in local state to marked as read.
          setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, read: true } : msg));
          setMessage('Message marked as read.');
        } catch (error) {
          setMessage(error.data?.message || error.message || 'Failed to mark message as read.');
        } finally {
          setIsLoading(false);
        }
      };


      return (
        <div
          className="space-y-8 p-6 rounded-xl shadow-lg relative bg-cover bg-center"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')` }}
        >
          <div className="absolute inset-0 bg-white opacity-80 rounded-xl"></div>
          <div className="relative z-10">
            <h2 className="text-4xl font-extrabold text-gray-900 text-center mb-6">Teacher Dashboard</h2>
            <p className="text-xl text-gray-700 text-center mb-4">Welcome, <span className="font-semibold text-blue-700">{user.name}</span>!</p>
            {isLoading && <p className="text-center text-blue-600 mb-4 animate-pulse">Loading data...</p>}
            {message && (
              <p className={`text-center mb-4 p-3 rounded-md border ${message.includes('successfully') ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                {message}
              </p>
            )}

            {/* Profile Management Section */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
              <h3 className="text-2xl font-bold mb-5 text-gray-800">Your Profile</h3>
              <form onSubmit={handleProfileUpdate} className="space-y-5">
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="subjects">Subjects (comma-separated)</label>
                  <input
                    type="text"
                    id="subjects"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                    value={editingSubjects}
                    onChange={(e) => setEditingSubjects(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="department">Department</label>
                  <input
                    type="text"
                    id="department"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                    value={editingDepartment}
                    onChange={(e) => setEditingDepartment(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="availability">Availability (Day Time, one per line)</label>
                  <textarea
                    id="availability"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-y transition duration-200"
                    value={editingAvailability}
                    onChange={(e) => setEditingAvailability(e.target.value)}
                    placeholder="e.g., Monday 10:00 AM&#10;Wednesday 02:00 PM&#10;Friday 11:30 AM"
                    disabled={isLoading}
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-green-500 to-teal-600 text-white py-3 px-6 rounded-lg font-bold text-lg hover:from-green-600 hover:to-teal-700 transition duration-300 shadow-md hover:shadow-lg"
                  disabled={isLoading} // Disable button when loading.
                >
                  {isLoading ? 'Updating...' : 'Update Profile'}
                </button>
              </form>
            </div>

            {/* Appointments List Section */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
              <h3 className="text-2xl font-bold mb-5 text-gray-800">Your Appointments</h3>
              {appointments.length === 0 ? (
                <p className="text-gray-600 text-lg">No appointments found.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {appointments.map(appointment => (
                    <div key={appointment._id} className="bg-blue-50 p-5 rounded-xl shadow-md border border-blue-200">
                      <p className="text-gray-800 font-semibold text-lg mb-1">Student: <span className="text-blue-700">{appointment.student?.name || 'N/A'}</span></p>
                      <p className="text-gray-600 text-sm mb-2">Email: {appointment.student?.email || 'N/A'}</p>
                      <p className="text-gray-700 text-base">Date: <span className="font-medium">{new Date(appointment.date).toLocaleDateString()}</span></p>
                      <p className="text-gray-700 text-base">Time: <span className="font-medium">{appointment.time}</span></p>
                      <p className="text-gray-700 text-base mb-3">Subject: <span className="font-medium">{appointment.subject}</span></p>
                      {/* Dynamic status styling */}
                      <p className={`font-bold mt-2 text-lg ${appointment.status === 'confirmed' ? 'text-green-600' : appointment.status === 'cancelled' ? 'text-red-600' : appointment.status === 'completed' ? 'text-purple-600' : 'text-yellow-600'}`}>
                        Status: {appointment.status.toUpperCase()}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        {/* Conditional buttons based on appointment status */}
                        {appointment.status === 'pending' && (
                          <button
                            onClick={() => handleAppointmentStatusUpdate(appointment._id, 'confirmed')}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 shadow-sm"
                            disabled={isLoading}
                          >
                            Confirm
                          </button>
                        )}
                        {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                          <button
                            onClick={() => handleAppointmentStatusUpdate(appointment._id, 'cancelled')}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition duration-200 shadow-sm"
                            disabled={isLoading}
                          >
                            Cancel
                          </button>
                        )}
                        {appointment.status === 'confirmed' && (
                          <button
                            onClick={() => handleAppointmentStatusUpdate(appointment._id, 'completed')}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition duration-200 shadow-sm"
                            disabled={isLoading}
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* View Messages Section for Teacher */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <h3 className="text-2xl font-bold mb-5 text-gray-800">Your Messages</h3>
              {messages.length === 0 ? (
                <p className="text-gray-600 text-lg">No messages received.</p>
              ) : (
                <div className="space-y-4">
                  {messages.map(msg => (
                    <div key={msg._id} className={`p-4 rounded-lg shadow-sm border ${msg.read ? 'bg-gray-100 border-gray-200' : 'bg-blue-50 border-blue-200 font-medium'}`}>
                      <p className="font-semibold text-lg">From: <span className="text-blue-700">{msg.sender?.name || 'N/A'}</span> ({msg.sender?.email || 'N/A'})</p>
                      <p className="text-gray-700 text-base">Subject: <span className="font-medium">{msg.subject || 'No Subject'}</span></p>
                      <p className="text-gray-800 mt-2">{msg.content}</p>
                      <p className="text-xs text-gray-500 mt-2 text-right">Received: {new Date(msg.createdAt).toLocaleString()}</p>
                      {!msg.read && (
                        <button
                          onClick={() => handleMarkMessageAsRead(msg._id)}
                          className="mt-2 bg-indigo-500 text-white px-3 py-1 rounded-md text-sm hover:bg-indigo-600"
                          disabled={isLoading}
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

    // --- StudentDashboard Component ---
    // Allows students to book appointments, send messages, and view their appointments.
    const StudentDashboard = ({ user, allTeachers }) => {
      const { token } = useAuth();
      const [appointments, setAppointments] = useState([]);
      const [messages, setMessages] = useState([]); // State for messages
      const [message, setMessage] = useState('');
      const [isLoading, setIsLoading] = useState(false); // Loading state for API operations.

      const teachers = allTeachers; // Use the teachers passed from App.js.

      // States for new appointment booking form.
      const [selectedTeacherId, setSelectedTeacherId] = useState('');
      const [appointmentDate, setAppointmentDate] = useState('');
      const [appointmentTime, setAppointmentTime] = useState('');
      const [appointmentSubject, setAppointmentSubject] = useState('');

      // States for sending message form.
      const [messageRecipientTeacherId, setMessageRecipientTeacherId] = useState('');
      const [messageSubject, setMessageSubject] = useState('');
      const [messageContent, setMessageContent] = useState('');

      // useCallback memoizes the fetchData function.
      const fetchData = useCallback(async () => {
        setIsLoading(true); // Set loading true.
        setMessage(''); // Clear messages.
        try {
          const myAppointments = await api.getMyAppointments(token);
          setAppointments(myAppointments);

          const myMessages = await api.getMessagesForUser(token);
          setMessages(myMessages); // Fetch messages for student too

        } catch (error) {
          setMessage(error.data?.message || error.message || 'Failed to fetch dashboard data.');
        } finally {
          setIsLoading(false); // Set loading false.
        }
      }, [token]); // Dependency: token.

      // Effect to call fetchData on component mount and when dependencies change.
      useEffect(() => {
        fetchData();
      }, [fetchData]); // Dependency: memoized fetchData.

      // Handles booking a new appointment.
      const handleBookAppointment = async (e) => {
        e.preventDefault(); // Prevent default form submission.
        setMessage('');
        setIsLoading(true);
        if (!selectedTeacherId || !appointmentDate || !appointmentTime || !appointmentSubject) {
          setMessage('Please select a teacher, date, time, and subject to book an appointment.');
          setIsLoading(false);
          return;
        }

        try {
          const newAppointment = await api.bookAppointment(
            {
              teacherId: selectedTeacherId,
              date: appointmentDate, // This is 'YYYY-MM-DD' from input type="date".
              time: appointmentTime,
              subject: appointmentSubject,
            },
            token
          );
          // Add the newly booked appointment to the list.
          setAppointments(prev => [...prev, newAppointment.appointment]);
          setMessage('Appointment booked successfully!');
          // Clear form fields.
          setSelectedTeacherId('');
          setAppointmentDate('');
          setAppointmentTime('');
          setAppointmentSubject('');
        } catch (error) {
          setMessage(error.data?.message || error.message || 'Failed to book appointment.');
        } finally {
          setIsLoading(false);
        }
      };

      // Handles cancelling an existing appointment.
      const handleCancelAppointment = async (appointmentId) => {
        setMessage('');
        setIsLoading(true);
        try {
          const data = await api.updateAppointmentStatus(appointmentId, { status: 'cancelled' }, token);
          // Update the local appointments state with the cancelled appointment.
          setAppointments(prev => prev.map(app => app._id === appointmentId ? data.appointment : app));
          setMessage(`Appointment ${appointmentId} has been cancelled.`);
        } catch (error) {
          setMessage(error.data?.message || error.message || 'Failed to cancel appointment.');
        } finally {
          setIsLoading(false);
        }
      };

      // Handles sending a message to a teacher.
      const handleSendMessage = async (e) => {
        e.preventDefault(); // Prevent default form submission.
        setMessage('');
        setIsLoading(true);
        if (!messageRecipientTeacherId || !messageContent) {
          setMessage('Please select a teacher and type a message to send.');
          setIsLoading(false);
          return;
        }

        try {
          const sentMessage = await api.sendMessage(
            {
              recipientId: messageRecipientTeacherId,
              subject: messageSubject,
              content: messageContent,
            },
            token
          );
          setMessage('Message sent successfully!');
          // Clear form fields.
          setMessageRecipientTeacherId('');
          setMessageSubject('');
          setMessageContent('');
          // Re-fetch messages to show the sent message in the inbox
          fetchData();
        } catch (error) {
          setMessage(error.data?.message || error.message || 'Failed to send message.');
        } finally {
          setIsLoading(false);
        }
      };

      // Handles marking a message as read.
      const handleMarkMessageAsRead = async (messageId) => {
        setMessage('');
        setIsLoading(true);
        try {
          await api.request(`/messages/${messageId}/read`, 'PUT', null, token);
          setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, read: true } : msg));
          setMessage('Message marked as read.');
        } catch (error) {
          setMessage(error.data?.message || error.message || 'Failed to mark message as read.');
        } finally {
          setIsLoading(false);
        }
      };


      return (
        <div
          className="space-y-8 p-6 rounded-xl shadow-lg relative bg-cover bg-center"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')` }}
        >
          <div className="absolute inset-0 bg-white opacity-80 rounded-xl"></div>
          <div className="relative z-10">
            <h2 className="text-4xl font-extrabold text-gray-900 text-center mb-6">Student Dashboard</h2>
            <p className="text-xl text-gray-700 text-center mb-4">Welcome, <span className="font-semibold text-blue-700">{user.name}</span>!</p>
            {isLoading && <p className="text-center text-blue-600 mb-4 animate-pulse">Loading data...</p>}
            {message && (
              <p className={`text-center mb-4 p-3 rounded-md border ${message.includes('successfully') ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                {message}
              </p>
            )}

            {/* Book New Appointment Section */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
              <h3 className="text-2xl font-bold mb-5 text-gray-800">Book a New Appointment</h3>
              <form onSubmit={handleBookAppointment} className="space-y-5">
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="teacherSelect">Select Teacher</label>
                  <select
                    id="teacherSelect"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 bg-white"
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    required
                    disabled={isLoading} // Disable during loading.
                  >
                    <option value="">-- Select a Teacher --</option>
                    {teachers.map(teacher => (
                      <option key={teacher._id} value={teacher._id}>{teacher.name} ({teacher.email}) - {teacher.teacherProfile?.department || 'N/A'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="appointmentDate">Date</label>
                  <input
                    type="date"
                    id="appointmentDate"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    required
                    disabled={isLoading} // Disable during loading.
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="appointmentTime">Time</label>
                  <input
                    type="time"
                    id="appointmentTime"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    required
                    disabled={isLoading} // Disable during loading.
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="appointmentSubject">Subject</label>
                  <input
                    type="text"
                    id="appointmentSubject"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                    value={appointmentSubject}
                    onChange={(e) => setAppointmentSubject(e.target.value)}
                    required // Subject is now required.
                    disabled={isLoading} // Disable during loading.
                  />
                </div>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 px-6 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-indigo-800 transition duration-300 shadow-md hover:shadow-lg"
                  disabled={isLoading} // Disable during loading.
                >
                  {isLoading ? 'Booking...' : 'Book Appointment'}
                </button>
              </form>
            </div>

            {/* Send Message to Teacher Section */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
              <h3 className="text-2xl font-bold mb-5 text-gray-800">Send Message to Teacher</h3>
              <form onSubmit={handleSendMessage} className="space-y-5">
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="messageRecipientTeacher">Select Recipient Teacher</label>
                  <select
                    id="messageRecipientTeacher"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 bg-white"
                    value={messageRecipientTeacherId}
                    onChange={(e) => setMessageRecipientTeacherId(e.target.value)}
                    required
                    disabled={isLoading} // Disable during loading.
                  >
                    <option value="">-- Select a Teacher --</option>
                    {teachers.map(teacher => (
                      <option key={teacher._id} value={teacher._id}>{teacher.name} ({teacher.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="messageSubject">Subject (Optional)</label>
                  <input
                    type="text"
                    id="messageSubject"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                    value={messageSubject}
                    onChange={(e) => setMessageSubject(e.target.value)}
                    disabled={isLoading} // Disable during loading.
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="messageContent">Message</label>
                  <textarea
                    id="messageContent"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-y transition duration-200"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    required
                    disabled={isLoading} // Disable during loading.
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-pink-700 text-white py-3 px-6 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-pink-800 transition duration-300 shadow-md hover:shadow-lg"
                  disabled={isLoading} // Disable during loading.
                >
                  {isLoading ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>

            {/* Your Messages List Section for Student */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
              <h3 className="text-2xl font-bold mb-5 text-gray-800">Your Messages</h3>
              {messages.length === 0 ? (
                <p className="text-gray-600 text-lg">No messages found.</p>
              ) : (
                <div className="space-y-4">
                  {messages.map(msg => (
                    <div key={msg._id} className={`p-4 rounded-lg shadow-sm border ${msg.read ? 'bg-gray-100 border-gray-200' : 'bg-blue-50 border-blue-200 font-medium'}`}>
                      <p className="font-semibold text-lg">
                        {msg.sender?._id === user._id ? 'To' : 'From'}:
                        <span className="text-blue-700 ml-1">{msg.sender?._id === user._id ? (msg.recipient?.name || 'N/A') : (msg.sender?.name || 'N/A')}</span>
                        ({msg.sender?._id === user._id ? (msg.recipient?.email || 'N/A') : (msg.sender?.email || 'N/A')})
                      </p>
                      <p className="text-gray-700 text-base">Subject: <span className="font-medium">{msg.subject || 'No Subject'}</span></p>
                      <p className="text-gray-800 mt-2">{msg.content}</p>
                      <p className="text-xs text-gray-500 mt-2 text-right">Sent: {new Date(msg.createdAt).toLocaleString()}</p>
                      {!msg.read && msg.recipient?._id === user._id && ( // Only show "Mark as Read" if current user is recipient and message is unread
                        <button
                          onClick={() => handleMarkMessageAsRead(msg._id)}
                          className="mt-2 bg-indigo-500 text-white px-3 py-1 rounded-md text-sm hover:bg-indigo-600"
                          disabled={isLoading}
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>


            {/* Your Appointments List Section */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <h3 className="text-2xl font-bold mb-5 text-gray-800">Your Appointments</h3>
              {appointments.length === 0 ? (
                <p className="text-gray-600 text-lg">You have no appointments booked.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {appointments.map(appointment => (
                    <div key={appointment._id} className="bg-blue-50 p-5 rounded-xl shadow-md border border-blue-200">
                      <p className="text-gray-800 font-semibold text-lg mb-1">Teacher: <span className="text-blue-700">{appointment.teacher?.name || 'N/A'}</span></p>
                      <p className="text-gray-600 text-sm mb-2">Email: {appointment.teacher?.email || 'N/A'}</p>
                      <p className="text-gray-700 text-base">Date: <span className="font-medium">{new Date(appointment.date).toLocaleDateString()}</span></p>
                      <p className="text-gray-700 text-base">Time: <span className="font-medium">{appointment.time}</span></p>
                      <p className="text-gray-700 text-base mb-3">Subject: <span className="font-medium">{appointment.subject}</span></p>
                      {/* Dynamic status styling */}
                      <p className={`font-bold mt-2 text-lg ${appointment.status === 'confirmed' ? 'text-green-600' : appointment.status === 'cancelled' ? 'text-red-600' : appointment.status === 'completed' ? 'text-purple-600' : 'text-yellow-600'}`}>
                        Status: {appointment.status.toUpperCase()}
                      </p>
                      {appointment.status === 'pending' && (
                        <button
                          onClick={() => handleCancelAppointment(appointment._id)}
                          className="mt-5 bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition duration-200 shadow-sm"
                          disabled={isLoading} // Disable during loading.
                        >
                          Cancel Appointment
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

    // --- AdminDashboard Component ---
    // Allows admins to manage teachers, approve student registrations, and view all appointments.
    const AdminDashboard = ({ user, allTeachers, setAllTeachers }) => {
      const { token } = useAuth();
      const [allAppointments, setAllAppointments] = useState([]);
      const [allUsers, setAllUsers] = useState([]); // State to hold all users (for admin management)
      const [message, setMessage] = useState('');
      const [isLoading, setIsLoading] = useState(false); // Loading state for API operations.

      // States for Add User/Teacher Form.
      const [newUserName, setNewUserName] = useState('');
      const [newUserEmail, setNewUserEmail] = useState('');
      const [newUserPassword, setNewUserPassword] = useState('');
      const [newUserRole, setNewUserRole] = useState('student'); // Default for new user form
      const [newUserDepartment, setNewUserDepartment] = useState('');
      const [newUserSubjects, setNewUserSubjects] = useState('');

      // State for Update User Form
      const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
      const [editUserName, setEditUserName] = useState('');
      const [editUserEmail, setEditUserEmail] = useState('');
      const [editUserRole, setEditUserRole] = useState('');
      const [editUserDepartment, setEditUserDepartment] = useState('');
      const [editUserSubjects, setEditUserSubjects] = useState('');
      const [editIsAdminApproved, setEditIsAdminApproved] = useState(false);
      const [editUserPassword, setEditUserPassword] = useState(''); // For optional password change

      // useCallback memoizes the fetchData function.
      const fetchData = useCallback(async () => {
        setIsLoading(true);
        setMessage('');
        try {
          // Fetch all appointments for admin view.
          const appointmentsData = await api.getAllAppointments(token);
          setAllAppointments(appointmentsData);

          // Fetch all users for admin management.
          const usersData = await api.getAllUsers(token); // Using the new API call
          setAllUsers(usersData);

        } catch (error) {
          setMessage(error.data?.message || error.message || 'Failed to fetch admin dashboard data.');
          // Fallback to empty arrays if API fails.
          setAllAppointments([]);
          setAllUsers([]);
        } finally {
          setIsLoading(false);
        }
      }, [token]);

      // Effect to call fetchData on component mount and when dependencies change.
      useEffect(() => {
        fetchData();
      }, [fetchData]);

      // Handles adding a new user (teacher or student) via admin panel.
      const handleAddUser = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsLoading(true);
        if (!newUserName || !newUserEmail || !newUserPassword || !newUserRole) {
          setMessage('Please fill all required fields (Name, Email, Password, Role) for adding a user.');
          setIsLoading(false);
          return;
        }

        const userData = {
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
          // Include teacher-specific profile data only if the role is 'teacher'.
          teacherProfile: newUserRole === 'teacher' ? {
            subjects: newUserSubjects.split(',').map(s => s.trim()).filter(s => s),
            department: newUserDepartment,
            availability: [], // New teachers start with no availability
          } : undefined,
          isAdminApproved: newUserRole === 'student' ? false : true, // Students might need approval.
        };

        try {
          const addedUser = await api.addUser(userData, token); // Using the new API call
          setAllUsers(prev => [...prev, addedUser]); // Add new user to local state.
          // If the added user is a teacher, update the global allTeachers list too.
          if (addedUser.role === 'teacher') {
            setAllTeachers(prev => [...prev, addedUser]);
          }
          setMessage('User added successfully!');
          // Clear form fields.
          setNewUserName('');
          setNewUserEmail('');
          setNewUserPassword('');
          setNewUserRole('student');
          setNewUserDepartment('');
          setNewUserSubjects('');
        } catch (error) {
          setMessage(error.data?.message || error.message || 'Failed to add user.');
        } finally {
          setIsLoading(false);
        }
      };

      // Sets the selected user for editing.
      const handleEditUserClick = (user) => {
        setSelectedUserForEdit(user);
        setEditUserName(user.name);
        setEditUserEmail(user.email);
        setEditUserRole(user.role);
        setEditUserDepartment(user.teacherProfile?.department || '');
        setEditUserSubjects(user.teacherProfile?.subjects?.join(', ') || '');
        setEditIsAdminApproved(user.isAdminApproved);
        setEditUserPassword(''); // Clear password field for security.
      };

      // Handles updating an existing user via admin panel.
      const handleUpdateUser = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsLoading(true);
        if (!selectedUserForEdit) {
          setIsLoading(false);
          return;
        }

        const updatedData = {
          name: editUserName,
          email: editUserEmail,
          role: editUserRole,
          isAdminApproved: editIsAdminApproved,
          // Only include password if it's provided (i.e., user wants to change it).
          ...(editUserPassword && { password: editUserPassword }),
        };

        // Include teacherProfile updates if the user is a teacher.
        if (editUserRole === 'teacher') {
          updatedData.teacherProfile = {
            subjects: editUserSubjects.split(',').map(s => s.trim()).filter(s => s),
            department: editUserDepartment,
            availability: selectedUserForEdit.teacherProfile?.availability || [], // Preserve existing availability
          };
        } else {
          // If role is changed from teacher, ensure teacherProfile is not sent or cleared.
          updatedData.teacherProfile = undefined; // Explicitly set to undefined to remove it if not a teacher
        }

        try {
          const updatedUser = await api.updateUser(selectedUserForEdit._id, updatedData, token); // Using the new API call
          setAllUsers(prev => prev.map(u => u._id === updatedUser._id ? updatedUser : u)); // Update local allUsers state.
          // Update global allTeachers list if the role is teacher.
          if (updatedUser.role === 'teacher') {
            setAllTeachers(prev => prev.map(t => t._id === updatedUser._id ? updatedUser : t));
          } else {
            // If role changed from teacher, remove from allTeachers list.
            setAllTeachers(prev => prev.filter(t => t._id !== updatedUser._id));
          }
          setMessage('User updated successfully!');
          setSelectedUserForEdit(null); // Close edit form.
        } catch (error) {
          setMessage(error.data?.message || error.message || 'Failed to update user.');
        } finally {
          setIsLoading(false);
        }
      };

      // Handles deleting a user via admin panel.
      const handleDeleteUser = async (userId) => {
        setMessage('');
        setIsLoading(true);
        // Using a custom modal/dialog would be better than window.confirm in a real app.
        if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
          try {
            await api.deleteUser(userId, token); // Using the new API call
            setAllUsers(prev => prev.filter(u => u._id !== userId)); // Remove from local state.
            setAllTeachers(prev => prev.filter(t => t._id !== userId)); // Also remove from global teachers list.
            setMessage('User removed successfully!');
          } catch (error) {
            setMessage(error.data?.message || error.message || 'Failed to delete user.');
          } finally {
            setIsLoading(false);
          }
        } else {
          setIsLoading(false); // If user cancels, stop loading.
        }
      };

      // Handles approving a student registration.
      const handleApproveStudent = async (studentId) => {
        setMessage('');
        setIsLoading(true);
        try {
          const updatedUser = await api.updateUser(studentId, { isAdminApproved: true }, token); // Using the new API call
          setAllUsers(prev => prev.map(u => u._id === updatedUser._id ? updatedUser : u));
          setMessage('Student registration approved!');
        } catch (error) {
          setMessage(error.data?.message || error.message || 'Failed to approve student registration.');
        } finally {
          setIsLoading(false);
        }
      };

      // Filter pending students from all users for display.
      const pendingStudents = allUsers.filter(user => user.role === 'student' && !user.isAdminApproved);


      return (
        <div
          className="space-y-8 p-6 rounded-xl shadow-lg relative bg-cover bg-center"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1522071820081-009f0129c76d?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')` }}
        >
          <div className="absolute inset-0 bg-white opacity-80 rounded-xl"></div>
          <div className="relative z-10">
            <h2 className="text-4xl font-extrabold text-gray-900 text-center mb-6">Admin Dashboard</h2>
            <p className="text-xl text-gray-700 text-center mb-4">Welcome, <span className="font-semibold text-blue-700">{user.name}</span>!</p>
            {isLoading && <p className="text-center text-blue-600 mb-4 animate-pulse">Loading data...</p>}
            {message && (
              <p className={`text-center mb-4 p-3 rounded-md border ${message.includes('successfully') ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                {message}
              </p>
            )}

            {/* Add User/Teacher Section */}
            <div className="bg-gradient-to-br from-blue-100 to-purple-100 p-8 rounded-xl shadow-2xl border border-blue-200 mb-8">
              <h3 className="text-3xl font-bold text-center mb-6 text-blue-800">Add New User (Teacher/Student)</h3>
              <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="newUserName">Name</label>
                  <input
                    type="text"
                    id="newUserName"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 shadow-sm"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="newUserEmail">Email</label>
                  <input
                    type="email"
                    id="newUserEmail"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 shadow-sm"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="newUserPassword">Password</label>
                  <input
                    type="password"
                    id="newUserPassword"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 shadow-sm"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="newUserRole">Role</label>
                  <select
                    id="newUserRole"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 bg-white shadow-sm"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    required
                    disabled={isLoading}
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {newUserRole === 'teacher' && (
                  <>
                    <div>
                      <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="newUserDepartment">Department</label>
                      <input
                        type="text"
                        id="newUserDepartment"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 shadow-sm"
                        value={newUserDepartment}
                        onChange={(e) => setNewUserDepartment(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="newUserSubjects">Subjects (comma-separated)</label>
                      <input
                        type="text"
                        id="newUserSubjects"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 shadow-sm"
                        value={newUserSubjects}
                        onChange={(e) => setNewUserSubjects(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </>
                )}
                <div className="md:col-span-2 flex justify-center">
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-green-500 to-teal-600 text-white py-3 px-8 rounded-lg font-bold text-lg hover:from-green-600 hover:to-teal-700 transition duration-300 shadow-md hover:shadow-lg transform hover:scale-105"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Adding User...' : 'Add User'}
                  </button>
                </div>
              </form>
            </div>

            {/* Manage All Users Section */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
              <h3 className="text-2xl font-bold mb-5 text-gray-800">Manage All Users</h3>
              {allUsers.length === 0 ? (
                <p className="text-gray-600 text-lg">No users to manage.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {allUsers.map(userItem => (
                    <div key={userItem._id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center">
                      <div>
                        <p className="font-semibold text-lg">{userItem.name} (<span className="text-gray-700">{userItem.email}</span>)</p>
                        <p className="text-sm text-gray-600">Role: <span className="font-medium capitalize">{userItem.role}</span></p>
                        {userItem.role === 'teacher' && (
                          <>
                            <p className="text-sm text-gray-600">Dept: {userItem.teacherProfile?.department || 'N/A'}</p>
                            <p className="text-sm text-gray-600">Subjects: {userItem.teacherProfile?.subjects?.join(', ') || 'N/A'}</p>
                          </>
                        )}
                        {userItem.role === 'student' && (
                          <p className="text-sm text-gray-600">Approved: {userItem.isAdminApproved ? 'Yes' : 'No'}</p>
                        )}
                      </div>
                      <div className="mt-3 md:mt-0 flex space-x-2">
                        <button onClick={() => handleEditUserClick(userItem)} className="bg-yellow-500 text-white px-3 py-1 rounded-md text-sm hover:bg-yellow-600" disabled={isLoading}>Edit</button>
                        {userItem._id !== user._id && ( // Prevent admin from deleting themselves
                          <button onClick={() => handleDeleteUser(userItem._id)} className="bg-red-600 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700" disabled={isLoading}>Delete</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedUserForEdit && (
                <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-200">
                  <h4 className="text-xl font-bold mb-4 text-blue-800">Edit User: {selectedUserForEdit.name}</h4>
                  <form onSubmit={handleUpdateUser} className="space-y-4">
                    <div>
                      <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="editUserName">Name</label>
                      <input type="text" id="editUserName" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 shadow-sm" value={editUserName} onChange={(e) => setEditUserName(e.target.value)} required disabled={isLoading} />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="editUserEmail">Email</label>
                      <input type="email" id="editUserEmail" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 shadow-sm" value={editUserEmail} onChange={(e) => setEditUserEmail(e.target.value)} required disabled={isLoading} />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="editUserRole">Role</label>
                      <select
                        id="editUserRole"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 bg-white shadow-sm"
                        value={editUserRole}
                        onChange={(e) => setEditUserRole(e.target.value)}
                        required
                        disabled={isLoading}
                      >
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    {editUserRole === 'teacher' && (
                      <>
                        <div>
                          <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="editUserDepartment">Department</label>
                          <input type="text" id="editUserDepartment" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 shadow-sm" value={editUserDepartment} onChange={(e) => setEditUserDepartment(e.target.value)} disabled={isLoading} />
                        </div>
                        <div>
                          <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="editUserSubjects">Subjects (comma-separated)</label>
                          <input type="text" id="editUserSubjects" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 shadow-sm" value={editUserSubjects} onChange={(e) => setEditUserSubjects(e.target.value)} disabled={isLoading} />
                        </div>
                      </>
                    )}
                    {editUserRole === 'student' && (
                      <div>
                        <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="editIsAdminApproved">Admin Approved</label>
                        <input type="checkbox" id="editIsAdminApproved" className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" checked={editIsAdminApproved} onChange={(e) => setEditIsAdminApproved(e.target.checked)} disabled={isLoading} />
                      </div>
                    )}
                    <div>
                      <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="editUserPassword">New Password (optional)</label>
                      <input type="password" id="editUserPassword" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 shadow-sm" value={editUserPassword} onChange={(e) => setEditUserPassword(e.target.value)} disabled={isLoading} />
                    </div>
                    <div className="flex space-x-3">
                      <button type="submit" className="bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition duration-200" disabled={isLoading}>
                        {isLoading ? 'Updating...' : 'Update User'}
                      </button>
                      <button type="button" onClick={() => setSelectedUserForEdit(null)} className="bg-gray-400 text-white py-2 px-4 rounded-lg font-semibold hover:bg-gray-500 transition duration-200" disabled={isLoading}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Approve Student Registrations Section */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
              <h3 className="text-2xl font-bold mb-5 text-gray-800">Pending Student Registrations</h3>
              {pendingStudents.length === 0 ? (
                <p className="text-gray-600 text-lg">No pending student registrations.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {pendingStudents.map(student => (
                    <div key={student._id} className="bg-yellow-50 p-4 rounded-lg shadow-sm border border-yellow-200 flex flex-col md:flex-row justify-between items-start md:items-center">
                      <div>
                        <p className="font-semibold text-lg">{student.name} (<span className="text-gray-700">{student.email}</span>)</p>
                      </div>
                      <div className="mt-3 md:mt-0">
                        <button onClick={() => handleApproveStudent(student._id)} className="bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700" disabled={isLoading}>Approve</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* All Appointments in System Section */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <h3 className="text-2xl font-bold mb-5 text-gray-800">All Appointments in System</h3>
              {allAppointments.length === 0 ? (
                <p className="text-gray-600 text-lg">No appointments found in the system.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {allAppointments.map(appointment => (
                    <div key={appointment._id} className="bg-blue-50 p-5 rounded-xl shadow-md border border-blue-200">
                      <p className="text-gray-800 font-semibold text-lg mb-1">Teacher: <span className="text-blue-700">{appointment.teacher?.name || 'N/A'}</span></p>
                      <p className="text-gray-800 font-semibold text-lg mb-1">Student: <span className="text-blue-700">{appointment.student?.name || 'N/A'}</span></p>
                      <p className="text-gray-700 text-base">Date: <span className="font-medium">{new Date(appointment.date).toLocaleDateString()}</span></p>
                      <p className="text-gray-700 text-base">Time: <span className="font-medium">{appointment.time}</span></p>
                      <p className="text-gray-700 text-base mb-3">Subject: <span className="font-medium">{appointment.subject}</span></p>
                      {/* Dynamic status styling */}
                      <p className={`font-bold mt-2 text-lg ${appointment.status === 'confirmed' ? 'text-green-600' : appointment.status === 'cancelled' ? 'text-red-600' : appointment.status === 'completed' ? 'text-purple-600' : 'text-yellow-600'}`}>
                        Status: {appointment.status.toUpperCase()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

    // --- Root Component for rendering ---
    // This is the default export that will be rendered by the Canvas environment.
    export default function RootApp() {
      return (
        <AuthProvider>
          <App />
        </AuthProvider>
      );
    }
    