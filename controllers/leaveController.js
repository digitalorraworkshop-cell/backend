const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// Helper: Calculate total days excluding weekends if NOT sandwich? 
// No, prompt says: "If Holiday OR Weekly Off falls between leave days... Then Saturday must also count as leave."
// This means we calculate total calendar days if there's a leave before and after? 
// Actually, standard sandwich rule: if you take leave on Friday and Monday, the Sat/Sun in between are also leave.
const calculateLeaveDetails = (fromDate, toDate) => {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // For simplicity, let's assume Sat/Sun are always weekly offs.
    // The "Sandwich Rule" applies if a holiday/weekend is BETWEEN from and to.
    return { totalDays: diffDays };
};

// @desc    Apply for leave
// @route   POST /api/leaves
// @access  Private (Employee)
const applyLeave = async (req, res) => {
    try {
        const { leaveType, fromDate, toDate, reason, isEmergency, isSickness } = req.body;
        const user = await User.findById(req.user._id);
        let balance = await LeaveBalance.findOne({ user: user._id });

        if (!balance) {
            balance = await LeaveBalance.create({ user: user._id });
        }

        const today = new Date();
        const start = new Date(fromDate);
        const end = new Date(toDate);
        const daysInAdvance = Math.ceil((start - today) / (1000 * 60 * 60 * 24));

        const { totalDays } = calculateLeaveDetails(fromDate, toDate);

        // Prevent Overlap Check
        const overlappingLeave = await Leave.findOne({
            user: req.user._id,
            status: { $in: ['Pending', 'Approved'] },
            $or: [
                { fromDate: { $lte: end }, toDate: { $gte: start } }
            ]
        });

        if (overlappingLeave) {
            return res.status(400).json({ message: 'You already have a pending or approved leave request for these dates' });
        }

        let deductionAmount = 0;

        // 1. Validation Logic
        if (leaveType === 'Paid Leave') {
            // Must apply at least 2 days in advance
            if (daysInAdvance < 2) {
                return res.status(400).json({ message: 'Paid leave must be applied at least 2 days in advance' });
            }
            if (balance.monthlyPaidLeaveBalance + balance.carryForwardLeave < totalDays) {
                return res.status(400).json({ message: 'Insufficient paid leave balance' });
            }
        }

        else if (leaveType === 'Instant Leave') {
            // Same day OR 1 day prior
            if (daysInAdvance > 1) {
                return res.status(400).json({ message: 'Instant leave must be applied on the same day or 1 day prior' });
            }
            // Limit 6 per year
            if (balance.instantLeaveUsedThisYear >= 6) {
                return res.status(400).json({ message: 'Yearly limit for Instant Leave (6) exceeded' });
            }
            // 1 allowed every 2 months
            if (balance.lastInstantLeaveDate) {
                const monthsDiff = (today.getFullYear() - balance.lastInstantLeaveDate.getFullYear()) * 12 + (today.getMonth() - balance.lastInstantLeaveDate.getMonth());
                if (monthsDiff < 2) {
                    return res.status(400).json({ message: 'Instant leave can only be taken once every 2 months' });
                }
            }
            // Sickness > 1 day proof check (handled at frontend level for upload, but we can check if file exists)
            if (isSickness && totalDays > 1 && !req.file && !req.body.proofDocument) {
                return res.status(400).json({ message: 'Sickness proof required for more than 1 day sick leave' });
            }

            // Deduction Logic: 2x salary deduction unless emergency
            if (!isEmergency) {
                deductionAmount = totalDays * 2 * (user.perDaySalary || 0);
            }
        }

        else if (leaveType === 'Short Leave') {
            // 2 hours once per month
            if (balance.shortLeaveUsedThisMonth >= 1) {
                return res.status(400).json({ message: 'Only one Short Leave allowed per month' });
            }
            // 1 day in advance
            if (daysInAdvance < 1) {
                return res.status(400).json({ message: 'Short leave must be applied at least 1 day in advance' });
            }
            // Deduction: (perDaySalary / workingHoursPerDay) * 2
            deductionAmount = ((user.perDaySalary || 0) / (user.workingHoursPerDay || 8)) * 2;
        }

        let proofDocument = req.body.proofDocument || null;

        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'leave_proofs',
                public_id: `leave-proof-${req.user._id}-${Date.now()}`
            });
            proofDocument = result.secure_url;
            fs.unlinkSync(req.file.path);
        }

        const leave = await Leave.create({
            user: req.user._id,
            leaveType,
            fromDate,
            toDate,
            reason,
            totalDays,
            deductionAmount,
            proofDocument,
            isEmergency,
            isSickness
        });

        res.status(201).json(leave);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get leaves (Admin sees all, Employee sees own)
const getLeaves = async (req, res) => {
    try {
        let leaves;
        if (req.user.role === 'admin') {
            const { userId } = req.query;
            const query = userId ? { user: userId } : {};
            leaves = await Leave.find(query).populate('user', 'name email position').sort({ createdAt: -1 });
        } else {
            leaves = await Leave.find({ user: req.user._id }).sort({ createdAt: -1 });
        }
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Leave Statistics
const getLeaveStats = async (req, res) => {
    try {
        const balance = await LeaveBalance.findOne({ user: req.user._id });
        res.json(balance || {
            monthlyPaidLeaveBalance: 0,
            carryForwardLeave: 0,
            instantLeaveUsedThisYear: 0,
            shortLeaveUsedThisMonth: 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Approve/Reject Leave (Admin only)
const updateLeaveStatus = async (req, res) => {
    try {
        const { status, adminRemark } = req.body;
        const leave = await Leave.findById(req.params.id).populate('user');

        if (!leave) return res.status(404).json({ message: 'Leave request not found' });

        if (status === 'Approved') {
            const balance = await LeaveBalance.findOne({ user: leave.user._id });

            // Deduct balance for Paid Leave
            if (leave.leaveType === 'Paid Leave') {
                let remaining = leave.totalDays;
                if (balance.carryForwardLeave >= remaining) {
                    balance.carryForwardLeave -= remaining;
                } else {
                    remaining -= balance.carryForwardLeave;
                    balance.carryForwardLeave = 0;
                    balance.monthlyPaidLeaveBalance -= remaining;
                }
            }

            // Update usage counters for Instant/Short
            if (leave.leaveType === 'Instant Leave') {
                balance.instantLeaveUsedThisYear += 1;
                balance.lastInstantLeaveDate = new Date();
            }
            if (leave.leaveType === 'Short Leave') {
                balance.shortLeaveUsedThisMonth += 1;
            }

            await balance.save();
        }

        leave.status = status;
        leave.adminRemark = adminRemark;
        await leave.save();

        res.json(leave);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { applyLeave, getLeaves, updateLeaveStatus, getLeaveStats };
