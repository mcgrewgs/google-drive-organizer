export interface Folder {
    name: string;
    id: string;
    parents?: string[];
}

export interface File {
    name: string;
    id: string;
    parents?: string[];
    mimeType?: string | null;
    fileExtension?: string | null;
    md5Checksum?: string | null;
    size?: string | null;
}

export function folderSortFunction(a: Folder, b: Folder): number {
    return a.name < b.name ? -1 : a.name === b.name ? 0 : 1;
}

function valid(a: string | null | undefined): string {
    return a || '';
}

export function dedupeKey(a: File): string {
    return [valid(a.mimeType), valid(a.size), valid(a.md5Checksum)].join(",");
}

export function prefixFilenameWithParent(
    file: File,
    parentFolderName: string
): string {
    const fileBaseName = file.name.split('/').slice(-1)[0];
    const parentFolderBaseName = parentFolderName.split('/').slice(-1)[0];
    if (fileBaseName.toLowerCase().startsWith(`${parentFolderBaseName.toLowerCase()}_`)) {
        return file.name;
    }
    const validPatterns = [
        `${parentFolderBaseName} `,
        `${parentFolderBaseName}-`,
        parentFolderBaseName
    ];
    for (const p of validPatterns) {
        if (fileBaseName.toLowerCase().startsWith(p.toLowerCase())) {
            return fileBaseName.replace(new RegExp(p, 'i'), `${parentFolderBaseName}_`);
        }
    }
    return `${parentFolderBaseName}_${fileBaseName}`;
}