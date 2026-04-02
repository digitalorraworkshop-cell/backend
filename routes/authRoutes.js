const express = require('express');
const router = express.Router();
const { loginUser, registerUser } = require('../controllers/authController');

router.post('/login', loginUser);
// router.post('/register', registerUser); // Uncomment to create initial admin if needed or use seed script

module.exports = router;
