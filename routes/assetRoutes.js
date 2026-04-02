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
const { protect, admin, isAssetsManager } = require('../middleware/authMiddleware');

// Product Management
router.post('/products', protect, isAssetsManager, addProduct);
router.get('/products', protect, isAssetsManager, getProducts);

// Distribution Management
router.post('/distribute', protect, isAssetsManager, distributeProduct);
router.get('/distributions', protect, isAssetsManager, getDistributions);
router.post('/return/:id', protect, isAssetsManager, returnProduct);

// Employee Specific
router.get('/employee/:id', protect, getEmployeeAssets);

module.exports = router;
