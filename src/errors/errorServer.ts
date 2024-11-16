import { IncomingMessage, ServerResponse } from "http";
import { IRouteHandler } from "../route";

export type IErrorResponse = (
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  error: Error
) => Promise<void>;

const serverError: IErrorResponse = async (req, res, error) => {
  console.log(error.message);
  res.statusCode = 500;
  res.end("");
  return;
};

export { serverError };
