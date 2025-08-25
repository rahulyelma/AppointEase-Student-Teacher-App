// admin.js - Handles Admin specific functionalities

/**
 * Sets up all event listeners and initial rendering for the Admin Dashboard.
 * This function is called by main.js when an Admin user logs in.
 */
window.setupAdminListeners = () => {
    window.log('info', 'Setting up Admin dashboard listeners.');
    const adminContentArea = document.getElementById('admin-content-area');

    // Listener for "Add Teacher" button
    document.getElementById('admin-add-teacher-btn').addEventListener('click', () => {
        renderAddTeacherForm(adminContentArea);
    });

    // Listener for "View/Update/Delete Teachers" button
    document.getElementById('admin-view-teachers-btn').addEventListener('click', () => {
        renderManageTeachers(adminContentArea);
    });

    // Listener for "Approve/Reject Students" button
    document.getElementById('admin-approve-students-btn').addEventListener('click', () => {
        renderApproveStudents(adminContentArea);
    });

    // Listener for "View Reports" button (Placeholder)
    document.getElementById('admin-view-reports-btn').addEventListener('click', async () => {
        adminContentArea.innerHTML = `
            <h4 class="text-xl font-semibold mb-4 text-gray-800">System Reports (Coming Soon!)</h4>
            <p class="text-gray-600">This section will provide detailed analytics and reports.</p>
        `;
        window.log('info', 'Admin: View Reports button clicked.');
        await window.showCustomModal('Feature Coming Soon', 'The reporting functionality is under development.');
    });

    // Listener for "System Settings" button (Placeholder)
    document.getElementById('admin-settings-btn').addEventListener('click', async () => {
        adminContentArea.innerHTML = `
            <h4 class="text-xl font-semibold mb-4 text-gray-800">System Settings (Coming Soon!)</h4>
            <p class="text-gray-600">This section will allow configuration of global application settings.</p>
        `;
        window.log('info', 'Admin: System Settings button clicked.');
        await window.showCustomModal('Feature Coming Soon', 'System settings configuration is under development.');
    });

    // Initial content for admin dashboard
    adminContentArea.innerHTML = `
        <h4 class="text-xl font-semibold mb-4 text-gray-800">Welcome to Admin Panel!</h4>
        <p class="text-gray-600">Use the navigation above to manage teachers, approve student registrations, and view reports.</p>
    `;
};

/**
 * Renders the form for adding a new teacher.
 * @param {HTMLElement} container - The DOM element to render the form into.
 */
function renderAddTeacherForm(container) {
    window.log('info', 'Admin: Rendering Add Teacher form.');
    container.innerHTML = `
        <h4 class="text-xl font-semibold mb-6 text-gray-800">Add New Teacher</h4>
        <form id="add-teacher-form" class="space-y-4 bg-white p-6 rounded-lg shadow-md">
            <div>
                <label for="teacher-email" class="label-field">Email:</label>
                <input type="email" id="teacher-email" class="input-field" placeholder="teacher@example.com" required>
            </div>
            <div>
                <label for="teacher-password" class="label-field">Temporary Password:</label>
                <input type="password" id="teacher-password" class="input-field" placeholder="Min 6 characters" required>
            </div>
            <div>
                <label for="teacher-name" class="label-field">Full Name:</label>
                <input type="text" id="teacher-name" class="input-field" placeholder="John Doe" required>
            </div>
            <div>
                <label for="teacher-department" class="label-field">Department:</label>
                <input type="text" id="teacher-department" class="input-field" placeholder="Computer Science" required>
            </div>
            <div>
                <label for="teacher-subject" class="label-field">Subject(s) Taught (comma-separated):</label>
                <input type="text" id="teacher-subject" class="input-field" placeholder="Math, Physics, Chemistry" required>
            </div>
            <button type="submit" class="btn-primary w-full py-2">Add Teacher</button>
        </form>
    `;

    document.getElementById('add-teacher-form').addEventListener('submit', handleAddTeacher);
}

