const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
    assetId: {
        type: String,
        trim: true,
        uppercase: true
    },
    itemName: {
        type: String,
        required: [true, 'Item name is required'],
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['Laptop', 'Computer', 'Desktop', 'Server', 'Monitor', 'Printer', 'Network Equipment', 'Software License', 'Mobile', 'Office Equipment', 'ID Card', 'Other'],
        default: 'Laptop'
    },
    serialNumber: {
        type: String,
        trim: true
    },
    purchaseDate: {
        type: Date,
        default: Date.now
    },
    vendor: {
        type: String,
        trim: true
    },
    cost: {
        type: Number,
        default: 0,
        min: 0
    },
    warrantyExpiry: {
        type: Date
    },
    amcExpiry: {
        type: Date
    },
    licenseExpiry: {
        type: Date
    },
    condition: {
        type: String,
        required: true,
        enum: ['New', 'Good', 'Used', 'Repair Needed', 'Damaged'],
        default: 'New'
    },
    status: {
        type: String,
        required: true,
        enum: ['In Use', 'Assigned', 'Available', 'Under Repair', 'Retired', 'Scrap', 'Lost/Damaged'],
        default: 'Available'
    },
    location: {
        type: String,
        trim: true,
        default: 'Main Office'
    },
    department: {
        type: String,
        trim: true
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

// Middleware to sync status with assignment
assetSchema.pre('save', async function () {
    if (this.assignedTo && this.status !== 'Under Repair' && this.status !== 'Retired' && this.status !== 'Scrap') {
        this.status = 'In Use';
        if (!this.assignDate) this.assignDate = new Date();
    } else if (!this.assignedTo && (this.status === 'In Use' || this.status === 'Assigned')) {
        this.status = 'Available';
        this.assignDate = null;
    }
});

const Asset = mongoose.model('Asset', assetSchema);
module.exports = Asset;
