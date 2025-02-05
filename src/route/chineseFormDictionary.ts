import { IRouteHandler } from ".";

import { readFile  } from "fs/promises";
import { serverError } from "../errors/errorServer";
import { resolve } from "node:path";

const chineseFormDictionary: IRouteHandler = async (req, res) => {
    let contents;
    try {
        const filePath = resolve('./src/pages/chineseFormDictionary.html');
        contents = await readFile(filePath, { encoding: 'utf8' });
      } catch (err) {
        let e = err as Error;
        return serverError(req, res, e);
      }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html");
  res.end(contents);
  return;
};

export { chineseFormDictionary };
