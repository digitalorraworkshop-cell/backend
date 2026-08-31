const Product = require('../models/Product');
const ProductDistribution = require('../models/ProductDistribution');
const User = require('../models/User');

// @desc    Add new product entry
// @route   POST /api/assets/products
// @access  Private/Admin
const addProduct = async (req, res) => {
    try {
        const { modelName, totalQuantity, price, condition, purchaseDate } = req.body;

        const product = await Product.create({
            modelName,
            totalQuantity,
            availableQuantity: totalQuantity,
            price,
            condition,
            purchaseDate
        });

        res.status(201).json(product);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

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

        // Update available quantity
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

        // Increment available quantity
        product.availableQuantity += distribution.quantityAssigned;
        await product.save();

        res.json({ message: 'Product returned and stock updated', distribution });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all products (Extra Stock if filtered)
// @route   GET /api/assets/products
// @access  Private/Admin
const getProducts = async (req, res) => {
    try {
        const { extraStock } = req.query;
        let query = {};
        if (extraStock === 'true') {
            query.availableQuantity = { $gt: 0 };
        }
        const products = await Product.find(query).sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
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
        res.json(distributions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update product details
// @route   PUT /api/assets/products/:id
// @access  Private/AssetsManager
const updateProduct = async (req, res) => {
    try {
        const { modelName, totalQuantity, price, condition, purchaseDate } = req.body;
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        // Calculate difference in totalQuantity to adjust availableQuantity
        const diff = Number(totalQuantity) - Number(product.totalQuantity);
        product.modelName = modelName || product.modelName;
        product.totalQuantity = Number(totalQuantity);
        product.availableQuantity = Math.max(0, product.availableQuantity + diff);
        if (price !== undefined) product.price = Number(price);
        if (condition) product.condition = condition;
        if (purchaseDate) product.purchaseDate = purchaseDate;

        await product.save();
        res.json(product);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete product record
// @route   DELETE /api/assets/products/:id
// @access  Private/AssetsManager
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        // Check if product has active distributions
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

// @desc    Get Asset statistics for Asset Manager Dashboard
// @route   GET /api/assets/stats
// @access  Private/AssetsManager
const getAssetStats = async (req, res) => {
    try {
        const products = await Product.find();
        const distributions = await ProductDistribution.find()
            .populate('product')
            .populate('employee', 'name email department')
            .sort({ distributionDate: -1, createdAt: -1 });

        const totalProducts = products.length;
        let totalQuantity = 0;
        let availableQuantity = 0;
        let totalValuation = 0;

        products.forEach(p => {
            totalQuantity += (p.totalQuantity || 0);
            availableQuantity += (p.availableQuantity || 0);
            totalValuation += ((p.totalQuantity || 0) * (p.price || 0));
        });

        const distributedQuantity = totalQuantity - availableQuantity;

        const conditionBreakdown = {
            New: products.filter(p => p.condition === 'New').length,
            Good: products.filter(p => p.condition === 'Good').length,
            Used: products.filter(p => p.condition === 'Used').length,
            Damaged: products.filter(p => p.condition === 'Damaged').length
        };

        const activeAssignmentsCount = distributions.filter(d => d.status === 'Assigned').length;

        res.json({
            totalProducts,
            totalQuantity,
            availableQuantity,
            distributedQuantity,
            totalValuation,
            activeAssignmentsCount,
            conditionBreakdown,
            recentDistributions: distributions.slice(0, 6)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    addProduct,
    updateProduct,
    deleteProduct,
    distributeProduct,
    returnProduct,
    getProducts,
    getDistributions,
    getEmployeeAssets,
    getAssetStats
};

