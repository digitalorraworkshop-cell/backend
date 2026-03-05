const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
    itemName: {
        type: String,
        required: [true, 'Item name is required'],
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['Laptop', 'Desktop', 'Mobile', 'Software License', 'Office Equipment', 'ID Card', 'Other']
    },
    serialNumber: {
        type: String,
        required: [true, 'Serial number or unique ID is required'],
        unique: true,
        trim: true
    },
    purchaseDate: {
        type: Date,
        required: [true, 'Purchase date is required']
    },
    vendor: {
        type: String,
        required: [true, 'Vendor name is required']
    },
    cost: {
        type: Number,
        required: [true, 'Cost is required'],
        min: 0
    },
    warrantyExpiry: {
        type: Date
    },
    condition: {
        type: String,
        required: true,
        enum: ['New', 'Good', 'Repair Needed', 'Damaged'],
        default: 'New'
    },
    status: {
        type: String,
        required: true,
        enum: ['Available', 'Assigned', 'In Repair', 'Retired'],
        default: 'Available'
    },
    description: {
        type: String,
        trim: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    assignDate: {
        type: Date
    },
    returnDate: {
        type: Date
    },
    invoiceUrl: {
        type: String
    },
    imageUrl: {
        type: String
    }
}, {
    timestamps: true
});

// Middleware to auto-update status based on assignment
assetSchema.pre('save', async function () {
    if (this.assignedTo) {
        this.status = 'Assigned';
        if (!this.assignDate) this.assignDate = new Date();
    } else if (this.status === 'Assigned') {
        this.status = 'Available';
        this.assignDate = null;
    }
});

const Asset = mongoose.model('Asset', assetSchema);
module.exports = Asset;
