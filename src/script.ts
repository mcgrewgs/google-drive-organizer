import { config } from "dotenv";
import "./environment";
config();

import { Logger } from "@nestjs/common";
const logger = new Logger("script.ts", true);

import {
    getClient,
    listFilesRecursive,
    listFolders,
    moveFile,
} from "./client/drive";
import { Folder } from "./model/drive";

function prefix(a: string): string {
    if (a.indexOf("_") > 0) {
        return a.substring(0, a.indexOf("_"));
    } else {
        return a;
    }
}

function clean(a: string): string {
    return a.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const minPrefixCount = 3;

async function main(): Promise<void> {
    const client = await getClient();
    const folderList = await listFolders(client);
    const filePrefixMap = new Map<string, Folder>();
    const missingPrefixesMap = new Map<string, number>();
    for (const f of folderList) {
        filePrefixMap.set(clean(f.name), f);
    }
    const fileList = await listFilesRecursive(client);
    for (const f of fileList) {
        const p = clean(prefix(f.name));
        let moved = false;
        if (filePrefixMap.has(p)) {
            const folder = filePrefixMap.get(p);
            if (folder) {
                logger.log(`${f.name} matches ${folder.name} (${folder.id})`);
                await moveFile(client, f, folder.id);
                moved = true;
            }
        } else {
            for (const pf of filePrefixMap.values()) {
                if (f.name.startsWith(pf.name)) {
                    logger.log(`${f.name} matches ${pf.name} (${pf.id})`);
                    await moveFile(client, f, pf.id);
                    moved = true;
                    break;
                }
            }
        }
        if (!moved) {
            missingPrefixesMap.set(p, (missingPrefixesMap.get(p) || 0) + 1);
        }
    }
    let missingPrefixesArray: Array<{ prefix: string; count: number }> = [];
    for (const p of missingPrefixesMap.entries()) {
        if (p[1] >= minPrefixCount && p[0].length > 2) {
            missingPrefixesArray.push({
                prefix: p[0],
                count: p[1],
            });
        }
    }
    missingPrefixesArray = missingPrefixesArray.sort(
        (a, b) => b.count - a.count
    );
    logger.warn("Missing prefixes:");
    for (const m of missingPrefixesArray) {
        logger.warn(`${m.prefix}: ${m.count}`);
    }
}

main().then(() => {
    logger.log("Main done!");
});
