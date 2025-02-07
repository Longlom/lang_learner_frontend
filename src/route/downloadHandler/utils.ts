import { readFileSync, writeFileSync } from "node:fs";
import { IncomingMessage } from "node:http";
import { resolve } from "node:path";

export const DOWNLOAD_STATE = {
  SAVED: "SAVED",
  ERROR: "ERROR",
  UPLOADING: "UPLOADING",
} as const;

export const PATH_TO_DOWNLOAD_STATE = resolve(`./db/downloadFileState.json`);

export const writeToDB = (objToWrite: Object) => {
  const objString = JSON.stringify(objToWrite);
  writeFileSync(PATH_TO_DOWNLOAD_STATE, objString);
};

export const readFromDB = () => {
  const dfState = JSON.parse(readFileSync(PATH_TO_DOWNLOAD_STATE).toString());
  return dfState;
};

export const writeStateToDB = (
  filename: string,
  state: keyof typeof DOWNLOAD_STATE,
  info?: object
) => {
  const dfState = readFromDB();

  if (!info) {
    info = {
      time: new Date().toISOString(),
    };
  } else {
    info = {
      ...info,
      time: new Date().toISOString(),
    };
  }

  dfState[filename] = {
    STATE: state,
    info,
  };

  writeToDB(dfState);
};

export async function getBody(req: IncomingMessage): Promise<string> {
  return await new Promise((res) => {
    const bodyParts: Uint8Array[] = [];
    let body;
    req
      .on("data", (chunk) => {
        bodyParts.push(chunk);
      })
      .on("end", () => {
        body = Buffer.concat(bodyParts).toString();
        res(body);
      });
  });
}
