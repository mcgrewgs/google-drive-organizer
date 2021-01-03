# Google Drive Auto-Organizer

Recursively crawls a `SOURCE_FOLDER_ID` folder in Google Drive and organizes files into subfolders of `TARGET_PARENT_FOLDER_ID` based on filename prefixes.

# Running

```sh
# clone
git clone ssh://git@github.com/mcgrewgs/google-drive-organizer.git
cd google-drive-organizer

# update .env file appropriately
cp .env.template .env
vi .env

# update google-drive-credentials.json appropriately
cp google-drive-credentials.template.json google-drive-credentials.json
vi google-drive-credentials.json

# run
make run
```
