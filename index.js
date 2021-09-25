import fs from "fs";
import "dotenv/config";
import fetch from "node-fetch";
import log4js from "log4js";

// 共通情報
const API_KEY = process.env.API_KEY;
const SEARCH_AREAS_INPUT = "search-areas.txt";
const SEARCH_KEYWORDS_INPUT = "search-keywords.txt";
const SEARCH_FILTERS_INPUT = "search-filters.txt";
const SEARCH_RESULT_OUTPUT = "search-result.tsv";

let logger;

/**
 * プロジェクトの初期化処理
 * @overview 実行結果出力フォルダを作成する
 * @returns string 実行結果出力フォルダへのパス
 */
const initialize = () => {
  /**
   * dateオブジェクトを文字列で返却する
   * @param {object} date
   * @returns string yyyymmdd_hhmmss
   */
  const formateDate = (date) => {
    date = new Date(date);
    const pad = (n) => {
      return n > 9 ? n : "0" + n;
    };
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
      date.getDate()
    )}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(
      date.getSeconds()
    )}`;
  };

  const nowFormat = formateDate(new Date());

  const path = `search_result/${nowFormat}`;
  if (fs.existsSync(path)) {
    return false;
  } else {
    fs.mkdirSync(path);
  }

  return path;
};

/**
 * プロジェクトの終了時処理
 * @overview 引数に指定したファイルを「実行結果出力フォルダ」へコピーする
 * @param {Array<string>} srcArr
 * @param {string} destDir
 */
const finalize = (srcArr, destDir) => {
  for (const src of srcArr) {
    fs.copyFile(src, `${destDir}/${src}`, fs.constants.COPYFILE_EXCL, (err) => {
      if (err) {
        throw err;
      } else {
        console.log("ファイルをコピーしました。");
      }
    });
  }
};

/**
 * TextSearch
 * 引数[searchText]に指定した文字列で検索し、検索結果の全ての建物のplace_idをリストで返却する。
 * @param {string} searchText 検索したい文字列 例）渋谷 整骨院
 * @returns {Array<string>} placeIds 取得した建物のplace_idリスト
 */
const fetchPlaceIds = async (searchText, filters) => {
  // 変数宣言
  let placeIds = [];
  const TEXT_SEARCH_URL =
    "https://maps.googleapis.com/maps/api/place/textsearch/json";
  let searchParams = new URLSearchParams({
    query: searchText,
    language: "ja",
    key: API_KEY,
  });
  let nextPageToken;
  let response, responseJson, results;

  // nextPageTokenがreturnされる限り情報を取得し続け、placeIds[]にplace_idを追加していく。
  do {
    if (nextPageToken) {
      logger.info(`nextPageToken of ${searchText}--`);
      logger.info(nextPageToken);
      console.log(`nextPageToken of ${searchText}--`);
      console.log(nextPageToken);
      searchParams = new URLSearchParams({
        // query: searchText,
        language: "ja",
        key: API_KEY,
        pagetoken: nextPageToken, // ☆
      });

      // next_page_tokenの発行時間と、利用開始時間に遅延があるみたいなので、1秒待つ処理を入れる。
      // https://developers.google.com/maps/documentation/places/web-service/search-text#PlaceSearchPaging
      await sleep(1);
    }
    logger.info(`fetching ${searchText}--`);
    console.log(`fetching ${searchText}--`);
    responseJson = await promiseFetch(`${TEXT_SEARCH_URL}?${searchParams}`);
    results = responseJson.results;
    for (let result of results) {
      if (filters.addressIn) {
        if (result.formatted_address.search(filters.addressIn) !== -1) {
          placeIds.push(result.place_id);
        } else {
        }
      } else {
        placeIds.push(result.place_id);
      }
    }
    nextPageToken = responseJson.next_page_token;
    nextPageToken = null;
  } while (nextPageToken);

  return placeIds;
};

const sleep = async (second) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, second * 1000);
  });
};

const promiseFetch = async (fetchUrl) => {
  console.log(fetchUrl);
  logger.info(fetchUrl);
  return new Promise(async (resolve, reject) => {
    try {
      let response, responseJson;
      const obj = setInterval(async () => {
        response = await fetch(fetchUrl);
        responseJson = await response.json();
        if (responseJson.status === "INVALID_REQUEST") {
          logger.info("Reponse status is INVALID_REQUEST yet.");
          console.log("Reponse status is INVALID_REQUEST yet.");
        } else if (responseJson.status === "OK") {
          resolve(responseJson);
          clearInterval(obj);
        } else {
          logger.info(responseJson);
          console.log(responseJson);
          reject();
        }
      }, 1000);
    } catch (e) {
      reject(e);
      logger.info("error occured.");
      logger.info(e);
      console.log(e);
    }
  });
};

/**
 * Details Search
 * @param {string} placeId place_id
 * @returns
 */
const fetchDetail = async (placeId) => {
  const PLACE_DETAILS_URL =
    "https://maps.googleapis.com/maps/api/place/details/json";
  const searchParams = new URLSearchParams({
    language: "ja",
    place_id: placeId,
    fields:
      "types,name,formatted_phone_number,formatted_address,business_status,opening_hours,rating,reviews,user_ratings_total,website,url",
    key: API_KEY,
  });
  const response = await fetch(`${PLACE_DETAILS_URL}?${searchParams}`);
  const responseJson = await response.json();
  const result = responseJson.result;
  return result;
};

/**
 * メイン処理
 */
(async () => {
  const startTime = new Date();

  const searchResultDir = initialize();

  // ログ管理の初期設定
  log4js.configure({
    appenders: {
      app: { type: "file", filename: `${searchResultDir}/app.log` },
    },
    categories: {
      default: { appenders: ["app"], level: "debug" },
    },
  });
  logger = log4js.getLogger();
  logger.level = "debug";

  if (!searchResultDir) {
    console.log(
      "フォルダが既に存在していたため、処理を中断しました。\n再度実行してください。"
    );
    return;
  }

  // 変数定義
  let searchTexts = [];
  const areasInput = fs.readFileSync(SEARCH_AREAS_INPUT, "utf8");
  const keywordsInput = fs.readFileSync(SEARCH_KEYWORDS_INPUT, "utf8");
  const filtersInput = fs.readFileSync(SEARCH_FILTERS_INPUT, "utf8");
  const filters = { addressIn: filtersInput.substr(10) };
  const areasLines = areasInput.toString().split("\r\n");
  const keywordsLines = keywordsInput.toString().split("\r\n");
  for (var areaLine of areasLines) {
    for (var keywordLine of keywordsLines) {
      searchTexts.push(`${areaLine} ${keywordLine}`);
    }
  }
  console.log("次のキーワードで検索します。");
  console.log(searchTexts);
  logger.info("次のキーワードで検索します。");
  logger.info(searchTexts);

  let placeInfo = [];
  for (let searchText of searchTexts) {
    let placeIds = await fetchPlaceIds(searchText, filters);
    placeInfo.push({ searchText: searchText, placeIds: placeIds });
  }
  logger.info("placeInfo---");
  logger.info(placeInfo);

  const titleArr = [
    "searchText",
    "tplace_id",
    "types",
    "name",
    "formatted_phone_number",
    "formatted_address",
    "business_status",
    "opening_hours",
    "月",
    "火",
    "水",
    "木",
    "金",
    "土",
    "日",
    "rating",
    "reviews",
    "user_ratings_total",
    "website",
    "map_url",
  ];
  // const title = `searchText\tplace_id\ttypes\tname\tformatted_phone_number\tformatted_address\tbusiness_status\topening_hours\t月\t火\t水\t木\t金\t土\t日\trating\treviews\tuser_ratings_total\twebsite\tmap_url`;
  const title = titleArr.join(`\t`);

  let tsvData = title + "\n";
  let fetchedIds = []; // 詳細取得済みのidリスト
  for (let info of placeInfo) {
    for (let id of info.placeIds) {
      // 既にfetchDetailしたidはスルーする。
      if (!fetchedIds.includes(id)) {
        const detail = await fetchDetail(id);
        if (detail) {
          logger.info(detail);

          fetchedIds.push(id);

          let openingHours;
          if (detail.opening_hours) {
            openingHours = detail.opening_hours.weekday_text;
          } else {
            openingHours = ["-", "-", "-", "-", "-", "-", "-"];
          }

          // let reviews = JSON.stringify(detail.reviews);
          let reviews;
          let tempReviews = "";
          if (detail.reviews) {
            reviews = ``;
            for (let review of detail.reviews) {
              tempReviews += [
                `名前：${review.author_name}`,
                `評価：${review.rating}`,
                `内容：${review.text.replace(/\n/g,`\n　　　`)}`,
                `日付：${review.relative_time_description}`,
                `-------------------------------------------`,
                ``,
              ].join(`\n`);
              tempReviews = tempReviews.replace(/"/g,`'`);
            }
            reviews += `"${tempReviews}"`;
          } else {
            reviews = "-";
          }

          const rowDataArr = [
            info.searchText,
            id,
            detail.types,
            detail.name,
            detail.formatted_phone_number,
            detail.formatted_address,
            detail.business_status,
            detail.opening_hours || "undefined",
            openingHours[0],
            openingHours[1],
            openingHours[2],
            openingHours[3],
            openingHours[4],
            openingHours[5],
            openingHours[6],
            detail.rating,
            // detail.reviews,
            reviews,
            detail.user_ratings_total,
            detail.website,
            detail.url,
          ];
          const rowData = rowDataArr.join(`\t`);
          // const rowData = `${info.searchText}\t${id}\t${detail.types}\t${detail.name}\t${detail.formatted_phone_number}\t${detail.formatted_address}\t${detail.business_status}\t${detail.opening_hours}\t${openingHours[0]}\t${openingHours[1]}\t${openingHours[2]}\t${openingHours[3]}\t${openingHours[4]}\t${openingHours[5]}\t${openingHours[6]}\t${detail.rating}\t${detail.reviews}\t${detail.user_ratings_total}\t${detail.website}\t${detail.url}`;
          tsvData += rowData + "\n";
        } else {
          console.log(
            `次のplaece_idはdetail情報を取得できませんでした。 place_id ---> ${id}`
          );
          logger.info(
            `次のplaece_idはdetail情報を取得できませんでした。 place_id ---> ${id}`
          );
        }
      }
    }
  }

  fs.writeFileSync(`${searchResultDir}/${SEARCH_RESULT_OUTPUT}`, tsvData);
  console.log(
    `検索結果を[${searchResultDir}/${SEARCH_RESULT_OUTPUT}]に出力しました。`
  );
  logger.info(
    `検索結果を[${searchResultDir}/${SEARCH_RESULT_OUTPUT}]に出力しました。`
  );

  const srcArr = [
    SEARCH_AREAS_INPUT,
    SEARCH_KEYWORDS_INPUT,
    SEARCH_FILTERS_INPUT,
  ];
  finalize(srcArr, searchResultDir);
  console.log(
    `今回の検索に利用したファイルは${searchResultDir}に格納しました。`
  );
  logger.info(
    `今回の検索に利用したファイルは${searchResultDir}に格納しました。`
  );

  const endTime = new Date();
  const excuteTime = (endTime - startTime) / 1000; /* ミリ秒 */
  console.log(`実行時間 ---> ${excuteTime} 秒`);
  logger.info(`実行時間 ---> ${excuteTime} 秒`);
})();
