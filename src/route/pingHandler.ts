import { IRouteHandler } from ".";


const pingHandler: IRouteHandler = async (req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    res.end("ping\n");
    return;


}

export {pingHandler};