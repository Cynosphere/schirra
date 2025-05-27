import asar from "@electron/asar";
import fs from "fs";
import path from "path";

const extensions = fs.readdirSync("./dist");
const repo = [];
for (const extension of extensions) {
  await asar.createPackage(path.join("./dist", extension), path.join("./repo", `${extension}.asar`));

  const manifest = JSON.parse(fs.readFileSync(path.join("./dist", extension, "manifest.json"), "utf-8"));

  manifest.download = `${process.env.REPO_URL}/${extension}.asar`;
  repo.push(manifest);
}

fs.writeFileSync(path.join("./repo", "repo.json"), JSON.stringify(repo, null, 2));
