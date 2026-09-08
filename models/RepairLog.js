const mongoose = require('mongoose');

const repairLogSchema = new mongoose.Schema({
    asset: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Asset',
        required: true
    },
    assetIdTag: {
        type: String,
        trim: true
    },
    itemName: {
        type: String,
        required: true,
        trim: true
    },
    problemDescription: {
        type: String,
        required: [true, 'Problem description is required'],
        trim: true
    },
    vendor: {
        type: String,
        trim: true,
        default: 'In-House IT / Vendor'
    },
    estimatedCost: {
        type: Number,
        default: 0,
        min: 0
    },
    actualCost: {
        type: Number,
        default: 0,
        min: 0
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    completionDate: {
        type: Date
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'In Repair', 'Repaired', 'Scrap'],
        default: 'Pending'
    },
    remarks: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

const RepairLog = mongoose.model('RepairLog', repairLogSchema);
module.exports = RepairLog;
