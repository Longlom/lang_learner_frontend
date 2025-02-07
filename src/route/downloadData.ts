import { IRouteHandler } from ".";

import { PATH_TO_DOWNLOAD_STATE } from "./downloadHandler/utils";
import { readFileSync } from "node:fs";

const downloadData: IRouteHandler = async (req, res) => {
  const dfState = readFileSync(PATH_TO_DOWNLOAD_STATE);

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(dfState);
  return;
};

export { downloadData };
