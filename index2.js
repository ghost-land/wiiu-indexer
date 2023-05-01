require("dotenv").config();
const fs = require("fs");
const path = require("path");
const convert = require("xml-js");
const mysql = require("mysql");

// WiiU games infos folder path
const dirPath = path.join("/var/www/ghosteshop.com/cdn/db/wiiu");

// Connect to MySQL
var connection = mysql.createConnection({
  host: "localhost",
  user: "indexer",
  password: process.env.MYSQL_PASSWORD,
  database: "WiiU_Games",
});

connection.connect(async function (err) {
  // List folders for game infos indexing
  // List folders for game infos indexing
  const files = await fs.promises.readdir(dirPath);
  for await (const region of files.filter((file) =>
    fs.statSync(path.join(dirPath, file)).isDirectory()
  )) {
    const games = await fs.promises.readdir(path.join(dirPath, region));
    if (games.length < 100) {
      console.log(`Not enough games in ${region} folder !`);
      continue;
    }
    console.log(`Indexing ${games.length} games in ${region}`);
    const gameInfos = [];
    for await (const game of games) {
      let gameinfo = {};
      const gameInfo = await fs.promises.readFile(
        path.join(dirPath, region, game, "game_info.xml"),
        "utf8"
      );
      const gameInfoJson = await convert.xml2js(gameInfo, {
        compact: true,
        spaces: 4,
      });
      product_code = gameInfoJson.eshop.title.product_code;

      gameinfo.name = gameInfoJson.eshop.title.name
        ? gameInfoJson.eshop.title.name._text
        : undefined;
      gameinfo.publisher = gameInfoJson.eshop.title.publisher.name
        ? gameInfoJson.eshop.title.publisher.name._text
        : undefined;
      gameinfo.genre = gameInfoJson.eshop.title.display_genre
        ? gameInfoJson.eshop.title.display_genre._text
        : undefined;
      gameinfo.description = gameInfoJson.eshop.title.description
        ? gameInfoJson.eshop.title.description._text
        : undefined;
      gameinfo.release_date = gameInfoJson.eshop.title.release_date_on_eshop
        ? gameInfoJson.eshop.title.release_date_on_eshop._text
        : undefined;
      gameinfo.score = gameInfoJson.eshop.title.star_rating_info
        ? gameInfoJson.eshop.title.star_rating_info.score._text
        : undefined;
      if (region == "US") {
        const screens = await fs.promises
          .readdir(
            path.join(dirPath, region, game, "ressources", "screenshots")
          )
          .catch(() => []);
        gameinfo.screenshots = screens;
      }
      gameInfos.push(gameinfo);
    }
    gameInfosDB[region] = gameInfos;
    fs.writeFile("data.json", JSON.stringify(gameInfoDB), (err) => {
      if (err) throw err;
      console.log("Data saved !");
    });
  }

  console.log("Okay lesgow");
});