/**
 * Handles the submission of the add teacher form.
 * Creates a new Firebase Auth user and stores teacher profile in Firestore.
 * @param {Event} event - The form submission event.
 */
async function handleAddTeacher(event) {
    event.preventDefault();
    window.showLoadingSpinner(true);
    const email = document.getElementById('teacher-email').value;
    const password = document.getElementById('teacher-password').value;
    const name = document.getElementById('teacher-name').value;
    const department = document.getElementById('teacher-department').value;
    const subjects = document.getElementById('teacher-subject').value.split(',').map(s => s.trim()).filter(s => s.length > 0);

    if (password.length < 6) {
        await window.showCustomModal('Error', 'Temporary password must be at least 6 characters long.');
        window.showLoadingSpinner(false);
        return;
    }

    try {
        // 1. Create user in Firebase Authentication
        const userCredential = await window.auth.createUserWithEmailAndPassword(window.auth, email, password);
        const uid = userCredential.user.uid;

        // 2. Store teacher profile in Firestore
        // Public data: /artifacts/{appId}/public/data/teachers/{teacherId}
        const teacherProfileRef = window.doc(window.db, `artifacts/${window.appId}/public/data/teachers`, uid);
        await window.setDoc(teacherProfileRef, {
            uid: uid,
            email: email,
            name: name,
            department: department,
            subjects: subjects,
            role: 'teacher',
            status: 'approved', // Teachers added by admin are immediately approved
            createdAt: new Date().toISOString()
        });

        // 3. Also create a private profile entry for the teacher (for consistency with student profiles)
        // Private data: /artifacts/{appId}/users/{userId}/profile/data
        const privateProfileRef = window.doc(window.db, `artifacts/${window.appId}/users/${uid}/profile`, 'data');
        await window.setDoc(privateProfileRef, {
            email: email,
            role: 'teacher',
            status: 'approved',
            createdAt: new Date().toISOString()
        });


        window.log('info', `Admin: Teacher added successfully: ${name} (${email})`);
        await window.showCustomModal('Success', `Teacher ${name} added successfully! Temporary password: ${password}.`);
        document.getElementById('add-teacher-form').reset(); // Clear form
    } catch (error) {
        window.log('error', 'Admin: Failed to add teacher:', { code: error.code, message: error.message });
        let errorMessage = `Failed to add teacher: ${error.message}`;
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already in use by another account.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak. Please use a stronger password.';
        }
        await window.showCustomModal('Error', errorMessage);
    } finally {
        window.showLoadingSpinner(false);
    }
}

/**
 * Renders the list of teachers for management (view, update, delete).
 * @param {HTMLElement} container - The DOM element to render the list into.
 */
async function renderManageTeachers(container) {
    window.log('info', 'Admin: Rendering Manage Teachers list.');
    container.innerHTML = `
        <h4 class="text-xl font-semibold mb-6 text-gray-800">Manage Teachers</h4>
        <div id="teachers-list-container" class="bg-white p-6 rounded-lg shadow-md">
            <p class="text-gray-600 text-center">Loading teachers...</p>
        </div>
    `;
    window.showLoadingSpinner(true);

    try {
        const teachersColRef = window.collection(window.db, `artifacts/${window.appId}/public/data/teachers`);
        const q = window.query(teachersColRef);
        const querySnapshot = await window.getDocs(q);

        let teachers = [];
        querySnapshot.forEach(doc => {
            teachers.push({ id: doc.id, ...doc.data() });
        });

        if (teachers.length === 0) {
            container.querySelector('#teachers-list-container').innerHTML = '<p class="text-gray-600 text-center">No teachers found.</p>';
            return;
        }

        let tableHtml = `
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead class="bg-gray-100 border-b border-gray-200">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subjects</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
        `;
        teachers.forEach(teacher => {
            tableHtml += `
                <tr data-id="${teacher.id}">
                    <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${teacher.name}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-600">${teacher.email}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-600">${teacher.department}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-600">${teacher.subjects ? teacher.subjects.join(', ') : 'N/A'}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <button class="btn-secondary btn-sm edit-teacher-btn mr-2" data-id="${teacher.id}">Edit</button>
                        <button class="btn-danger btn-sm delete-teacher-btn" data-id="${teacher.id}">Delete</button>
                    </td>
                </tr>
            `;
        });
        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;
        container.querySelector('#teachers-list-container').innerHTML = tableHtml;

        // Attach event listeners for edit and delete buttons
        container.querySelectorAll('.edit-teacher-btn').forEach(button => {
            button.addEventListener('click', (e) => showEditTeacherModal(e.target.dataset.id));
        });
        container.querySelectorAll('.delete-teacher-btn').forEach(button => {
            button.addEventListener('click', (e) => handleDeleteTeacher(e.target.dataset.id));
        });

    } catch (error) {
        window.log('error', 'Admin: Error fetching teachers:', { error: error.message });
        container.querySelector('#teachers-list-container').innerHTML = `<p class="text-red-600 text-center">Failed to load teachers: ${error.message}</p>`;
    } finally {
        window.showLoadingSpinner(false);
    }
}

