import { IRouteHandler } from ".";

const indexHandler: IRouteHandler = async (req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  res.end("Hello, World! \n");
  return;
};

export { indexHandler };
