import { IncomingMessage } from "http";

export type Path = string;

const routeExtractor: (req: IncomingMessage) => Path = (
  req: IncomingMessage
) => {
  const route = req.url;

  console.log("Extracted route - ", route);
  return route || "/";
};

export { routeExtractor };
