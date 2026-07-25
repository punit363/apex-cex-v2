const generateOrderId = () => {
  return "odr_" + Math.random().toString(36).substring(2, 15);
};

const generateUserId = () => {
  return "usr_" + Math.random().toString(36).substring(2, 15);
};

const generateTransactionId = () => {
  return "tx_" + Math.random().toString(36).substring(2, 15);
};

const generateEngineRequestId = () => {
  return "eg_" + Math.random().toString(36).substring(2, 15);
};

export {
  generateOrderId,
  generateUserId,
  generateTransactionId,
  generateEngineRequestId,
};
