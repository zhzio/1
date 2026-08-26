const URL = "https://3.jd.hk/102JD-m0";

function contexts(text, keyword, max = 3) {
  const out = [];
  let start = 0;

  while (out.length < max) {
    const i = text.indexOf(keyword, start);
    if (i === -1) break;

    out.push(
      text.slice(Math.max(0, i - 300), Math.min(text.length, i + 500))
    );

    start = i + keyword.length;
  }

  return out;
}

export default {
  async fetch() {
    const r = await fetch(URL, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
      }
    });

    const text = await r.text();

    const keys = [
      "stockInfo",
      "isStock",
      "StockState",
      "skuState",
      "wareBusiness",
      "functionId",
      "无货",
      "有货"
    ];

    const result = {};

    for (const key of keys) {
      result[key] = {
        count: text.split(key).length - 1,
        samples: contexts(text, key)
      };
    }

    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        "content-type": "application/json;charset=UTF-8"
      }
    });
  }
};
