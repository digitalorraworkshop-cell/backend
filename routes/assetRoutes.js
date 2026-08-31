const express = require('express');
const router = express.Router();
const {
    addProduct,
    updateProduct,
    deleteProduct,
    distributeProduct,
    returnProduct,
    getProducts,
    getDistributions,
    getEmployeeAssets,
    getAssetStats
} = require('../controllers/inventoryController');
const { protect, isAssetsManager } = require('../middleware/authMiddleware');

// Stats Overview
router.get('/stats', protect, isAssetsManager, getAssetStats);

// Product Management
router.post('/products', protect, isAssetsManager, addProduct);
router.get('/products', protect, isAssetsManager, getProducts);
router.put('/products/:id', protect, isAssetsManager, updateProduct);
router.delete('/products/:id', protect, isAssetsManager, deleteProduct);

// Distribution Management
router.post('/distribute', protect, isAssetsManager, distributeProduct);
router.get('/distributions', protect, isAssetsManager, getDistributions);
router.post('/return/:id', protect, isAssetsManager, returnProduct);

// Employee Specific
router.get('/employee/:id', protect, getEmployeeAssets);

module.exports = router;

