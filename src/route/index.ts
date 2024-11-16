import { IncomingMessage, OutgoingMessage, ServerResponse } from "http"
import { Path } from "../utils/routeExtractor"
import { indexHandler } from "./indexHandler";
import { pingHandler } from "./pingHandler";
import { loginHandler } from "./loginRoute";

export type IRouteHandler = (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => Promise<void>

export type IRouteHandlersMap = Record<Path, IRouteHandler | undefined>


const routeHandlersMap: IRouteHandlersMap = {
    "/": indexHandler,
    "/ping": pingHandler,
    "/login": loginHandler,
};



export const CSS_STYLES_PATH = '/styles';



export {routeHandlersMap};