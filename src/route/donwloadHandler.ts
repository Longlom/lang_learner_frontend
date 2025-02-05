import mime from "mime";
import { IncomingMessage } from "http";
import { IRouteHandler } from ".";

import { chromium, Download, Page } from "playwright";
import { resolve } from "path";

import {
  createReadStream,
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";

require("dotenv").config();

const BASE_UPLOAD_DIR = "/Chinese";
const UPLOAD_URL = "https://cloud-api.yandex.net/v1/disk/resources/upload";
const DISK_RES_URL = "https://cloud-api.yandex.net/v1/disk/resources";
const AUTH_TOKEN = `OAuth ${process.env.YA_DISK_TOKEN}`;

const PATH_TO_DOWNLOAD_STATE = resolve(`./db/downloadFileState.json`);

export const DOWNLOAD_STATE = {
  SAVED: "SAVED",
  ERROR: "ERROR",
  UPLOADING: "UPLOADING",
} as const;

const writeToDB = (objToWrite: Object) => {
  const objString = JSON.stringify(objToWrite);
  writeFileSync(PATH_TO_DOWNLOAD_STATE, objString);
};

const readFromDB = () => {
  const dfState = JSON.parse(readFileSync(PATH_TO_DOWNLOAD_STATE).toString());
  return dfState;
};

const writeStateToDB = (
  filename: string,
  state: keyof typeof DOWNLOAD_STATE,
  info?: object
) => {
  const dfState = readFromDB();

  dfState[filename] = {
    STATE: state,
    info,
  };

  writeToDB(dfState);
};

async function getBody(req: IncomingMessage): Promise<string> {
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

const bulkDownload = async (page: Page) => {
  const downloads: Download[] = [];
  page.on("download", (download: Download) => {
    console.log(
      "download.suggestedFilename() - ",
      download.suggestedFilename()
    );
    downloads.push(download);
  });

  const downloadLink = await page.$("a.download-btn");
  await downloadLink?.click({ timeout: 1000 });

  await page.waitForTimeout(5000);

  return downloads;
};

const uploadToDisk = async (files: Download[]) => {
  const processedFileObjects = files.map((f) => {
    const localPathToFile = resolve(`./files/${f.suggestedFilename()}`);
    const filename = f.suggestedFilename();
    const dirName = `${filename.slice(9, 11)}.${filename.slice(7, 9)}`;

    const dirPath = `${BASE_UPLOAD_DIR}/${dirName}`;
    const filePath = `${dirPath}/${filename}`;

    return {
      file: f,
      localPathToFile,
      filePath,
      dirPath,
      dirName,
      filename,
    };
  });

  for (const fileObj of processedFileObjects) {
    const checkPathUrl = new URL(DISK_RES_URL);
    checkPathUrl.searchParams.append("path", "Chinese");
    checkPathUrl.searchParams.append("fields", "_embedded.items.name");
    checkPathUrl.searchParams.append("limit", "100");
    const checkDirs = await fetch(checkPathUrl, {
      headers: {
        Authorization: AUTH_TOKEN,
      },
    });
    if (!(checkDirs.ok && checkDirs.status === 200)) {
      console.log("Error on checking dir -", fileObj, checkPathUrl);
      console.log("checkDirs -", checkDirs);
      continue;
    }

    const checkDirsRes: any = await checkDirs.json();
    const isDirExist = checkDirsRes._embedded.items.find(
      (item: any) => item.name === fileObj.dirName
    );

    if (!isDirExist) {
      const createDirUrl = new URL(DISK_RES_URL);
      createDirUrl.searchParams.append("path", `/Chinese/${fileObj.dirName}`);
      const createDirOp = await fetch(createDirUrl, {
        method: "PUT",
        headers: {
          Authorization: AUTH_TOKEN,
        },
      });

      if (!(createDirOp.ok && createDirOp.status === 201)) {
        console.log("unable to create dir - ", fileObj);
        continue;
      }
    }

    console.log("starting to upload file");

    const fetchUploadLinkUrl = new URL(UPLOAD_URL);
    fetchUploadLinkUrl.searchParams.append("path", fileObj.filePath);

    const uploadLink = await fetch(fetchUploadLinkUrl, {
      headers: {
        Authorization: AUTH_TOKEN,
      },
    });
    if (!(uploadLink.ok && uploadLink.status === 200)) {
      console.log("unable to get upload link to ", uploadLink, fileObj);
      continue;
    }

    const responseData: any = await uploadLink.json();

    const uploadFileUrl = responseData.href;
    const stats = statSync(fileObj.localPathToFile);

    const mimeType = mime.getType(fileObj.localPathToFile);
    const readStream = createReadStream(fileObj.localPathToFile);

    let start = Date.now();

    writeStateToDB(fileObj.filename, DOWNLOAD_STATE.UPLOADING);

    const uploadFileOperation = await fetch(uploadFileUrl, {
      method: "PUT",
      headers: {
        // "Content-Length": `${fileSizeInBytes}`,
        "Content-Type": mimeType || "",
      },
      // @ts-ignore
      body: readStream,
      duplex: "half",
    });

    console.log("Uploaded file");
    let end = Date.now();

    let elapsed = (end - start) / 1000;


    if (uploadFileOperation.status !== 201) {
      console.log(
        `Didnt upload file to url - ${uploadFileUrl}, file - ${fileObj}`,
        uploadFileOperation
      );

      writeStateToDB(fileObj.filename, DOWNLOAD_STATE.ERROR);

      continue;
    }

    writeStateToDB(fileObj.filename, DOWNLOAD_STATE.SAVED, {time: elapsed});
  }
};

const downloadHandler: IRouteHandler = async (req, res) => {
  const body = await getBody(req);
  const bodyJsonParsed = JSON.parse(body);

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  res.end("Request for download accepted \n");
  const dfState = readFromDB();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(bodyJsonParsed.url);

  const currentPage = await Promise.race([
    page
      .locator("a.download-btn")
      .waitFor({ state: "visible", timeout: 10000 })
      .then((res) => "DOWNLOAD_PAGE"),
    page
      .locator("input[type=password]")
      .waitFor({ state: "visible", timeout: 10000 })
      .then((res) => "LOGIN_PAGE"),
  ]);

  if (currentPage === "LOGIN_PAGE") {
    const pass = bodyJsonParsed.password;

    await page.locator("input[type=password]").pressSequentially(pass);
    await page.locator("#passcode_btn").click();
  }

  await page.waitForSelector("a.download-btn", { timeout: 10000 });

  const downloads: Download[] = await bulkDownload(page);

  const needToDownload = downloads.reduce<Download[]>((acc, download) => {
    const filename = download.suggestedFilename();
    if (
      !dfState[filename] ||
      dfState[filename].STATE === DOWNLOAD_STATE.ERROR ||
      dfState[filename].STATE === DOWNLOAD_STATE.UPLOADING
    ) {
      acc.push(download);
    }

    return acc;
  }, []);

  await Promise.all(
    needToDownload.map((d) =>
      d.saveAs(resolve(`./files/${d.suggestedFilename()}`))
    )
  );

  await browser.close();

  if (!needToDownload.length) {
    console.log("END because zero filtered");
    return;
  }

  await uploadToDisk(needToDownload);

  console.log("END AFTER UPLOAD DISk");

  return;
};

export { downloadHandler };