/**
 * Displays a modal for editing teacher details.
 * @param {string} teacherId - The UID of the teacher to edit.
 */
async function showEditTeacherModal(teacherId) {
    window.log('info', `Admin: Showing edit modal for teacher ID: ${teacherId}`);
    window.showLoadingSpinner(true);
    try {
        const teacherDocRef = window.doc(window.db, `artifacts/${window.appId}/public/data/teachers`, teacherId);
        const teacherDocSnap = await window.getDoc(teacherDocRef);

        if (!teacherDocSnap.exists()) {
            await window.showCustomModal('Error', 'Teacher not found.');
            return;
        }
        const teacherData = teacherDocSnap.data();

        const modalHtml = `
            <h3 class="text-xl font-medium text-gray-800 mb-4">Edit Teacher: ${teacherData.name}</h3>
            <form id="edit-teacher-form" class="space-y-4 text-left">
                <div>
                    <label for="edit-teacher-name" class="label-field">Full Name:</label>
                    <input type="text" id="edit-teacher-name" class="input-field" value="${teacherData.name || ''}" required>
                </div>
                <div>
                    <label for="edit-teacher-email" class="label-field">Email:</label>
                    <input type="email" id="edit-teacher-email" class="input-field" value="${teacherData.email || ''}" required disabled>
                </div>
                <div>
                    <label for="edit-teacher-department" class="label-field">Department:</label>
                    <input type="text" id="edit-teacher-department" class="input-field" value="${teacherData.department || ''}" required>
                </div>
                <div>
                    <label for="edit-teacher-subject" class="label-field">Subject(s) Taught (comma-separated):</label>
                    <input type="text" id="edit-teacher-subject" class="input-field" value="${teacherData.subjects ? teacherData.subjects.join(', ') : ''}" required>
                </div>
                <div class="flex justify-end space-x-4 mt-6">
                    <button type="button" id="cancel-edit-teacher-btn" class="btn-secondary">Cancel</button>
                    <button type="submit" class="btn-primary">Save Changes</button>
                </div>
            </form>
        `;
        await window.showCustomModal('Edit Teacher', modalHtml, false); // Use false to show OK button by default, then replace with custom buttons

        // Manually replace modal body with form and attach listeners
        const modalBodyElement = document.getElementById('modal-body');
        modalBodyElement.innerHTML = modalHtml;
        document.getElementById('modal-header').textContent = 'Edit Teacher';
        document.getElementById('modal-footer').classList.add('hidden'); // Hide default modal footer buttons

        document.getElementById('edit-teacher-form').addEventListener('submit', (e) => handleUpdateTeacher(e, teacherId));
        document.getElementById('cancel-edit-teacher-btn').addEventListener('click', () => document.getElementById('custom-modal').classList.add('hidden'));

    } catch (error) {
        window.log('error', 'Admin: Error showing edit teacher modal:', { error: error.message });
        await window.showCustomModal('Error', `Failed to load teacher data for editing: ${error.message}`);
    } finally {
        window.showLoadingSpinner(false);
    }
}

