export interface Folder {
    name: string;
    id: string;
    parents?: string[];
}

export interface File {
    name: string;
    id: string;
    parents?: string[];
}

export function folderSortFunction(a: Folder, b: Folder): number {
    return a.name < b.name ? -1 : a.name === b.name ? 0 : 1;
}
