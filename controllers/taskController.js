const Task = require('../models/Task');
const { getIo } = require('../socket');

// @desc    Assign/Create a task
// @route   POST /api/tasks
// @access  Private
const assignTask = async (req, res) => {
    try {
        const { assignedTo, title, description, dueDate, dueTime, priority } = req.body;
        const isManagerRole = ['admin', 'seo-manager', 'manager'].includes(req.user.role);
        const assignType = req.user.role === 'admin' ? 'ADMIN' : (isManagerRole ? 'MANAGER' : 'SELF');
        const finalAssignedTo = isManagerRole ? assignedTo : req.user._id;

        if (!finalAssignedTo) {
            return res.status(400).json({ message: 'Assignee is required' });
        }

        // Get max order for reordering
        const lastTask = await Task.findOne({ assignedTo: finalAssignedTo }).sort('-order');
        const nextOrder = lastTask ? (lastTask.order || 0) + 1 : 0;

        const task = await Task.create({
            title,
            description,
            assignedTo: finalAssignedTo,
            assignedBy: req.user._id,
            assignType,
            dueDate,
            dueTime,
            priority: priority || 'Medium',
            status: 'Pending',
            order: nextOrder
        });

        const io = getIo();
        io.to(finalAssignedTo.toString()).emit('taskUpdate', { type: 'CREATED', task });
        io.to('admins').emit('taskUpdate', { type: 'CREATED', task });

        res.status(201).json(task);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get tasks (Supports date filtering)
// @route   GET /api/tasks
// @access  Private
const getTasks = async (req, res) => {
    try {
        const { employeeId, status, assignType, date } = req.query;
        let query = {};

        const isManagerRole = ['admin', 'seo-manager', 'manager'].includes(req.user.role);

        if (isManagerRole) {
            if (employeeId) query.assignedTo = employeeId;
            if (status) query.status = status;
            if (assignType) query.assignType = assignType;
            if (req.user.role !== 'admin' && !employeeId) {
                // If a manager doesn't specify an employee, they might see tasks they assigned
                query.assignedBy = req.user._id;
            }
        } else {
            query.assignedTo = req.user._id;
        }

        // Date-wise filtering
        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            query.dueDate = { $gte: start, $lte: end };
        }

        const tasks = await Task.find(query)
            .populate('assignedTo', 'name email profilePicture')
            .populate('assignedBy', 'name email role')
            .sort({ order: 1, createdAt: -1 });

        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update task (Expanded permissions for SELF tasks)
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = async (req, res) => {
    try {
        const { status, title, description, dueDate, dueTime, priority, assignedTo, comment } = req.body;
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const isManagerRole = ['admin', 'seo-manager', 'manager'].includes(req.user.role);
        const isAssignedUser = task.assignedTo && req.user._id &&
            task.assignedTo.toString() === req.user._id.toString();
        const isAssigner = task.assignedBy && req.user._id &&
            task.assignedBy.toString() === req.user._id.toString();

        // Optional: If we wanted to restrict seo-manager to only certain roles, we could do it here.
        // For now, as per user request, they should see and manage everyone in the list.

        if (!isManagerRole && !isAssignedUser && !isAssigner) {
            return res.status(403).json({ message: 'Not authorized to update this task' });
        }

        // Add comment if provided
        if (comment) {
            task.comments.push({ text: comment });
        }

        // Permission Rules:
        if (!isManagerRole && !isAssigner) {
            // Employees can update status, dueDate, dueTime, and carriedOver on any task assigned to them
            if (status) task.status = status;
            if (dueDate) task.dueDate = dueDate;
            if (dueTime !== undefined) task.dueTime = dueTime;
            if (req.body.carriedOver !== undefined) task.carriedOver = req.body.carriedOver;

            // For SELF tasks, allow title and description editing too
            if (task.assignType === 'SELF') {
                if (title) task.title = title;
                if (description !== undefined) task.description = description;
                if (priority) task.priority = priority;
            }
        } else {
            // Manager/Admin can edit everything
            if (title) task.title = title;
            if (description !== undefined) task.description = description;
            if (dueDate) task.dueDate = dueDate;
            if (dueTime !== undefined) task.dueTime = dueTime;
            if (priority) task.priority = priority;
            if (status) task.status = status;
            if (assignedTo) task.assignedTo = assignedTo;
        }

        const updatedTask = await task.save();
        await updatedTask.populate([
            { path: 'assignedTo', select: 'name email profilePicture' },
            { path: 'assignedBy', select: 'name email role' }
        ]);

        const io = getIo();
        io.to(updatedTask.assignedTo.toString()).emit('taskUpdate', { type: 'UPDATED', task: updatedTask });
        io.to('admins').emit('taskUpdate', { type: 'UPDATED', task: updatedTask });

        res.json(updatedTask);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reorder tasks
// @route   PUT /api/tasks/reorder
// @access  Private
const reorderTasks = async (req, res) => {
    try {
        const { taskOrders } = req.body; // Expects array of { id, order }

        for (const item of taskOrders) {
            await Task.findByIdAndUpdate(item.id, { order: item.order });
        }

        const io = getIo();
        io.to(req.user._id.toString()).emit('taskUpdate', { type: 'REORDERED' });
        if (req.user.role === 'admin') io.to('admins').emit('taskUpdate', { type: 'REORDERED' });

        res.json({ message: 'Order updated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a task (Owner can delete SELF tasks)
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = async (req, res) => {
    console.log(`[TASK-TRACE] Attempting delete. TaskID: ${req.params.id}, User: ${req.user._id} (${req.user.role})`);
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        const isManagerRole = ['admin', 'seo-manager', 'manager'].includes(req.user.role);
        const isAssigned = task.assignedTo && req.user._id &&
            task.assignedTo.toString() === req.user._id.toString();
        const isAssigner = task.assignedBy && req.user._id &&
            task.assignedBy.toString() === req.user._id.toString();

        if (!isManagerRole && !isAssigned && !isAssigner) {
            return res.status(403).json({ message: 'Not authorized to delete this task' });
        }

        const assignedUser = task.assignedTo.toString();
        await task.deleteOne();

        const io = getIo();
        io.to(assignedUser).emit('taskUpdate', { type: 'DELETED', taskId: req.params.id });
        io.to('admins').emit('taskUpdate', { type: 'DELETED', taskId: req.params.id });

        res.json({ message: 'Task removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { assignTask, getTasks, updateTask, deleteTask, reorderTasks };
