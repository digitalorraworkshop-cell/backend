const express = require('express');
const router = express.Router();
const { assignTask, getTasks, updateTask, deleteTask, reorderTasks } = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');

// @desc    Get all tasks for user or all tasks for admin
// @route   GET /api/tasks
router.get('/', protect, getTasks);

// @desc    Create/Self-assign a task
// @route   POST /api/tasks
router.post('/', protect, assignTask);

// @desc    Reorder tasks
// @route   PUT /api/tasks/reorder
router.put('/reorder', protect, reorderTasks);

// @desc    Update task status or details
// @route   PUT /api/tasks/:id
router.put('/:id', protect, updateTask);

// @desc    Delete task
// @route   DELETE /api/tasks/:id
router.delete('/:id', protect, deleteTask);

module.exports = router;
