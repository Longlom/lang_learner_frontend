import mime from "mime";
import { IncomingMessage } from "http";
import { IRouteHandler } from "..";

import { chromium, Download, Page } from "playwright";
import { resolve } from "path";

import {
  createReadStream,
  statSync,
} from "fs";
import {
  DOWNLOAD_STATE,
  getBody,
  readFromDB,
  writeStateToDB,
} from "./utils";
import axios from "axios";
import { IExisitingDirs, IUploadLink } from "./types";

require("dotenv").config();

const BASE_UPLOAD_DIR = "/Chinese";
const UPLOAD_URL = "https://cloud-api.yandex.net/v1/disk/resources/upload";
const DISK_RES_URL = "https://cloud-api.yandex.net/v1/disk/resources";
const AUTH_TOKEN = `OAuth ${process.env.YA_DISK_TOKEN}`;

const AUTH_HEADER = {
  Authorization: AUTH_TOKEN,
};

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

    let checkDirs;

    try {
      checkDirs = await axios.get<IExisitingDirs>(checkPathUrl.toString(), {
        headers: AUTH_HEADER,
      });
    } catch (error) {
      console.log("Error on checking dirs request -", fileObj, error);
      continue;
    }
    const isDirExist = checkDirs.data._embedded.items.find(
      (item: any) => item.name === fileObj.dirName
    );

    if (!isDirExist) {
      const createDirUrl = new URL(DISK_RES_URL);
      createDirUrl.searchParams.append("path", `/Chinese/${fileObj.dirName}`);

      try {
        await axios.put(
          createDirUrl.toString(),
          undefined,
          {
            headers: AUTH_HEADER,
          }
        );
      } catch (error) {
         // @ts-ignore
        console.log("unable to create dir - ", fileObj.filePath, error.data);
        continue;
      }

      // if (!(createDirOp.ok && createDirOp.status === 201)) {

      // }
    }

    console.log("starting to upload file");

    const fetchUploadLinkUrl = new URL(UPLOAD_URL);
    fetchUploadLinkUrl.searchParams.append("path", fileObj.filePath);

    let uploadLink;

    try {
      uploadLink = await axios.get<IUploadLink>(fetchUploadLinkUrl.toString(), {
        headers: AUTH_HEADER,
      });
    } catch (error) {
      console.log("unable to get upload link to ", fileObj, error);
      continue;
    }
    const uploadFileUrl = uploadLink.data.href;
    const stats = statSync(fileObj.localPathToFile);

    const mimeType = mime.getType(fileObj.localPathToFile);
    const readStream = createReadStream(fileObj.localPathToFile);

    let start = Date.now();

    writeStateToDB(fileObj.filename, DOWNLOAD_STATE.UPLOADING);
    let percentCompleted;
    try {
      const uploadFileOperation = await axios.put(
        uploadFileUrl.toString(),
        readStream,
        {
          headers: {
            "Content-Type": mimeType,
          },
          onUploadProgress: (progressEvent) => {
            // Расчет процента загруженного
            percentCompleted = Math.round(
              (progressEvent.loaded * 100) / stats.size
            );
            console.log(`Прогресс загрузки: ${percentCompleted}%`);
          },
        }
      );
    } catch (error) {
      console.log(
        `Didnt upload file to url - ${uploadFileUrl}, file - ${fileObj}`
      );

      writeStateToDB(fileObj.filename, DOWNLOAD_STATE.ERROR, {
        info: `ERROR HAPPENED ON percentCompleted - ${percentCompleted}`,
      });
      continue;
    }

    console.log("Uploaded file");
    let end = Date.now();

    let elapsed = (end - start) / 1000;

    writeStateToDB(fileObj.filename, DOWNLOAD_STATE.SAVED, {
      info: `TIME OF UPLOAD - ${elapsed}`,
    });
  }
};

const downloadHandler: IRouteHandler = async (req, res) => {
  const body = await getBody(req);
  const bodyJsonParsed = JSON.parse(body);

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  res.end("Request for download accepted \n");

  const browser = await chromium.launch({ headless: true });
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

  const dfState = readFromDB();
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
