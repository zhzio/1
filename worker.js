// trigger deploy 2
const SKU = "100358795300";
const AREA = "2_2_2834_0";
const PRODUCT = "https://3.jd.hk/102JD-m0";

async function getStock() {
  const url =
    `https://c0.3.cn/stocks?type=getstocks&skuIds=${SKU}&area=${AREA}&_=${Date.now()}`;

  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json,text/plain,*/*"
    }
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`京东接口 HTTP ${r.status}`);

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const m = text.match(/^[^(]*\((.*)\)\s*;?\s*$/s);
    if (!m) throw new Error("京东库存数据解析失败");
    data = JSON.parse(m[1]);
  }

  const s = data?.[SKU];
  if (!s) throw new Error("未获取到 SKU 库存");

  return {
    state: Number(s.StockState ?? -1),
    name: s.StockStateName ?? "未知"
  };
}

async function getPrice() {
  try {
    const r = await fetch(
      `https://p.3.cn/prices/mgets?skuIds=J_${SKU}&_=${Date.now()}`
    );
    const d = await r.json();
    return d?.[0]?.p || null;
  } catch {
    return null;
  }
}

async function push(env, stock, price) {
  if (!env.BARK_KEY) throw new Error("未设置 BARK_KEY");

  const title = "空轨2nd典藏版补货！";
  const body = `${stock.name}｜${price ? "¥" + price : "价格未知"}`;

  const url =
    `https://api.day.app/${env.BARK_KEY}/` +
    `${encodeURIComponent(title)}/` +
    `${encodeURIComponent(body)}` +
    `?url=${encodeURIComponent(PRODUCT)}` +
    `&level=critical&volume=10`;

  await fetch(url);
}

async function check(env) {
  const stock = await getStock();
  const price = await getPrice();

  const buyable = stock.state === 33 || stock.state === 40;

  if (buyable) {
    await push(env, stock, price);
  }

  return {
    sku: SKU,
    area: AREA,
    buyable,
    price,
    stock
  };
}

export default {
  async fetch(request, env) {
    try {
      const result = await check(env);

      return new Response(JSON.stringify(result, null, 2), {
        headers: { "content-type": "application/json;charset=UTF-8" }
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: String(e.message || e) }, null, 2),
        {
          status: 500,
          headers: { "content-type": "application/json;charset=UTF-8" }
        }
      );
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(check(env));
  }
};
