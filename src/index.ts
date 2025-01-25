import * as http from "http";
import { routeExtractor } from "./utils/routeExtractor";
import { CSS_STYLES_PATH, routeHandlersMap } from "./route";
import { stylesHandler } from "./route/stylesHandler";

const hostname = "127.0.0.1";
const port = 3030;

const server = http.createServer(async (req, res) => {

  const path = routeExtractor(req);

  const pathHandler = routeHandlersMap[path];

  if (pathHandler) {
    await pathHandler(req, res);
    return;
  } else if (path.includes(CSS_STYLES_PATH)) {
    await stylesHandler(req, res);
    return;
  }

  res.statusCode = 500;
  res.setHeader("Content-Type", "text/plai");
  res.end("Unknown path \n");
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
