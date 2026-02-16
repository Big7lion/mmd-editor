import { read } from "fs/promises";
import { write } from "fs/promises";

async function copyIcon() {
  const icon = await read("./src-tauri/icons/icon.png");
  await write("/Users/biglion/Projects/Tools/beatutiful-mermaid/src-tauri/icons/icon.png", icon);
}

copyIcon();
