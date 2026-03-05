const express = require('express');
const router = express.Router();
const {
    addProduct,
    distributeProduct,
    returnProduct,
    getProducts,
    getDistributions,
    getEmployeeAssets
} = require('../controllers/inventoryController');
const { protect, admin } = require('../middleware/authMiddleware');

// Product Management
router.post('/products', protect, admin, addProduct);
router.get('/products', protect, admin, getProducts);

// Distribution Management
router.post('/distribute', protect, admin, distributeProduct);
router.get('/distributions', protect, admin, getDistributions);
router.post('/return/:id', protect, admin, returnProduct);

// Employee Specific
router.get('/employee/:id', protect, getEmployeeAssets);

module.exports = router;
