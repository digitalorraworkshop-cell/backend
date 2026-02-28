const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../config/cloudinary');
const Screenshot = require('../models/Screenshot');
const { getIo } = require('../socket');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${req.user._id}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5000000 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpg|jpeg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb('Images only!');
        }
    }
}).single('screenshot');

// @desc    Upload Screenshot
// @route   POST /api/screenshots
// @access  Private (Employee)
const uploadScreenshot = (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            res.status(400).json({ message: err });
            return;
        }
        res.status(201).json({
            message: 'Screenshot uploaded',
            filePath: `/${req.file.path.replace(/\\/g, '/')}`
        });
    });
};

// @desc    List screenshots would usually just look at the file system or a DB model if we track metadata
// Ideally we should create a Screenshot model to track which user and when.
// For now, let's assume valid implementation returns list from file system or we add a Model.
// I will create a simple Screenshot model in a separate file if needed, but for simplicity of this artifact I'll stick to basic upload.
// Wait, the "Admin can filter screenshots by date & employee" requirement implies a DB model.

// Using previously declared Screenshot model

const saveScreenshotMeta = async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err });
        }

        try {
            // Upload to Cloudinary
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'employee_screenshots',
                public_id: `${req.user._id}-${Date.now()}`
            });

            // Clean up local file
            fs.unlinkSync(req.file.path);

            const screenshot = await Screenshot.create({
                user: req.user._id,
                imageUrl: result.secure_url,
                sessionId: req.user.currentSessionId || req.body.sessionId,
                date: new Date().toLocaleDateString('en-CA'),
                status: req.body.status || 'Active',
                activityPercentage: req.body.activityPercentage || 0,
                activeApp: req.body.activeApp || 'Unknown Application'
            });

            // Emit to socket
            try {
                const io = getIo();
                const populated = await Screenshot.findById(screenshot._id).populate('user', 'name email profilePicture');
                io.to('admins').emit('new-screenshot', populated);
            } catch (socketErr) {
                console.error('[SCREENSHOT-SOCKET-ERROR]', socketErr.message);
            }

            res.status(201).json(screenshot);
        } catch (error) {
            console.error('[SCREENSHOT-ERROR] Cloudinary Upload failed:', error);
            res.status(500).json({ message: 'Error uploading screenshot' });
        }
    });
}

const getScreenshots = async (req, res) => {
    const { userId, date } = req.query;
    let query = {};
    if (req.user.role !== 'admin') {
        query.user = req.user._id;
    } else if (userId && userId !== '' && userId !== 'null') {
        query.user = userId;
    }

    if (date) {
        query.date = date;
    }

    const screenshots = await Screenshot.find(query)
        .populate('user', 'name email profilePicture')
        .sort({ createdAt: -1 });
    res.json(screenshots);
};

module.exports = { saveScreenshotMeta, getScreenshots };
