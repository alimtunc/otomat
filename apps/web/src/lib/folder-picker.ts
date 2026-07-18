/**
 * Seam for a native directory picker. The web build has none — registering a
 * repository stays an explicit path entry (browsers cannot expose real
 * filesystem paths). A future desktop shell injects its picker at startup via
 * `setFolderPicker`, which surfaces a Browse button next to the path field.
 */
export interface FolderPicker {
  /** Resolves the picked absolute directory path, or null when the user cancels. */
  pickFolder(): Promise<string | null>;
}

let activePicker: FolderPicker | null = null;

export function setFolderPicker(picker: FolderPicker | null): void {
  activePicker = picker;
}

export function getFolderPicker(): FolderPicker | null {
  return activePicker;
}
