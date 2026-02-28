const express = require('express');
const router = express.Router();
const { getEmployees, getEmployeeById, addEmployee, deleteEmployee, resetPassword, updateEmployee } = require('../controllers/employeeController');
const { protect, admin } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.route('/')
    .get(protect, admin, getEmployees)
    .post(protect, admin, (req, res, next) => {
        upload.single('profilePicture')(req, res, (err) => {
            if (err) {
                // If error is not about file type (e.g. unexpected field), just log and proceed without file? 
                // Multer throws error if file filter fails.
                // We want to allow NO file. But if file is present and invalid type, we should error.
                if (err.message === 'Images only!') {
                    return res.status(400).json({ message: err.message });
                }
                // For other errors, log and maybe proceed or error?
                console.error('Upload Error:', err);
                return res.status(400).json({ message: 'File upload failed: ' + err.message });
            }
            next();
        });
    }, addEmployee);

router.route('/:id')
    .get(protect, admin, getEmployeeById)
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
