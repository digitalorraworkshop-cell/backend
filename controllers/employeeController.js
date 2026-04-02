const User = require('../models/User');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Attendance = require('../models/Attendance');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// Generate strong random password
const generatePassword = () => {
    const length = 16;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";

    // Ensure at least one of each required character type
    password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(Math.floor(Math.random() * 26));
    password += "abcdefghijklmnopqrstuvwxyz".charAt(Math.floor(Math.random() * 26));
    password += "0123456789".charAt(Math.floor(Math.random() * 10));
    password += "!@#$%^&*".charAt(Math.floor(Math.random() * 8));

    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    // Shuffle password
    password = password.split('').sort(() => 0.5 - Math.random()).join('');
    return password;
};

// Generate unique username
const generateUsername = async (name) => {
    let isUnique = false;
    let username = "";
    // Clean name: remove spaces and special chars, take first part
    const namePrefix = name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    while (!isUnique) {
        // Generate namePrefix + 4 random digits (e.g., vikas4921)
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        username = `${namePrefix}${randomNum}`;

        const existingUser = await User.findOne({ username });
        if (!existingUser) {
            isUnique = true;
        }
    }
    return username;
};

// @desc    Register a new employee
// @route   POST /api/employees
// @access  Private/Admin
const addEmployee = async (req, res) => {
    try {
        const { name, email, phone, position, salary, department, dateOfBirth } = req.body;
        let profilePicture = '';

        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'employee_profiles',
                public_id: `${name.replace(/\s+/g, '_').toLowerCase()}-${Date.now()}`
            });
            profilePicture = result.secure_url;
            fs.unlinkSync(req.file.path);
        }

        // Check if employee with same email exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        console.log(`[EMPLOYEE-DEBUG] Adding Employee: ${name}, DOB incoming: "${dateOfBirth}"`);

        // Generate unique credentials
        const username = await generateUsername(name);
        const password = generatePassword();

        console.log(`[AUTH-DEBUG] Creating Employee: ${name}`);
        const user = await User.create({
            name,
            email,
            username,
            password,
            role: 'employee',
            phone,
            position,
            salary,
            department,
            profilePicture,
            dateOfBirth
        });

        console.log(`[EMPLOYEE-DEBUG] Employee Created. Saved DOB: ${user.dateOfBirth}`);

        if (user) {
            res.status(201).json({
                success: true,
                message: 'Employee created successfully',
                _id: user._id,
                name: user.name,
                email: user.email,
                username: user.username,
                generatedPassword: password, // Plain text for single-use display
                role: user.role,
                phone: user.phone,
                position: user.position,
                salary: user.salary,
                department: user.department,
                profilePicture: user.profilePicture,
                dateOfBirth: user.dateOfBirth
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error("Error adding employee:", error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private/Admin
const updateEmployee = async (req, res) => {
    try {
        const { name, email, phone, position, salary, department, dateOfBirth } = req.body;
        console.log(`[EMPLOYEE-DEBUG] Updating Employee ID: ${req.params.id}, DOB incoming: "${dateOfBirth}"`);
        const user = await User.findById(req.params.id);

        if (user) {
            user.name = name || user.name;
            user.email = email || user.email;
            user.phone = phone || user.phone;
            user.position = position || user.position;
            user.salary = salary || user.salary;
            user.department = department || user.department;
            user.dateOfBirth = dateOfBirth || user.dateOfBirth;

            if (req.file) {
                const result = await cloudinary.uploader.upload(req.file.path, {
                    folder: 'employee_profiles',
                    public_id: `${(name || user.name).replace(/\s+/g, '_').toLowerCase()}-${Date.now()}`
                });
                user.profilePicture = result.secure_url;
                fs.unlinkSync(req.file.path);
            }

            const updatedUser = await user.save();
            console.log(`[EMPLOYEE-DEBUG] Employee Updated. Saved DOB: ${updatedUser.dateOfBirth}`);
            res.json({
                success: true,
                message: 'Employee updated successfully',
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                position: updatedUser.position,
                salary: updatedUser.salary,
                department: updatedUser.department,
                profilePicture: updatedUser.profilePicture,
                dateOfBirth: updatedUser.dateOfBirth
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error("Error updating employee:", error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};

// @desc    Delete employee
// @route   DELETE /api/employees/:id
// @access  Private/Admin
const deleteEmployee = async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        await user.deleteOne();
        res.json({ message: 'User removed' });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Reset employee password
// @route   PUT /api/employees/:id/reset-password
// @access  Private/Admin
const resetPassword = async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        const newPassword = generatePassword();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });

        res.json({
            success: true,
            message: 'Password reset successfully',
            username: user.username,
            generatedPassword: newPassword
        });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private/Admin
const getEmployees = async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'admin' || req.user.role === 'seo-manager') {
            query.role = { $in: ['employee', 'seo-manager', 'seo-team'] };
        } else {
            query.role = 'employee'; // Fallback
        }

        const employees = await User.find(query).select('-password');

        // Enhance: Check today's attendance for each employee to verify "Working" status
        const todayStr = new Date().toLocaleDateString('en-CA');
        const attendanceRecords = await Attendance.find({ date: todayStr });

        const enhancedEmployees = employees.map(emp => {
            const hasActiveAttendance = attendanceRecords.find(a =>
                a.user.toString() === emp._id.toString() &&
                a.checkInTime &&
                !a.checkOutTime
            );

            // If they are checked in but model says Offline/Online, force "Working" for the UI
            let currentStatus = emp.currentStatus;
            if (hasActiveAttendance && (['Offline', 'Online', 'Idle'].includes(emp.currentStatus))) {
                currentStatus = 'Working';
            }

            return {
                ...emp._doc,
                currentStatus
            };
        });

        res.json(enhancedEmployees);
    } catch (error) {
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};

// @desc    Get employee by ID
// @route   GET /api/employees/:id
// @access  Private/Admin
const getEmployeeById = async (req, res) => {
    try {
        const employee = await User.findById(req.params.id).select('-password');
        if (employee) {
            res.json(employee);
        } else {
            res.status(404).json({ message: 'Employee not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};

module.exports = { getEmployees, getEmployeeById, addEmployee, deleteEmployee, resetPassword, updateEmployee };
