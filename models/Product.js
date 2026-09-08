const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    modelName: {
        type: String,
        required: [true, 'Model name is required'],
        trim: true
    },
    category: {
        type: String,
        enum: ['Mouse', 'Keyboard', 'Headset', 'Charger', 'Cable', 'Adapter', 'RAM', 'SSD', 'General Hardware', 'Other'],
        default: 'General Hardware'
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
    lowStockThreshold: {
        type: Number,
        default: 5,
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
    location: {
        type: String,
        trim: true,
        default: 'Store Room'
    },
    pendingPurchase: {
        type: Boolean,
        default: false
    },
    purchaseDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
