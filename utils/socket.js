const socketio = require('socket.io');

let io;

const init = (server) => {
  io = socketio(server, {
    cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST'] }
  });
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('join', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`Socket ${socket.id} joined room user_${userId}`);
      }
    });
    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
  });
  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

const emitOrderUpdate = (userId, order) => {
  if (io) io.to(`user_${userId}`).emit('orderUpdate', order);
};

module.exports = { init, getIO, emitOrderUpdate };