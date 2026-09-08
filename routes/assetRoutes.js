const express = require('express');
const router = express.Router();
const {
    getAssetStats,
    getAssets,
    createAsset,
    updateAsset,
    deleteAsset,
    addProduct,
    getProducts,
    updateProduct,
    deleteProduct,
    getRepairs,
    createRepair,
    updateRepair,
    distributeProduct,
    returnProduct,
    getDistributions,
    getEmployeeAssets
} = require('../controllers/inventoryController');
const { protect, isAssetsManager } = require('../middleware/authMiddleware');

// Base Legacy & Catch-All Asset Endpoints
router.get('/', protect, isAssetsManager, getAssets);
router.post('/', protect, isAssetsManager, createAsset);
router.put('/:id', protect, isAssetsManager, updateProduct);
router.delete('/:id', protect, isAssetsManager, deleteProduct);

// Stats Overview & Analytics
router.get('/stats', protect, isAssetsManager, getAssetStats);
router.get('/dashboard-stats', protect, isAssetsManager, getAssetStats);

// Fixed IT Hardware Assets
router.get('/items', protect, isAssetsManager, getAssets);
router.post('/items', protect, isAssetsManager, createAsset);
router.put('/items/:id', protect, isAssetsManager, updateAsset);
router.delete('/items/:id', protect, isAssetsManager, deleteAsset);

// Consumable Inventory & Accessories
router.post('/products', protect, isAssetsManager, addProduct);
router.get('/products', protect, isAssetsManager, getProducts);
router.put('/products/:id', protect, isAssetsManager, updateProduct);
router.delete('/products/:id', protect, isAssetsManager, deleteProduct);

// IT Service & Repairs
router.get('/repairs', protect, isAssetsManager, getRepairs);
router.post('/repairs', protect, isAssetsManager, createRepair);
router.put('/repairs/:id', protect, isAssetsManager, updateRepair);

// Distribution & Allocations
router.post('/distribute', protect, isAssetsManager, distributeProduct);
router.get('/distributions', protect, isAssetsManager, getDistributions);
router.post('/return/:id', protect, isAssetsManager, returnProduct);

// Employee Specific Assets
router.get('/employee/:id', protect, getEmployeeAssets);

module.exports = router;
