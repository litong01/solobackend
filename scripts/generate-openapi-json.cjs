const fs = require("fs");
const path = require("path");
const yaml = require("yaml");

const root = path.resolve(__dirname, "..");
const yamlPath = path.join(root, "openapi.yaml");
const jsonPath = path.join(root, "openapi.json");

const raw = fs.readFileSync(yamlPath, "utf-8");
const spec = yaml.parse(raw);
fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2), "utf-8");
console.log("Wrote openapi.json");
