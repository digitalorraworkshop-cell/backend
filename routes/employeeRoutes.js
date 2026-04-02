const express = require('express');
const router = express.Router();
const { getEmployees, getEmployeeById, addEmployee, deleteEmployee, resetPassword, updateEmployee } = require('../controllers/employeeController');
const { protect, admin, isManager } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.route('/')
    .get(protect, isManager, getEmployees)
    .post(protect, admin, (req, res, next) => {
        upload.single('profilePicture')(req, res, (err) => {
            if (err) {
                if (err.message === 'Images only!') {
                    return res.status(400).json({ message: err.message });
                }
                console.error('Upload Error:', err);
                return res.status(400).json({ message: 'File upload failed: ' + err.message });
            }
            next();
        });
    }, addEmployee);

router.route('/:id')
    .get(protect, isManager, getEmployeeById)
    .put(protect, admin, (req, res, next) => {
        upload.single('profilePicture')(req, res, (err) => {
            if (err) {
                if (err.message === 'Images only!') {
                    return res.status(400).json({ message: err.message });
                }
                console.error('Upload Error:', err);
                return res.status(400).json({ message: 'File upload failed: ' + err.message });
            }
            next();
        });
    }, updateEmployee)
    .delete(protect, admin, deleteEmployee);

router.route('/:id/reset-password')
    .put(protect, admin, resetPassword);

module.exports = router;
