import { config } from "dotenv";
import "./environment";
config();

import { Logger } from "@nestjs/common";
const logger = new Logger("script.ts", true);

import {
    getClient,
    getDuplicatesFolder,
    listFiles,
    listFilesRecursive,
    listFolders,
    moveFile,
    renameFile,
} from "./client/drive";
import { Folder, File, dedupeKey, prefixFilenameWithParent } from "./model/drive";

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

async function autoSortByPrefixes(): Promise<void> {
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

async function findDuplicatesSingleFolder(parent: Folder): Promise<void> {
    logger.warn(`Checking ${parent.name} for duplicates...`)
    const client = await getClient();
    const filesByDedupeKey = new Map<string, File[]>();
    const dupesFolder = await getDuplicatesFolder(client, parent);
    const fileList = await listFiles(client, parent);
    for (const f of fileList) {
        const k = dedupeKey(f);
        let arr = filesByDedupeKey.get(k);
        if (arr) {
            arr.push(f);
        } else {
            arr = [f];
        }
        filesByDedupeKey.set(k, arr);
    }

    const sortedFiles: [number, File[]][] = [];
    filesByDedupeKey.forEach((v) => {
        if (v.length > 1) {
            sortedFiles.push([v.length, v]);
        }
    })
    sortedFiles.sort((a, b) => b[0] - a[0]);

    for (const f of sortedFiles) {
        const fileList = f[1];
        fileList.sort((a, b) => {
            const aStartsWithPrefix = a.name.startsWith(parent.name);
            const bStartsWithPrefix = b.name.startsWith(parent.name);
            if (aStartsWithPrefix && !bStartsWithPrefix) {
                // if a is prefixed with the folder name and b is not, keep a
                return -1;
            }
            if (!aStartsWithPrefix && bStartsWithPrefix) {
                // if b is prefixed with the folder name and a is not, keep b
                return 1;
            }
            const regexes = [
                /.+\((\d+)\)\.[^.]+/,
                /.+~(\d+)\.[^.]+/,
                /.+\.(\d+)\.[^.]+/,
                /.+_(\d+)\.[^.]+/
            ];
            for (const regex of regexes) {
                const aMatchesNumberSuffixRegex = regex.test(a.name);
                const bMatchesNumberSuffixRegex = regex.test(b.name);
                if (aMatchesNumberSuffixRegex && !bMatchesNumberSuffixRegex) {
                    // if a is suffixed with a number and b is not, keep b
                    return 1;
                }
                if (!aMatchesNumberSuffixRegex && bMatchesNumberSuffixRegex) {
                    // if b is suffixed with a number and a is not, keep a
                    return -1;
                }
                if (aMatchesNumberSuffixRegex && bMatchesNumberSuffixRegex) {
                    // if both a and b are suffixed with numbers, take the one whose number is smaller
                    const aNumberSuffix = regex.exec(a.name);
                    const bNumberSuffix = regex.exec(b.name);
                    if (aNumberSuffix && bNumberSuffix) {
                        return parseInt(aNumberSuffix[1]) - parseInt(bNumberSuffix[1]);
                    }
                }
            }
            // if all else fails, take the one with the first name alphabetically
            return a.name < b.name ? -1 : 1;
        });
        let dbgMsg = `  Keeping ${fileList[0].name}`;
        const newFileName = prefixFilenameWithParent(fileList[0], parent.name);
        if (newFileName !== fileList[0].name) {
            dbgMsg += ` (renaming to ${newFileName})`;
            await renameFile(client, fileList[0], newFileName);
        }
        logger.debug(dbgMsg);
        for (const dupe of fileList.slice(1)) {
            logger.debug(`    Moving ${dupe.name}`)
            await moveFile(client, dupe, dupesFolder.id);
        }
    }
}

async function findDuplicates(): Promise<void> {
    const client = await getClient();
    const folderList = await listFolders(client);
    for (const f of folderList) {
        await findDuplicatesSingleFolder(f);
    }
}


async function prefixFileNamesSingleFolder(parent: Folder): Promise<void> {
    logger.warn(`Prefixing ${parent.name} files:`)
    const client = await getClient();
    const fileList = await listFiles(client, parent);
    for (const f of fileList) {
        const newFileName = prefixFilenameWithParent(f, parent.name);
        if (newFileName !== f.name) {
            logger.log(`  Renaming ${f.name} to ${newFileName}`);
            await renameFile(client, f, newFileName);
        } else {
            logger.log(`  Leaving ${f.name} as-is`);
        }
    }
}


async function prefixFileNames(): Promise<void> {
    const client = await getClient();
    const folderList = await listFolders(client);
    for (const f of folderList) {
        await prefixFileNamesSingleFolder(f);
    }
}

void autoSortByPrefixes().then(() => {
    logger.log("Main done!");
});
