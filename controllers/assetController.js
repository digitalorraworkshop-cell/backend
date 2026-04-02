const Asset = require('../models/Asset');
const AssetHistory = require('../models/AssetHistory');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// @desc    Get all assets with filtering
// @route   GET /api/assets
// @access  Private/Admin
const getAssets = async (req, res) => {
    try {
        const { category, status, assignedTo, search } = req.query;
        let query = {};

        if (category && category !== 'All') query.category = category;
        if (status && status !== 'All') query.status = status;
        if (assignedTo && assignedTo !== 'All') query.assignedTo = assignedTo;

        if (search) {
            query.$or = [
                { itemName: { $regex: search, $options: 'i' } },
                { serialNumber: { $regex: search, $options: 'i' } },
                { vendor: { $regex: search, $options: 'i' } }
            ];
        }

        const assets = await Asset.find(query)
            .populate('assignedTo', 'name email')
            .sort({ createdAt: -1 });

        res.json(assets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get asset by ID with history
// @route   GET /api/assets/:id
// @access  Private/Admin
const getAssetById = async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id).populate('assignedTo', 'name email');
        if (!asset) return res.status(404).json({ message: 'Asset not found' });

        const history = await AssetHistory.find({ asset: asset._id })
            .populate('employee', 'name email')
            .sort({ date: -1 });

        res.json({ asset, history });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new asset
// @route   POST /api/assets
// @access  Private/Admin
const createAsset = async (req, res) => {
    try {
        const assetData = { ...req.body };

        // Handle empty strings for optional ObjectId fields
        if (assetData.assignedTo === '') assetData.assignedTo = null;

        // Handle File Uploads (Images/Invoices)
        if (req.files) {
            if (req.files.image) {
                const imgResult = await cloudinary.uploader.upload(req.files.image[0].path, {
                    folder: 'assets/images'
                });
                assetData.imageUrl = imgResult.secure_url;
                fs.unlinkSync(req.files.image[0].path);
            }
            if (req.files.invoice) {
                const invResult = await cloudinary.uploader.upload(req.files.invoice[0].path, {
                    folder: 'assets/invoices'
                });
                assetData.invoiceUrl = invResult.secure_url;
                fs.unlinkSync(req.files.invoice[0].path);
            }
        }

        console.log('[ASSET-DEBUG] Creating Asset with data:', assetData);
        const asset = await Asset.create(assetData);
        console.log('[ASSET-DEBUG] Asset created successfully:', asset._id);

        // If initially assigned, create history
        if (asset.assignedTo) {
            console.log('[ASSET-DEBUG] Creating initial assignment history for:', asset.assignedTo);
            await AssetHistory.create({
                asset: asset._id,
                employee: asset.assignedTo,
                type: 'Assignment',
                status: 'Assigned',
                remarks: 'Initial assignment upon creation'
            });
        }

        res.status(201).json(asset);
    } catch (error) {
        console.error('[ASSET-ERROR] Failed to create asset:', error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update asset
// @route   PUT /api/assets/:id
// @access  Private/Admin
const updateAsset = async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id);
        if (!asset) return res.status(404).json({ message: 'Asset not found' });

        const oldAssignedTo = asset.assignedTo ? asset.assignedTo.toString() : null;
        let newAssignedTo = req.body.assignedTo || null;
        if (newAssignedTo === '') newAssignedTo = null;

        if (req.body.assignedTo === '') req.body.assignedTo = null;

        // Handle File Uploads
        if (req.files) {
            if (req.files.image) {
                const imgResult = await cloudinary.uploader.upload(req.files.image[0].path, {
                    folder: 'assets/images'
                });
                req.body.imageUrl = imgResult.secure_url;
                fs.unlinkSync(req.files.image[0].path);
            }
            if (req.files.invoice) {
                const invResult = await cloudinary.uploader.upload(req.files.invoice[0].path, {
                    folder: 'assets/invoices'
                });
                req.body.invoiceUrl = invResult.secure_url;
                fs.unlinkSync(req.files.invoice[0].path);
            }
        }

        // Check if assignment changed
        if (oldAssignedTo !== newAssignedTo) {
            if (oldAssignedTo) {
                // Return record
                await AssetHistory.create({
                    asset: asset._id,
                    employee: oldAssignedTo,
                    type: 'Return',
                    status: 'Available',
                    remarks: 'Returned/Unassigned'
                });
            }
            if (newAssignedTo) {
                // Assignment record
                await AssetHistory.create({
                    asset: asset._id,
                    employee: newAssignedTo,
                    type: 'Assignment',
                    status: 'Assigned',
                    remarks: req.body.assignmentRemarks || 'Assigned to employee'
                });
            }
        }

        console.log('[ASSET-DEBUG] Updating Asset ID:', req.params.id, 'Data:', req.body);
        const updatedAsset = await Asset.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedAsset);
    } catch (error) {
        console.error('[ASSET-ERROR] Failed to update asset:', error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete asset
// @route   DELETE /api/assets/:id
// @access  Private/Admin
const deleteAsset = async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id);
        if (!asset) return res.status(404).json({ message: 'Asset not found' });

        await AssetHistory.deleteMany({ asset: asset._id });
        await asset.deleteOne();

        res.json({ message: 'Asset and history removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAssets,
    getAssetById,
    createAsset,
    updateAsset,
    deleteAsset
};
