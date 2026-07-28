let ioInstance = null;

/**
 * Set the global socket.io server instance.
 * @param {object} io - Socket.io Server instance
 */
function setIo(io) {
  ioInstance = io;
}

/**
 * Get the global socket.io server instance.
 * @returns {object|null}
 */
function getIo() {
  return ioInstance;
}

module.exports = {
  setIo,
  getIo
};
