const SKU = "100358795300";
const AREA = "2_2_2834_0";

const TESTS = [
  `https://c0.3.cn/stocks?type=getstocks&skuIds=${SKU}&area=${AREA}`,
  `https://c0.3.cn/stock?skuId=${SKU}&area=${AREA}`,
  `https://p.3.cn/prices/mgets?skuIds=J_${SKU}`,
  `https://pm.3.cn/prices/mgets?origin=2&skuIds=${SKU}`,
  `https://api.m.jd.com/`
];

async function testUrl(url) {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*"
      }
    });

    const text = await r.text();

    return {
      url,
      ok: r.ok,
      status: r.status,
      sample: text.slice(0, 300)
    };
  } catch (e) {
    return {
      url,
      ok: false,
      error: String(e.message || e)
    };
  }
}

export default {
  async fetch() {
    const results = [];

    for (const url of TESTS) {
      results.push(await testUrl(url));
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: {
        "content-type": "application/json;charset=UTF-8"
      }
    });
  }
};
