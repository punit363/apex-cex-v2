const generateTradeId = () => {
  return "trd_" + Math.random().toString(36).substring(2, 15);
};

const generateCandleId = () => {
  return "cd_" + Math.random().toString(36).substring(2, 15);
};


export { generateTradeId, generateCandleId };