/**
 * Handles updating teacher details in Firestore.
 * @param {Event} event - The form submission event.
 * @param {string} teacherId - The UID of the teacher to update.
 */
async function handleUpdateTeacher(event, teacherId) {
    event.preventDefault();
    window.showLoadingSpinner(true);
    const name = document.getElementById('edit-teacher-name').value;
    const department = document.getElementById('edit-teacher-department').value;
    const subjects = document.getElementById('edit-teacher-subject').value.split(',').map(s => s.trim()).filter(s => s.length > 0);

    try {
        const teacherDocRef = window.doc(window.db, `artifacts/${window.appId}/public/data/teachers`, teacherId);
        await window.updateDoc(teacherDocRef, {
            name: name,
            department: department,
            subjects: subjects,
            updatedAt: new Date().toISOString()
        });

        window.log('info', `Admin: Teacher ${name} (${teacherId}) updated successfully.`);
        await window.showCustomModal('Success', `Teacher ${name} updated successfully!`);
        document.getElementById('custom-modal').classList.add('hidden'); // Close modal
        renderManageTeachers(document.getElementById('admin-content-area')); // Re-render list
    } catch (error) {
        window.log('error', 'Admin: Failed to update teacher:', { error: error.message });
        await window.showCustomModal('Error', `Failed to update teacher: ${error.message}`);
    } finally {
        window.showLoadingSpinner(false);
    }
}

/**
 * Handles deleting a teacher from Firebase.
 * Note: Deleting a user from Auth requires Firebase Cloud Functions or manual deletion in console.
 * For this client-side app, we'll only delete the profile data.
 * @param {string} teacherId - The UID of the teacher to delete.
 */
async function handleDeleteTeacher(teacherId) {
    window.log('warn', `Admin: Attempting to delete teacher ID: ${teacherId}`);
    const confirmDelete = await window.showCustomModal(
        'Confirm Deletion',
        'Are you sure you want to delete this teacher? This action cannot be undone.',
        true
    );

    if (!confirmDelete) {
        window.log('info', 'Admin: Teacher deletion cancelled.');
        return;
    }

    window.showLoadingSpinner(true);
    try {
        // Delete public teacher profile
        const teacherDocRef = window.doc(window.db, `artifacts/${window.appId}/public/data/teachers`, teacherId);
        await window.deleteDoc(teacherDocRef);

        // Delete private user profile (for consistency)
        const privateProfileRef = window.doc(window.db, `artifacts/${window.appId}/users/${teacherId}/profile`, 'data');
        await window.deleteDoc(privateProfileRef);

        // IMPORTANT: To fully delete the user from Firebase Authentication,
        // you would typically use a Firebase Cloud Function triggered by an admin action,
        // as client-side deletion of other users is not allowed for security reasons.
        // For this project, we are only removing their profile data.
        window.log('info', `Admin: Teacher profile data for ${teacherId} deleted successfully.`);
        await window.showCustomModal('Success', 'Teacher profile deleted successfully. Note: User must be manually deleted from Firebase Authentication if not handled by Cloud Functions.');
        renderManageTeachers(document.getElementById('admin-content-area')); // Re-render list
    } catch (error) {
        window.log('error', 'Admin: Failed to delete teacher:', { error: error.message });
        await window.showCustomModal('Error', `Failed to delete teacher: ${error.message}`);
    } finally {
        window.showLoadingSpinner(false);
    }
}


/**
 * Renders the list of pending student registrations for approval/rejection.
 * @param {HTMLElement} container - The DOM element to render the list into.
 */
