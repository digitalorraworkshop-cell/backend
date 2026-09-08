const Product = require('../models/Product');
const ProductDistribution = require('../models/ProductDistribution');
const Asset = require('../models/Asset');
const AssetHistory = require('../models/AssetHistory');
const RepairLog = require('../models/RepairLog');
const User = require('../models/User');

// Helper to generate Unique Asset ID tag if missing
const generateAssetId = async (category = 'LAP') => {
    const prefixMap = {
        'Laptop': 'IT-LAP-',
        'Computer': 'IT-PC-',
        'Desktop': 'IT-PC-',
        'Server': 'IT-SRV-',
        'Monitor': 'IT-MON-',
        'Printer': 'IT-PRN-',
        'Network Equipment': 'IT-NET-',
        'Software License': 'IT-LIC-',
        'Mobile': 'IT-MOB-'
    };
    const prefix = prefixMap[category] || 'IT-AST-';
    const count = await Asset.countDocuments();
    const randomNumber = String(count + 101).padStart(5, '0');
    return `${prefix}${randomNumber}`;
};

// @desc    Get Comprehensive Dashboard Stats & Alerts
// @route   GET /api/assets/stats
// @access  Private/AssetsManager
const getAssetStats = async (req, res) => {
    try {
        const assets = await Asset.find().populate('assignedTo', 'name email department');
        const products = await Product.find();
        const repairs = await RepairLog.find().populate('asset');
        const distributions = await ProductDistribution.find({ status: 'Assigned' });

        // 1. IT Asset Overview
        let assetOverview = {
            total: assets.length,
            inUse: 0,
            available: 0,
            underRepair: 0,
            retired: 0,
            scrap: 0,
            lostDamaged: 0,
            totalValuation: 0
        };

        assets.forEach(a => {
            const status = a.status || (a.assignedTo ? 'In Use' : 'Available');
            if (status === 'In Use' || status === 'Assigned') assetOverview.inUse++;
            else if (status === 'Available') assetOverview.available++;
            else if (status === 'Under Repair') assetOverview.underRepair++;
            else if (status === 'Retired') assetOverview.retired++;
            else if (status === 'Scrap') assetOverview.scrap++;
            else if (status === 'Lost/Damaged') assetOverview.lostDamaged++;

            assetOverview.totalValuation += (a.cost || 0);
        });

        // 2. Inventory / Consumable Summary
        let inventorySummary = {
            totalStockItems: products.length,
            totalQuantity: 0,
            availableQuantity: 0,
            lowStockCount: 0,
            outOfStockCount: 0,
            totalStockValue: 0,
            pendingPurchases: 0
        };

        products.forEach(p => {
            const avail = p.availableQuantity || 0;
            const threshold = p.lowStockThreshold || 5;
            inventorySummary.totalQuantity += (p.totalQuantity || 0);
            inventorySummary.availableQuantity += avail;
            inventorySummary.totalStockValue += (avail * (p.price || 0));

            if (avail === 0) inventorySummary.outOfStockCount++;
            else if (avail <= threshold) inventorySummary.lowStockCount++;

            if (p.pendingPurchase) inventorySummary.pendingPurchases++;
        });

        // 3. Accessories Breakdown
        let accessoriesBreakdown = {
            Mouse: 0,
            Keyboard: 0,
            Headset: 0,
            Charger: 0,
            Cable: 0,
            Adapter: 0,
            RAM: 0,
            SSD: 0,
            Other: 0
        };

        products.forEach(p => {
            const cat = p.category || 'Other';
            if (accessoriesBreakdown[cat] !== undefined) {
                accessoriesBreakdown[cat] += (p.availableQuantity || 0);
            } else {
                accessoriesBreakdown['Other'] += (p.availableQuantity || 0);
            }
        });

        // 4. Alerts Center
        const now = new Date();
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        let alerts = {
            warrantyExpiringSoon: [],
            amcExpiringSoon: [],
            licenseExpiringSoon: [],
            lowStockItems: [],
            repairPendingItems: [],
            assetNotReturned: []
        };

        assets.forEach(a => {
            if (a.warrantyExpiry && new Date(a.warrantyExpiry) <= in30Days && new Date(a.warrantyExpiry) >= now) {
                alerts.warrantyExpiringSoon.push({ id: a._id, name: a.itemName, tag: a.assetId, date: a.warrantyExpiry });
            }
            if (a.amcExpiry && new Date(a.amcExpiry) <= in30Days && new Date(a.amcExpiry) >= now) {
                alerts.amcExpiringSoon.push({ id: a._id, name: a.itemName, tag: a.assetId, date: a.amcExpiry });
            }
            if (a.licenseExpiry && new Date(a.licenseExpiry) <= in30Days && new Date(a.licenseExpiry) >= now) {
                alerts.licenseExpiringSoon.push({ id: a._id, name: a.itemName, tag: a.assetId, date: a.licenseExpiry });
            }
        });

        products.forEach(p => {
            const avail = p.availableQuantity || 0;
            const threshold = p.lowStockThreshold || 5;
            if (avail <= threshold) {
                alerts.lowStockItems.push({ id: p._id, name: p.modelName, category: p.category, available: avail, threshold });
            }
        });

        repairs.forEach(r => {
            if (r.status === 'Pending' || r.status === 'In Repair') {
                alerts.repairPendingItems.push({ id: r._id, itemName: r.itemName, tag: r.assetIdTag, problem: r.problemDescription, vendor: r.vendor });
            }
        });

        res.json({
            assetOverview,
            inventorySummary,
            accessoriesBreakdown,
            alerts,
            recentDistributionsCount: distributions.length
        });
    } catch (error) {
        console.error('[ASSET-STATS-ERROR]', error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== FIXED HARDWARE ASSETS ====================

// @desc    Get all Fixed Hardware Assets
// @route   GET /api/assets/items
// @access  Private/AssetsManager
const getAssets = async (req, res) => {
    try {
        const { category, status, search, location } = req.query;
        let query = {};

        if (category && category !== 'All') query.category = category;
        if (status && status !== 'All') query.status = status;
        if (location && location !== 'All') query.location = { $regex: location, $options: 'i' };

        if (search) {
            query.$or = [
                { itemName: { $regex: search, $options: 'i' } },
                { assetId: { $regex: search, $options: 'i' } },
                { serialNumber: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } },
                { department: { $regex: search, $options: 'i' } }
            ];
        }

        const assets = await Asset.find(query)
            .populate('assignedTo', 'name email department')
            .sort({ createdAt: -1 });

        res.json(assets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create Fixed Asset
// @route   POST /api/assets/items
// @access  Private/AssetsManager
const createAsset = async (req, res) => {
    try {
        const { itemName, category, serialNumber, purchaseDate, vendor, cost, warrantyExpiry, amcExpiry, licenseExpiry, condition, status, location, department, assignedTo } = req.body;

        let assetId = req.body.assetId;
        if (!assetId || assetId.trim() === '') {
            assetId = await generateAssetId(category);
        }

        const asset = await Asset.create({
            assetId: assetId.toUpperCase(),
            itemName,
            category: category || 'Laptop',
            serialNumber: serialNumber || '',
            purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
            vendor: vendor || 'Direct Procurement',
            cost: Number(cost) || 0,
            warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
            amcExpiry: amcExpiry ? new Date(amcExpiry) : null,
            licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
            condition: condition || 'New',
            status: status || (assignedTo ? 'In Use' : 'Available'),
            location: location || 'Chandigarh Office',
            department: department || '',
            assignedTo: assignedTo || null,
            assignDate: assignedTo ? new Date() : null
        });

        if (assignedTo) {
            await AssetHistory.create({
                asset: asset._id,
                employee: assignedTo,
                type: 'Assignment',
                status: 'In Use',
                remarks: `Initial assignment at location ${asset.location}`
            });
        }

        res.status(201).json(asset);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update Fixed Asset (with Product fallback)
// @route   PUT /api/assets/items/:id
// @access  Private/AssetsManager
const updateAsset = async (req, res) => {
    try {
        let asset = await Asset.findById(req.params.id);
        if (!asset) {
            // Fallback: Check if it exists in Product collection
            const product = await Product.findById(req.params.id);
            if (product) {
                return updateProduct(req, res);
            }
            return res.status(404).json({ message: 'Asset or stock record not found' });
        }

        const oldAssignedTo = asset.assignedTo ? asset.assignedTo.toString() : null;
        let newAssignedTo = req.body.assignedTo || null;
        if (newAssignedTo === '') newAssignedTo = null;

        Object.assign(asset, req.body);
        asset.assignedTo = newAssignedTo;

        if (req.body.purchaseDate) asset.purchaseDate = new Date(req.body.purchaseDate);
        if (req.body.warrantyExpiry) asset.warrantyExpiry = new Date(req.body.warrantyExpiry);
        if (req.body.amcExpiry) asset.amcExpiry = new Date(req.body.amcExpiry);
        if (req.body.licenseExpiry) asset.licenseExpiry = new Date(req.body.licenseExpiry);

        if (oldAssignedTo !== newAssignedTo) {
            if (oldAssignedTo) {
                await AssetHistory.create({
                    asset: asset._id,
                    employee: oldAssignedTo,
                    type: 'Return',
                    status: 'Available',
                    remarks: 'Returned / Unassigned'
                });
            }
            if (newAssignedTo) {
                await AssetHistory.create({
                    asset: asset._id,
                    employee: newAssignedTo,
                    type: 'Assignment',
                    status: 'In Use',
                    remarks: `Assigned to employee`
                });
            }
        }

        await asset.save();
        res.json(asset);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete Fixed Asset
// @route   DELETE /api/assets/items/:id
// @access  Private/AssetsManager
const deleteAsset = async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id);
        if (!asset) {
            const product = await Product.findById(req.params.id);
            if (product) return deleteProduct(req, res);
            return res.status(404).json({ message: 'Asset not found' });
        }

        if (asset.assignedTo) {
            return res.status(400).json({ message: 'Cannot delete an asset currently assigned to an employee. Return it first.' });
        }

        await AssetHistory.deleteMany({ asset: asset._id });
        await Asset.findByIdAndDelete(req.params.id);
        res.json({ message: 'Asset deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==================== CONSUMABLE INVENTORY / ACCESSORIES ====================

// @desc    Add new product / accessory stock entry
// @route   POST /api/assets/products
// @access  Private/Admin
const addProduct = async (req, res) => {
    try {
        const { modelName, category, totalQuantity, lowStockThreshold, price, condition, location, pendingPurchase, purchaseDate } = req.body;

        const product = await Product.create({
            modelName: modelName || req.body.itemName || 'Stock Item',
            category: category || 'General Hardware',
            totalQuantity: Number(totalQuantity || req.body.quantity || 1),
            availableQuantity: Number(totalQuantity || req.body.quantity || 1),
            lowStockThreshold: lowStockThreshold !== undefined ? Number(lowStockThreshold) : 5,
            price: Number(price || req.body.cost || 0),
            condition: condition || 'New',
            location: location || 'Store Room',
            pendingPurchase: Boolean(pendingPurchase),
            purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date()
        });

        res.status(201).json(product);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all products / stock items
// @route   GET /api/assets/products
// @access  Private/Admin
const getProducts = async (req, res) => {
    try {
        const { extraStock, category } = req.query;
        let query = {};
        if (extraStock === 'true') {
            query.availableQuantity = { $gt: 0 };
        }
        if (category && category !== 'All') {
            query.category = category;
        }
        const products = await Product.find(query).sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update product details (with Asset fallback)
// @route   PUT /api/assets/products/:id
// @access  Private/AssetsManager
const updateProduct = async (req, res) => {
    try {
        const { modelName, itemName, category, totalQuantity, lowStockThreshold, price, condition, location, pendingPurchase, purchaseDate } = req.body;
        let product = await Product.findById(req.params.id);
        
        if (!product) {
            // Fallback: Check if it's in Asset collection
            const asset = await Asset.findById(req.params.id);
            if (asset) {
                if (modelName || itemName) asset.itemName = modelName || itemName;
                if (category) asset.category = category;
                if (price !== undefined) asset.cost = Number(price);
                if (condition) asset.condition = condition;
                if (location) asset.location = location;
                if (purchaseDate) asset.purchaseDate = new Date(purchaseDate);
                await asset.save();
                return res.json(asset);
            }
            return res.status(404).json({ message: 'Stock item or asset record not found' });
        }

        const nameToUse = modelName || itemName;
        if (nameToUse !== undefined && String(nameToUse).trim() !== '') {
            product.modelName = String(nameToUse).trim();
        }

        if (category) product.category = category;
        if (location) product.location = location;
        if (pendingPurchase !== undefined) product.pendingPurchase = Boolean(pendingPurchase);
        if (lowStockThreshold !== undefined) product.lowStockThreshold = Number(lowStockThreshold);

        if (totalQuantity !== undefined && totalQuantity !== null && totalQuantity !== '') {
            const newTotal = Number(totalQuantity);
            if (!isNaN(newTotal) && newTotal >= 0) {
                const assignedCount = Math.max(0, (product.totalQuantity || 0) - (product.availableQuantity || 0));
                product.totalQuantity = newTotal;
                product.availableQuantity = Math.max(0, newTotal - assignedCount);
            }
        }

        if (price !== undefined && price !== null && price !== '') {
            const newPrice = Number(price);
            if (!isNaN(newPrice) && newPrice >= 0) {
                product.price = newPrice;
            }
        }

        if (condition) product.condition = condition;

        if (purchaseDate) {
            const parsedDate = new Date(purchaseDate);
            if (!isNaN(parsedDate.getTime())) {
                product.purchaseDate = parsedDate;
            }
        }

        await product.save();
        res.json(product);
    } catch (error) {
        console.error('[UPDATE-PRODUCT-ERROR]', error);
        res.status(400).json({ message: error.message || 'Failed to update product' });
    }
};

// @desc    Delete product record
// @route   DELETE /api/assets/products/:id
// @access  Private/AssetsManager
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            const asset = await Asset.findById(req.params.id);
            if (asset) return deleteAsset(req, res);
            return res.status(404).json({ message: 'Product not found' });
        }

        const activeDist = await ProductDistribution.findOne({ product: req.params.id, status: 'Assigned' });
        if (activeDist) {
            return res.status(400).json({ message: 'Cannot delete product with active assigned distributions. Return items first.' });
        }

        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==================== SERVICE & REPAIR MANAGEMENT ====================

// @desc    Get all Repair Logs
// @route   GET /api/assets/repairs
// @access  Private/AssetsManager
const getRepairs = async (req, res) => {
    try {
        const repairs = await RepairLog.find()
            .populate('asset')
            .sort({ createdAt: -1 });
        res.json(repairs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create Repair Log
// @route   POST /api/assets/repairs
// @access  Private/AssetsManager
const createRepair = async (req, res) => {
    try {
        const { assetId, problemDescription, vendor, estimatedCost, startDate } = req.body;

        const asset = await Asset.findById(assetId);
        if (!asset) return res.status(404).json({ message: 'Asset not found' });

        const repair = await RepairLog.create({
            asset: asset._id,
            assetIdTag: asset.assetId || asset.serialNumber || 'IT-AST-REF',
            itemName: asset.itemName,
            problemDescription,
            vendor: vendor || 'IT Repair Center',
            estimatedCost: Number(estimatedCost) || 0,
            startDate: startDate ? new Date(startDate) : new Date(),
            status: 'In Repair'
        });

        asset.status = 'Under Repair';
        await asset.save();

        res.status(201).json(repair);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update Repair Status
// @route   PUT /api/assets/repairs/:id
// @access  Private/AssetsManager
const updateRepair = async (req, res) => {
    try {
        const { status, actualCost, completionDate, remarks } = req.body;
        const repair = await RepairLog.findById(req.params.id);
        if (!repair) return res.status(404).json({ message: 'Repair record not found' });

        if (status) repair.status = status;
        if (actualCost !== undefined) repair.actualCost = Number(actualCost);
        if (completionDate) repair.completionDate = new Date(completionDate);
        if (remarks) repair.remarks = remarks;

        await repair.save();

        // Sync with linked Fixed Asset
        const asset = await Asset.findById(repair.asset);
        if (asset) {
            if (status === 'Repaired') {
                repair.completionDate = new Date();
                await repair.save();
                asset.status = asset.assignedTo ? 'In Use' : 'Available';
                await asset.save();
            } else if (status === 'Scrap') {
                asset.status = 'Scrap';
                await asset.save();
            }
        }

        res.json(repair);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// ==================== DISTRIBUTIONS & ASSIGNMENTS ====================

// @desc    Distribute product to employee
// @route   POST /api/assets/distribute
// @access  Private/Admin
const distributeProduct = async (req, res) => {
    try {
        const { productId, employeeId, quantityAssigned, distributionDate, distributedBy, remarks } = req.body;

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        if (product.availableQuantity < quantityAssigned) {
            return res.status(400).json({ message: `Insufficient stock. Only ${product.availableQuantity} available.` });
        }

        const distribution = await ProductDistribution.create({
            product: productId,
            employee: employeeId,
            quantityAssigned,
            distributionDate,
            distributedBy,
            remarks
        });

        product.availableQuantity -= quantityAssigned;
        await product.save();

        res.status(201).json(distribution);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Return product from employee
// @route   POST /api/assets/return/:id
// @access  Private/Admin
const returnProduct = async (req, res) => {
    try {
        const distribution = await ProductDistribution.findById(req.params.id);
        if (!distribution) return res.status(404).json({ message: 'Distribution record not found' });
        if (distribution.status === 'Returned') return res.status(400).json({ message: 'Product already marked as returned' });

        const product = await Product.findById(distribution.product);
        if (!product) return res.status(404).json({ message: 'Linked product not found' });

        distribution.status = 'Returned';
        distribution.returnDate = new Date();
        await distribution.save();

        product.availableQuantity += distribution.quantityAssigned;
        await product.save();

        res.json({ message: 'Product returned and stock updated', distribution });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all distribution records
// @route   GET /api/assets/distributions
// @access  Private/Admin
const getDistributions = async (req, res) => {
    try {
        const distributions = await ProductDistribution.find()
            .populate('product')
            .populate('employee', 'name email department')
            .sort({ distributionDate: -1 });
        res.json(distributions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get assets assigned to a specific employee
// @route   GET /api/assets/employee/:id
// @access  Private
const getEmployeeAssets = async (req, res) => {
    try {
        const distributions = await ProductDistribution.find({
            employee: req.params.id,
            status: 'Assigned'
        }).populate('product');

        const fixedAssets = await Asset.find({
            assignedTo: req.params.id
        });

        res.json({ distributions, fixedAssets });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
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
};
