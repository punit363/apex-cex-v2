const generateAPIResponse = (
  data: any,
  message: string,
  status: string,
  status_code: number
) => {
  return {
    data,
    status_code,
    status,
    message,
  };
};

const generateErrorResponse = (
  message: string,
  status: string,
  status_code: number
) => {
  return {
    data: null,
    status_code,
    status,
    message,
  };
};

export { generateAPIResponse, generateErrorResponse };
