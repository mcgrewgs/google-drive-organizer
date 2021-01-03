import { config } from "dotenv";
import "../environment";
config();

import { Logger } from "@nestjs/common";
const logger = new Logger("client/drive.ts", true);

import * as fs from "fs";
import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import prompts from "prompts";
import { File, Folder } from "../model/drive";

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/drive"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "token.json";

const credsContent = JSON.parse(
    fs.readFileSync(process.env.CREDENTIALS_JSON_FILENAME).toString()
);

/**
 * Create an OAuth2 client and return it.
 */
export async function getClient(): Promise<OAuth2Client> {
    const { client_secret, client_id, redirect_uris } = credsContent.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
    );

    // Check if we have previously stored a token.
    try {
        const tokenContents = JSON.parse(
            fs.readFileSync(TOKEN_PATH).toString()
        );
        oAuth2Client.setCredentials(tokenContents);
        return oAuth2Client;
    } catch (e) {
        return await getAccessToken(oAuth2Client);
    }
}

/**
 * Get and store new token after prompting for user authorization, and return the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for
 */
async function getAccessToken(
    oAuth2Client: OAuth2Client
): Promise<OAuth2Client> {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
    });
    logger.log("Authorize this app by visiting this url: ", authUrl);

    const code = await prompts({
        name: "code",
        type: "text",
        message: "Enter the code from that page here: ",
    });
    const token = await oAuth2Client.getToken(code.code);
    oAuth2Client.setCredentials(token.tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token.tokens));
    return oAuth2Client;
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
export async function listFiles(
    oAuth2Client: OAuth2Client,
    parent: Folder = {
        id: process.env.SOURCE_FOLDER_ID,
        name: process.env.SOURCE_FOLDER_NAME,
    },
    n = 100,
    pageToken: string | undefined = undefined
): Promise<File[]> {
    const drive = google.drive({ version: "v3", auth: oAuth2Client });
    const filesToReturn: File[] = [];

    const res = await drive.files.list({
        q: `mimeType!='application/vnd.google-apps.folder' and '${parent.id}' in parents`,
        pageSize: n,
        fields: "nextPageToken, files(id, name, parents)",
        pageToken,
    });
    const files = res.data.files;
    if (files && files.length) {
        logger.debug(`${parent.name}: ${files.length} more files`);
        for (const file of files) {
            if (file.name && file.id) {
                let p: string[] = [];
                if (file.parents) {
                    p = file.parents;
                }
                filesToReturn.push({
                    name: file.name,
                    id: file.id,
                    parents: p,
                });
            }
        }
    }
    if (res.data.nextPageToken) {
        filesToReturn.push(
            ...(await listFiles(
                oAuth2Client,
                parent,
                n,
                res.data.nextPageToken
            ))
        );
    }
    return filesToReturn;
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
export async function listFilesRecursive(
    oAuth2Client: OAuth2Client,
    parent: Folder = {
        id: process.env.SOURCE_FOLDER_ID,
        name: process.env.SOURCE_FOLDER_NAME,
    },
    n = 100,
    pageToken: string | undefined = undefined
): Promise<File[]> {
    const drive = google.drive({ version: "v3", auth: oAuth2Client });
    const filesToReturn: File[] = [];

    const res = await drive.files.list({
        q: `mimeType!='application/vnd.google-apps.folder' and '${parent.id}' in parents`,
        pageSize: n,
        fields: "nextPageToken, files(id, name, parents)",
        pageToken,
    });
    const files = res.data.files;
    if (files && files.length) {
        logger.debug(`${parent.name}: ${files.length} more files`);
        for (const file of files) {
            if (file.name && file.id) {
                let p: string[] = [];
                if (file.parents) {
                    p = file.parents;
                }
                filesToReturn.push({
                    name: file.name,
                    id: file.id,
                    parents: p,
                });
            }
        }
    }
    if (res.data.nextPageToken) {
        filesToReturn.push(
            ...(await listFilesRecursive(
                oAuth2Client,
                parent,
                n,
                res.data.nextPageToken
            ))
        );
    }
    for (const f of await listFolders(oAuth2Client, parent, n)) {
        filesToReturn.push(
            ...(await listFilesRecursive(
                oAuth2Client,
                {
                    id: f.id,
                    name: `${parent.name}/${f.name}`,
                },
                n
            ))
        );
    }
    return filesToReturn;
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
export async function listFolders(
    oAuth2Client: OAuth2Client,
    parent: Folder = {
        id: process.env.TARGET_PARENT_FOLDER_ID,
        name: process.env.TARGET_PARENT_FOLDER_NAME,
    },
    n = 100,
    pageToken: string | undefined = undefined
): Promise<Folder[]> {
    const drive = google.drive({ version: "v3", auth: oAuth2Client });
    const filesToReturn: Folder[] = [];

    const res = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and '${parent.id}' in parents`,
        pageSize: n,
        fields: "nextPageToken, files(id, name)",
        pageToken,
    });
    const files = res.data.files;
    if (files && files.length) {
        logger.debug(`${parent.name}: ${files.length} more folders`);
        for (const file of files) {
            if (file.name && file.id) {
                filesToReturn.push({ name: file.name, id: file.id });
            }
        }
    }
    if (res.data.nextPageToken) {
        filesToReturn.push(
            ...(await listFolders(
                oAuth2Client,
                parent,
                n,
                res.data.nextPageToken
            ))
        );
    }
    return filesToReturn;
}

export async function moveFile(
    oAuth2Client: OAuth2Client,
    file: File,
    parentId: string
): Promise<boolean> {
    const drive = google.drive({ version: "v3", auth: oAuth2Client });
    if (file.parents && file.parents.length > 0) {
        await drive.files.update({
            fileId: file.id,
            removeParents: file.parents?.join(","),
        });
    }
    const res = await drive.files.update({
        fileId: file.id,
        addParents: parentId,
    });
    return res.data.parents?.includes(parentId) || false;
}
