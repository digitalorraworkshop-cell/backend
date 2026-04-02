const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    modelName: {
        type: String,
        required: [true, 'Model name is required'],
        trim: true
    },
    totalQuantity: {
        type: Number,
        required: [true, 'Total quantity is required'],
        min: 0
    },
    availableQuantity: {
        type: Number,
        required: [true, 'Available quantity is required'],
        min: 0
    },
    price: {
        type: Number,
        required: [true, 'Product price is required'],
        min: 0
    },
    condition: {
        type: String,
        required: true,
        enum: ['New', 'Good', 'Used', 'Damaged'],
        default: 'New'
    },
    purchaseDate: {
        type: Date,
        required: [true, 'Purchase date is required']
    }
}, {
    timestamps: true
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
