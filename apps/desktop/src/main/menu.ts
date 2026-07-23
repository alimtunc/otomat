import { Menu } from "electron";

export interface DataSafetyMenuActions {
  exportSupportBundle(): Promise<void>;
  showDataPolicy(): Promise<void>;
}

export function installApplicationMenu(actions: DataSafetyMenuActions): void {
  const menu = Menu.buildFromTemplate([
    {
      label: "Otomat",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Data Safety",
      submenu: [
        {
          label: "Export Support Bundle…",
          click: () => void actions.exportSupportBundle(),
        },
        {
          label: "Data Retention Policy…",
          click: () => void actions.showDataPolicy(),
        },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }],
    },
  ]);
  Menu.setApplicationMenu(menu);
}
