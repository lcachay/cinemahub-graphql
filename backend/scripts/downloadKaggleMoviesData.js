const { exec } = require("child_process");
const path = require("path");

const dataset = "movies_metadata.csv";
const datasetPath = path.join(__dirname, "../data");

const fs = require("fs");
if (!fs.existsSync(datasetPath)) {
  fs.mkdirSync(datasetPath);
}

const downloadCommand = `kaggle datasets download -d rounakbanik/the-movies-dataset -p ${datasetPath} --unzip`;

exec(downloadCommand, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error downloading dataset: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
});
