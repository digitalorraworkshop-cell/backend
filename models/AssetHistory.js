const mongoose = require('mongoose');

const assetHistorySchema = new mongoose.Schema({
    asset: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Asset',
        required: true
    },
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['Assignment', 'Return'],
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        required: true
    },
    remarks: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

const AssetHistory = mongoose.model('AssetHistory', assetHistorySchema);
module.exports = AssetHistory;