async function renderApproveStudents(container) {
    window.log('info', 'Admin: Rendering Approve Students list.');
    container.innerHTML = `
        <h4 class="text-xl font-semibold mb-6 text-gray-800">Approve Student Registrations</h4>
        <div id="pending-students-list-container" class="bg-white p-6 rounded-lg shadow-md">
            <p class="text-gray-600 text-center">Loading pending students...</p>
        </div>
    `;
    window.showLoadingSpinner(true);

    try {
        // Query for users with role 'student' and status 'pending'
        const usersColRef = window.collection(window.db, `artifacts/${window.appId}/users`);
        const q = window.query(
            usersColRef,
            window.where('profile.data.role', '==', 'student'),
            window.where('profile.data.status', '==', 'pending')
        );
        const querySnapshot = await window.getDocs(q);

        let pendingStudents = [];
        querySnapshot.forEach(doc => {
            // Firestore query for subcollection documents requires careful handling
            // We need to fetch the 'data' document within the 'profile' subcollection
            const profileData = doc.data().profile?.data; // Access the nested profile.data
            if (profileData && profileData.role === 'student' && profileData.status === 'pending') {
                pendingStudents.push({ id: doc.id, ...profileData });
            }
        });

        if (pendingStudents.length === 0) {
            container.querySelector('#pending-students-list-container').innerHTML = '<p class="text-gray-600 text-center">No pending student registrations.</p>';
            return;
        }

        let tableHtml = `
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead class="bg-gray-100 border-b border-gray-200">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered At</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
        `;
        pendingStudents.forEach(student => {
            const registeredDate = student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'N/A';
            tableHtml += `
                <tr data-id="${student.id}">
                    <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${student.email}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-600">${registeredDate}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <button class="btn-primary btn-sm approve-student-btn mr-2" data-id="${student.id}">Approve</button>
                        <button class="btn-danger btn-sm reject-student-btn" data-id="${student.id}">Reject</button>
                    </td>
                </tr>
            `;
        });
        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;
        container.querySelector('#pending-students-list-container').innerHTML = tableHtml;

        // Attach event listeners for approve and reject buttons
        container.querySelectorAll('.approve-student-btn').forEach(button => {
            button.addEventListener('click', (e) => handleStudentApproval(e.target.dataset.id, 'approved'));
        });
        container.querySelectorAll('.reject-student-btn').forEach(button => {
            button.addEventListener('click', (e) => handleStudentApproval(e.target.dataset.id, 'rejected'));
        });

    } catch (error) {
        window.log('error', 'Admin: Error fetching pending students:', { error: error.message });
        container.querySelector('#pending-students-list-container').innerHTML = `<p class="text-red-600 text-center">Failed to load pending students: ${error.message}</p>`;
    } finally {
        window.showLoadingSpinner(false);
    }
}

/**
 * Handles approving or rejecting a student registration.
 * @param {string} studentId - The UID of the student.
 * @param {string} status - The new status ('approved' or 'rejected').
 */
async function handleStudentApproval(studentId, status) {
    window.log('info', `Admin: Attempting to set student ${studentId} status to ${status}.`);
    const confirmAction = await window.showCustomModal(
        'Confirm Action',
        `Are you sure you want to ${status} this student's registration?`,
        true
    );

    if (!confirmAction) {
        window.log('info', 'Admin: Student approval/rejection cancelled.');
        return;
    }

    window.showLoadingSpinner(true);
    try {
        const studentProfileRef = window.doc(window.db, `artifacts/${window.appId}/users/${studentId}/profile`, 'data');
        await window.updateDoc(studentProfileRef, {
            status: status,
            updatedAt: new Date().toISOString(),
            approvedBy: window.currentUserId() // Record which admin approved/rejected
        });

        window.log('info', `Admin: Student ${studentId} status updated to ${status}.`);
        await window.showCustomModal('Success', `Student registration ${status} successfully!`);
        renderApproveStudents(document.getElementById('admin-content-area')); // Re-render list
    } catch (error) {
        window.log('error', `Admin: Failed to update student ${studentId} status to ${status}:`, { error: error.message });
        await window.showCustomModal('Error', `Failed to update student status: ${error.message}`);
    } finally {
        window.showLoadingSpinner(false);
    }
}

