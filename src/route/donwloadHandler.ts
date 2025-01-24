import { IncomingMessage } from "http";
import { IRouteHandler } from ".";

import { chromium, Download, Page } from "playwright";
import { resolve } from "path";

import { createReadStream, existsSync, statSync } from "fs";

const BASE_UPLOAD_DIR = "disk:/Chinese";
const YA_API_OATH = "y0__xDAn5w3GI_UNCCC-c2MElRZ8g2KK3SXGq13JwLOcetm0yMD";
const UPLOAD_URL = "https://cloud-api.yandex.net/v1/disk/resources/upload";

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

const downloadHandler: IRouteHandler = async (req, res) => {
  // console.log(req.body);

  const body = await getBody(req);

  const bodyJsonParsed = JSON.parse(body);

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  res.end("Hello, World! \n");

  console.log(bodyJsonParsed);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(bodyJsonParsed.url);

  await page.waitForSelector("a.download-btn", { timeout: 1000 });

  const downloads: Download[] = await bulkDownload(page);
  const downloadedFileNames = downloads.map((download) =>
    download.suggestedFilename()
  );

  console.log("downloadedFileNames - ", downloadedFileNames);
  const filteredDownloadedFiles = downloads.filter(
    (d) => !existsSync(resolve(`./files/${d.suggestedFilename()}`))
  );

  console.log("filteredDownloadedFiles - ", filteredDownloadedFiles);

  console.log(
    "filteredDownloadedFiles - ",
    filteredDownloadedFiles.forEach((d) => console.log(d.suggestedFilename()))
  );

  await Promise.all(
    filteredDownloadedFiles.map((d) =>
      d.saveAs(resolve(`./files/${d.suggestedFilename()}`))
    )
  );
  // await page.waitForTimeout(30000);

  await browser.close();
  console.log("closing browser");

  if (!filteredDownloadedFiles.length) {
    console.log("END because zero filtered");
    return;
  }

  const dateStr = filteredDownloadedFiles[0].suggestedFilename();
  console.log("dateStr", dateStr);

  const uploadDirsName = filteredDownloadedFiles.map((d)z);

  // const dashedDateStr = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`

  const dirName =
    `/${dateStr.slice(6, 8)}-${dateStr.slice(4, 6)}`;

  const pathToUpload = BASE_UPLOAD_DIR + dirName;

  const fetchUploadLinkUrl = new URL(UPLOAD_URL);
  fetchUploadLinkUrl.searchParams.append("path", pathToUpload);

  const uploadLink = await fetch(fetchUploadLinkUrl, {
    headers: {
      Authorization:
        "OAuth y0__xDAn5w3GI_UNCCC-c2MElRZ8g2KK3SXGq13JwLOcetm0yMD",
    },
  });

  if (!uploadLink.ok) {
    return;
  }

  let responseData: any = await uploadLink.json();

  console.log("responseData -", responseData);

  const uploadFileUrl = responseData.href;

  const filenames = filteredDownloadedFiles.map((d) => d.suggestedFilename());

  for (const name of filenames) {
    const path = resolve(`./files/${name}`);


    const stats = statSync(path);
    const fileSizeInBytes = stats.size;
    let readStream = createReadStream(path);

    const uploadFileOperation = await fetch(uploadFileUrl, {
      method: "PUT",
      headers: {
        "Content-Length": `${fileSizeInBytes}`,
      },
      body: readStream,
      duplex: 'half',
    });

    console.log(uploadFileOperation);
  }
  return;
};

export { downloadHandler };
