require("dotenv").config();
const fs = require("fs");
const path = require("path");
const convert = require("xml-js");
const mysql = require("mysql");
const url = require("url");

// WiiU games infos folder path
const dirPath = path.join("/var/www/ghosteshop/cdn/db/wiiu/titles/languages");
const gamesWebUrl = "https://cdn.ghosteshop.com/Nintendo WiiU/EUR";
const gamePath = path.join("/var/www/ghosteshop/cdn/Nintendo WiiU/EUR");
const videosPath = path.join("/var/www/ghosteshop/cdn/db/wiiu/videos");

// Connect to MySQL
var connection = mysql.createConnection({
  host: "localhost",
  user: "indexer",
  password: process.env.MYSQL_PASSWORD,
  database: "WiiU_Games",
});

connection.connect(async function (err) {
  var gameInfosDB = {};

  if (err) throw err;
  console.log("---\nConnected to MYSQL database !\n---");

  // List folders for game infos indexing
  const files = await fs.promises.readdir(dirPath);
  for await (const language of files.filter((file) =>
    fs.statSync(path.join(dirPath, file)).isDirectory()
  )) {
    const games = await fs.promises.readdir(path.join(dirPath, language));
    if (games.length < 100) {
      console.log(`Not enough games in ${language} folder !`);
      continue;
    }
    console.log(`Indexing ${games.length} games in ${language}`);
    const gameInfos = [];
    if (language == "en") {
      for await (const game of games) {
        let gameinfo = {};
        const gameInfo = await fs.promises.readFile(
          path.join(dirPath, language, game, "game_info.xml"),
          "utf8"
        );
        const gameInfoJson = await convert.xml2js(gameInfo, {
          compact: true,
          spaces: 4,
        });

        gameinfo.product_code = gameInfoJson.eshop.title.product_code
          ? gameInfoJson.eshop.title.product_code._text
          : undefined;
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
              .replace("<br>", "")
              .replace("<br><br>", "")
          : undefined;
        gameinfo.short_description = gameInfoJson.eshop.title.description
          ? gameInfoJson.eshop.title.description._text
              .substring(0, 125)
              .replace("<br><br>", "")
              .replace("<br>", "") + "..."
          : undefined;
        gameinfo.release_date = gameInfoJson.eshop.title.release_date_on_eshop
          ? gameInfoJson.eshop.title.release_date_on_eshop._text
          : undefined;
        gameinfo.score = gameInfoJson.eshop.title.star_rating_info
          ? gameInfoJson.eshop.title.star_rating_info.score._text
          : undefined;
        gameinfo.assetsURL = url.parse(
          "https://cdn.ghosteshop.com/db/wiiu/titles/languages/" +
            path.join(language, game)
        ).href;
        gameinfo.icon = url.parse(
          "https://cdn.ghosteshop.com/db/wiiu/titles/languages/" +
            path.join(language, game, "ressources/icon.png")
        ).href;
        gameinfo.banner = url.parse(
          "https://cdn.ghosteshop.com/db/wiiu/titles/languages/" +
            path.join(language, game, "ressources/banner.png")
        ).href;

        const screens = await fs.promises
          .readdir(
            path.join(dirPath, language, game, "ressources", "screenshots")
          )
          .catch(() => []);
        const screensURL = [];
        screens.forEach((screen) => {
          screensURL.push(
            url.parse(
              "https://cdn.ghosteshop.com/db/wiiu/titles/languages/" +
                path.join(language, game, "ressources", "screenshots", screen)
            ).href
          );
        });
        gameinfo.screenshots = screensURL;
        gameInfos.push(gameinfo);
      }
      gameInfosDB[language] = gameInfos;
    }
  }

  const gamesFiles = await fs.promises.readdir(gamePath);
  await gameInfosDB["en"].forEach((game, index) => {
    let gameFileURL = [];
    gamesFiles.forEach((file) => {
      if (file.toLowerCase().startsWith(game.name.toLowerCase())) {
        let gameSize =
          fs.statSync(path.join(gamePath, file)).size / (1024 * 1024);
        gameFileURL.push({
          name: file,
          url: url.parse(gamesWebUrl + "/" + path.join(file)).href,
          size: gameSize.toFixed(2) + "MiB",
        });
      }
    });
    console.log(gameFileURL);
    if (gameFileURL.length > 0) {
      gameInfosDB["en"][index].files = gameFileURL;
    }
  });
  const videoDir = await fs.promises.readdir(videosPath);
  await gameInfosDB["en"].forEach((game, index) => {
    let videoFileURL = [];
    videoDir.forEach((file) => {
      if (file.toLowerCase().includes(game.name.toLowerCase())) {
        const videoFiles = fs.readdirSync(path.join(videosPath, file));
        videoFiles.forEach((video) => {
          videoFileURL.push({
            name: video,
            url: url.parse(
              "https://cdn.ghosteshop.com/db/wiiu/videos/" +
                path.join(file, video)
            ).href,
          });
        });
      }
    });
    if (videoFileURL.length > 0) {
      gameInfosDB["en"][index].videos = videoFileURL;
    }
  });
  await fs.writeFile("data.json", JSON.stringify(gameInfosDB), (err) => {
    if (err) throw err;
    console.log("Data saved !");
    process.exit();
  });
});
