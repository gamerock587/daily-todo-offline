# Daily ToDo Offline

Run npm ci, then npm start. The widget lives in the tray; click its checkmark to open it. Drag the widget to move it. Escape or × hides the panel. Quit from the tray.

Add a task, edit its text inline, mark it complete or delete it after confirmation. Changes persist locally in the Electron user-data profile. Saved snippets read the clipboard only when you click Save clipboard. Click a snippet to copy it. There is no automatic clipboard history.

Export backup saves a versioned JSON file containing tasks and snippets. Import validates a backup and asks before replacing your current data. Backups can contain sensitive text: store them privately. The app has no sign-in, API, backend, cloud sync, remote fonts or remote icons. It does not register itself for Windows startup.

Source dependencies need internet access during npm ci. The installed app works without internet. Development and builds should use synthetic task data. Existing cloud-version data is not automatically imported; export and review it separately.
