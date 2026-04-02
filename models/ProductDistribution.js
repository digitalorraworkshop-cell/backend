const mongoose = require('mongoose');

const productDistributionSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    quantityAssigned: {
        type: Number,
        required: true,
        min: 1
    },
    distributedBy: {
        type: String,
        required: true
    },
    distributionDate: {
        type: Date,
        default: Date.now
    },
    remarks: {
        type: String,
        trim: true
    },
    returnDate: {
        type: Date
    },
    status: {
        type: String,
        enum: ['Assigned', 'Returned'],
        default: 'Assigned'
    }
}, {
    timestamps: true
});

const ProductDistribution = mongoose.model('ProductDistribution', productDistributionSchema);
module.exports = ProductDistribution;
