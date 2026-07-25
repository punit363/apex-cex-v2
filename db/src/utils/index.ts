const generateBalanceLedgerId = () => {
  return "bl_" + Math.random().toString(36).substring(2, 15);
};

export { generateBalanceLedgerId };
