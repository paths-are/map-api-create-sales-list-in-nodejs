# 営業リスト作成スクリプト

Google Maps Platform の Places API を使って、営業リストを作成できます。
Google Map で店舗を検索して、リストを作成して、、、みたいなことをされている方におすすめです。

You can create sales list using Google Maps Platform - Places API.

## 事前準備 - Prerequists

[Places API](https://console.cloud.google.com/apis/library/places-backend.googleapis.com)を有効化します。

- Google Cloud Platform（GCP）のアカウントがない方は作りましょう。
- 請求情報が紐づいているアカウントでないと利用できないので、請求情報（クレジットカード情報とか）を登録しましょう。
  - 毎月 20,000 円分は無料で使えます。
  - もし、20,000 円分以上を使ったとしても予算を設定しておけば、
    自分が設定した金額以上を支払うことはありません。(例：500 円までしか課金できないように設定するなど。)

その後、[認証情報](https://console.cloud.google.com/apis/credentials)にアクセスし、「+認証情報を作成」> 「API キー」を実行  
発行された 「API キー」をメモしておきます。

<!-- Enable [Places API](https://console.cloud.google.com/apis/library/places-backend.googleapis.com) -->

## インストール - Installation

次のコマンドを実行します。

```shell
git clone https://github.com/paths-are/map-api-create-sales-list-in-nodejs.git
cd map-api-create-sales-list-in-nodejs
npm install
```

次のコマンドを実行します。

```shell
cp .env.sample
```

作成された `.env` にメモしておいた API キーを貼り付けます。

次のコマンドを実行します。

```shell
cp search-areas_sample.txt search-areas.txt
cp search-keywords_sample.txt search-keywords.txt
cp search-filters_sample.txt search-filters.txt
```

search-areas.txt には検索したい**場所**を記載します。
search-keywords.txt には検索したい**キーワード**を記載します。
search-filters.txt には検索時の**フィルター**を設定します。

サンプルファイルをそのまま実行すると
浅草 カレー
浅草 ハンバーグ
で検索された場所のうち、住所に'台東区'が記載されているデータのみ抽出します。

<!-- ```shell
touch searchTexts.txt
``` -->

<!-- 下記の内容を「searchTexts.txt」に貼り付けます。
東京と大阪と名古屋でカレー屋さんを検索する場合の例です。

```
東京　カレー
大阪　カレー
名古屋　カレー
``` -->

## 使い方 - How to Use

次のコマンドを実行します。

```
node .
```

正常に実行されると、
検索結果は
`search-result.tsv`
に出力されます。

ログは
`app.log`
に出力されます。
