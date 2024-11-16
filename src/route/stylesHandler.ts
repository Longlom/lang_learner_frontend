import { readFile } from "fs/promises";
import { IRouteHandler } from ".";
import { serverError } from "../errors/errorServer";
import { resolve } from "path";

const getCssFilePath = (url: string = "") => {
    return resolve(`./src/pages${url}`);
 }


const stylesHandler: IRouteHandler = async (req, res) => {
    let contents;
    try {
        const filePath = getCssFilePath(req.url);
        contents = await readFile(filePath, { encoding: 'utf8' });
      } catch (err) {
        let e = err as Error;
        return serverError(req, res, e);
      }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/css");
  res.end(contents);
  return;
};

export { stylesHandler };
