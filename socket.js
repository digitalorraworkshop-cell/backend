const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Message = require('./models/Message');
const ChatGroup = require('./models/ChatGroup');

let io;

const initSocket = (server) => {
    console.log('[SOCKET] Initializing Socket.io...');
    const allowedOrigins = process.env.NODE_ENV === 'production'
        ? ['https://frontend-gyz4.onrender.com', 'https://backend-upwl.onrender.com', 'https://therakeshbedi.com', 'https://www.therakeshbedi.com']
        : [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5174',
            'http://127.0.0.1:5174',
            'http://localhost:5175',
            'http://127.0.0.1:5175'
        ];

    io = new Server(server, {
        cors: {
            origin: function (origin, callback) {
                if (!origin || allowedOrigins.indexOf(origin) !== -1) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ["GET", "POST"],
            credentials: true
        }
    });
    console.log('[SOCKET] Socket.io attached to server.');

    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const lookupId = decoded.id || decoded._id;
            socket.user = await User.findById(lookupId).select('-password');
            if (!socket.user) {
                return next(new Error('User not found'));
            }
            next();
        } catch (err) {
            console.error('[SOCKET-ERROR] JWT verify failed:', err.message);
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', async (socket) => {
        const userId = socket.user._id;
        console.log(`[PRESENCE] User Connected: ${socket.user.name} (${socket.id})`);

        // Mark Online
        const user = await User.findById(userId);
        const currentStatus = (user && user.currentStatus === 'Working') ? 'Working' : 'Online';

        await User.findByIdAndUpdate(userId, {
            isOnline: true,
            currentStatus,
            lastActiveAt: new Date(),
            socketId: socket.id
        });

        // Join rooms
        socket.join(userId.toString());
        if (socket.user.role === 'admin') socket.join('admins');

        const groups = await ChatGroup.find({ members: userId });
        groups.forEach(group => socket.join(group._id.toString()));

        const companyGroup = await ChatGroup.findOne({ name: 'Company Team' });
        if (companyGroup && !companyGroup.members.includes(userId)) {
            companyGroup.members.push(userId);
            await companyGroup.save();
            socket.join(companyGroup._id.toString());
        }

        broadcastStatus(userId, currentStatus);

        socket.on('heartbeat', async () => {
            await User.findByIdAndUpdate(userId, { lastActiveAt: new Date() });
        });

        socket.on('sendMessage', async (data) => {
            const { recipientId, groupId, message, imageUrl, fileUrl, isGroup } = data;
            try {
                const newMessage = await Message.create({
                    sender: userId,
                    recipient: isGroup ? null : recipientId,
                    message,
                    imageUrl,
                    fileUrl,
                    isGroup,
                    groupId: isGroup ? groupId : null
                });

                const populatedMessage = await Message.findById(newMessage._id)
                    .populate('sender', 'name profilePicture')
                    .populate('recipient', 'name profilePicture');

                if (isGroup) {
                    io.to(groupId).emit('receiveMessage', populatedMessage);
                } else {
                    io.to(recipientId).emit('receiveMessage', populatedMessage);
                    io.to(userId.toString()).emit('receiveMessage', populatedMessage);
                    const recipientSockets = await io.in(recipientId.toString()).fetchSockets();
                    if (recipientSockets.length > 0) {
                        await Message.findByIdAndUpdate(newMessage._id, { deliveredStatus: true });
                        io.to(userId.toString()).emit('messageDeliveredUpdate', { messageId: newMessage._id });
                    }
                }
            } catch (err) {
                console.error('[CHAT-ERROR] sendMessage failed:', err);
            }
        });

        socket.on('typing', (data) => {
            const { recipientId, groupId, isGroup } = data;
            if (isGroup) socket.to(groupId).emit('typing', { userId, name: socket.user.name, isGroup: true, groupId });
            else io.to(recipientId).emit('typing', { userId, name: socket.user.name, isGroup: false });
        });

        socket.on('stopTyping', (data) => {
            const { recipientId, groupId, isGroup } = data;
            if (isGroup) socket.to(groupId).emit('stopTyping', { userId, isGroup: true, groupId });
            else io.to(recipientId).emit('stopTyping', { userId, isGroup: false });
        });

        socket.on('messageSeen', async (data) => {
            const { messageId, senderId } = data;
            try {
                await Message.findByIdAndUpdate(messageId, { isSeen: true });
                io.to(senderId).emit('messageSeenUpdate', { messageId });
            } catch (err) {
                console.error('[CHAT-ERROR] messageSeen failed:', err);
            }
        });

        socket.on('disconnect', async () => {
            console.log(`[PRESENCE] User Disconnected: ${socket.user.name}`);

            setTimeout(async () => {
                const stillConnected = (await io.in(userId.toString()).fetchSockets()).length > 0;
                if (!stillConnected) {
                    const user = await User.findById(userId);
                    // Persist working statuses even when socket is gone
                    const persists = ['Working', 'On Break', 'Idle'];
                    const finalStatus = (user && persists.includes(user.currentStatus)) ? user.currentStatus : 'Offline';

                    await User.findByIdAndUpdate(userId, {
                        isOnline: false,
                        currentStatus: finalStatus,
                        lastActiveAt: new Date()
                    });
                    broadcastStatus(userId, finalStatus);
                }
            }, 10000); // 10s grace period
        });
    });

    return io;
};

const getIo = () => {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
};

const broadcastStatus = (userId, status) => {
    if (io) {
        io.to('admins').emit('statusUpdate', { userId, status });
        io.to(userId.toString()).emit('statusUpdate', { userId, status });
    }
};

module.exports = { initSocket, getIo, broadcastStatus };
