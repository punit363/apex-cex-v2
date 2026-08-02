import { CONFIG } from "../config/config.js";

const getAllActiveSymbols = () => {
  return CONFIG.SUPPORTED_MARKETS;
};

const getRiskShardId =(user_id:string)=>{
    return `risk:shard:1`
}

export { getAllActiveSymbols,getRiskShardId };
