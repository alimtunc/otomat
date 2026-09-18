export function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("The file could not be read."));
    });
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("The file could not be read.")),
    );
    reader.readAsDataURL(blob);
  });
}
