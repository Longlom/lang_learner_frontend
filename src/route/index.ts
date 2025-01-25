import { IncomingMessage, OutgoingMessage, ServerResponse } from "http"
import { Path } from "../utils/routeExtractor"
import { indexHandler } from "./indexHandler";
import { pingHandler } from "./pingHandler";
import { loginHandler } from "./loginRoute";
import { downloadHandler } from "./donwloadHandler";
import { downloadFormRouteHandler } from "./downloadFormRoute";

export type IRouteHandler = (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => Promise<void>

export type IRouteHandlersMap = Record<Path, IRouteHandler | undefined>


const routeHandlersMap: IRouteHandlersMap = {
    "/": indexHandler,
    "/ping": pingHandler,
    "/login": loginHandler,
    "/download": downloadHandler,
    "/downloadForm": downloadFormRouteHandler,
};



export const CSS_STYLES_PATH = '/styles';



export {routeHandlersMap};