/* eslint-disable @typescript-eslint/no-namespace */
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            CREDENTIALS_JSON_FILENAME: string;
            TARGET_PARENT_FOLDER_ID: string;
            TARGET_PARENT_FOLDER_NAME: string;
            SOURCE_FOLDER_ID: string;
            SOURCE_FOLDER_NAME: string;
        }
    }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {};
