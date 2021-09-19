import fetch from "node-fetch";
import fs from "fs";
import "dotenv/config";

// 共通情報
const API_KEY = process.env.API_KEY;
const TSV_FILE_NAME = "search-result";
const SEARCH_TEXTS_FILE = "searchTexts.txt";

/**
 * TextSearch
 * 引数[searchText]に指定した文字列で検索し、検索結果の全ての建物のplace_idをリストで返却する。
 * @param {string} searchText 検索したい文字列 例）渋谷 整骨院
 * @returns {Array<string>} placeIds 取得した建物のplace_idリスト
 */
const fetchPlaceIds = async (searchText) => {
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
      console.log("nextPageToken--");
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
    console.log("fetch--");
    responseJson = await promiseFetch(`${TEXT_SEARCH_URL}?${searchParams}`);
    results = responseJson.results;
    for (let result of results) {
      placeIds.push(result.place_id);
    }
    nextPageToken = responseJson.next_page_token;
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
  return new Promise(async (resolve, reject) => {
    try {
      let response, responseJson;
      const obj = setInterval(async () => {
        response = await fetch(fetchUrl);
        responseJson = await response.json();
        if (responseJson.status === "INVALID_REQUEST") {
          console.log("Reponse status is INVALID_REQUEST yet.");
        }
        if (responseJson.status === "OK") {
          resolve(responseJson);
          clearInterval(obj);
        }
      }, 1000);
    } catch (e) {
      reject(e);
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
  // console.log(result);
  return result;
};

/**
 * メイン処理
 */
(async () => {
  const startTime = new Date();
  let searchTexts = [];
  var text = fs.readFileSync(SEARCH_TEXTS_FILE, "utf8");
  var lines = text.toString().split("\r\n");
  for (var line of lines) {
    searchTexts.push(line);
  }
  console.log(searchTexts);

  let placeInfo = [];
  for (let searchText of searchTexts) {
    let placeIds = await fetchPlaceIds(searchText);
    placeInfo.push({ searchText: searchText, placeIds: placeIds });
  }
  console.log(placeInfo);

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

        fetchedIds.push(id);

        let openingHours;
        if (detail.opening_hours !== undefined) {
          openingHours = detail.opening_hours.weekday_text;
        } else {
          openingHours = ["-", "-", "-", "-", "-", "-", "-"];
        }
        const rowDataArr = [
          info.searchText,
          id,
          detail.types,
          detail.name,
          detail.formatted_phone_number,
          detail.formatted_address,
          detail.business_status,
          detail.opening_hours,
          openingHours[0],
          openingHours[1],
          openingHours[2],
          openingHours[3],
          openingHours[4],
          openingHours[5],
          openingHours[6],
          detail.rating,
          detail.reviews,
          detail.user_ratings_total,
          detail.website,
          detail.url,
        ];
        const rowData = rowDataArr.join(`\t`);
        // const rowData = `${info.searchText}\t${id}\t${detail.types}\t${detail.name}\t${detail.formatted_phone_number}\t${detail.formatted_address}\t${detail.business_status}\t${detail.opening_hours}\t${openingHours[0]}\t${openingHours[1]}\t${openingHours[2]}\t${openingHours[3]}\t${openingHours[4]}\t${openingHours[5]}\t${openingHours[6]}\t${detail.rating}\t${detail.reviews}\t${detail.user_ratings_total}\t${detail.website}\t${detail.url}`;
        tsvData += rowData + "\n";
      }
    }
  }
  fs.writeFileSync(`${TSV_FILE_NAME}.tsv`, tsvData);
  const endTime = new Date();
  const excuteTime = (endTime - startTime) / 1000; /* ミリ秒 */
  console.log(`検索結果を[${TSV_FILE_NAME}.tsv]に出力しました。`);
  console.log(`実行時間 ---> ${excuteTime} 秒`);
})();
