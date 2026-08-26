const SKU = "100358795300";
const AREA = "2_2_2834_0";

// 抓取用：直接商品页
const PRODUCT = `https://mitem.jd.hk/product/${SKU}.html`;

// Bark 通知点击后打开的购买页面
const BUY_URL = "https://3.jd.hk/102JD-m0";

function stockName(state) {
  if (state === 33) return "现货";
  if (state === 39) return "有货";
  if (state === 40) return "可配货";
  if (state === 36) return "预定";
  if (state === 34) return "无货";
  return `未知(${state})`;
}

async function getStock() {
  const r = await fetch(PRODUCT, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

      // 上海 → 上海 → 松江
      "Cookie":
        `wq_addr=0%7C${AREA}%7C%7C; ` +
        `jdAddrId=${AREA}; ` +
        `mitemAddrId=${AREA}; ` +
        `regionAddress=2%2C2%2C2834%2C0; ` +
        `commonAddress=0`
    }
  });

  if (!r.ok) {
    throw new Error(`京东商品页 HTTP ${r.status}`);
  }

  const text = await r.text();

  // 页面实际库存 JSON：
  // "StockState":34
  const match = text.match(/"StockState"\s*:\s*(\d+)/);

  if (!match) {
    throw new Error("没有找到 StockState");
  }

  const state = Number(match[1]);

  return {
    state,
    name: stockName(state),
    finalUrl: r.url
  };
}

async function pushBark(env, title, body) {
  if (!env.BARK_KEY) {
    throw new Error("未设置运行时 BARK_KEY");
  }

  const url =
    `https://api.day.app/${env.BARK_KEY}/` +
    `${encodeURIComponent(title)}/` +
    `${encodeURIComponent(body)}` +
    `?url=${encodeURIComponent(BUY_URL)}` +
    `&group=jd-kiseki-monitor` +
    `&level=critical` +
    `&volume=10`;

  const r = await fetch(url);

  if (!r.ok) {
    throw new Error(`Bark HTTP ${r.status}`);
  }
}

// 防止有货后每分钟疯狂通知
async function allowAlert() {
  const cache = caches.default;

  const key = new Request(
    "https://jd-kiseki-monitor.kairito0504.workers.dev/__alert_cooldown"
  );

  const old = await cache.match(key);

  if (old) return false;

  await cache.put(
    key,
    new Response("1", {
      headers: {
        "Cache-Control": "max-age=600"
      }
    })
  );

  return true;
}

async function check(env) {
  const stock = await getStock();

  // 现货 / 在途有货 / 可配货 / 重新开放预定
  const buyable =
    stock.state === 33 ||
    stock.state === 39 ||
    stock.state === 40 ||
    stock.state === 36;

  let notified = false;

  if (buyable && (await allowAlert())) {
    await pushBark(
      env,
      "空轨2nd典藏版补货！",
      `${stock.name}｜赶紧去京东下单`
    );

    notified = true;
  }

  return {
    sku: SKU,
    area: AREA,
    stockState: stock.state,
    stockName: stock.name,
    buyable,
    notified,
    barkConfigured: Boolean(env.BARK_KEY),
    checkedAt: new Date().toISOString()
  };
}

export default {
  async fetch(request, env) {
    try {
      const u = new URL(request.url);

      // 手动测试 Bark：
      // workers.dev/?test=1
      if (u.searchParams.get("test") === "1") {
        await pushBark(
          env,
          "空轨2nd监控测试",
          "Bark 通知已经配置成功"
        );

        return new Response(
          JSON.stringify(
            {
              test: true,
              barkConfigured: true
            },
            null,
            2
          ),
          {
            headers: {
              "content-type": "application/json;charset=UTF-8"
            }
          }
        );
      }

      const result = await check(env);

      return new Response(JSON.stringify(result, null, 2), {
        headers: {
          "content-type": "application/json;charset=UTF-8"
        }
      });
    } catch (e) {
      return new Response(
        JSON.stringify(
          {
            error: String(e.message || e)
          },
          null,
          2
        ),
        {
          status: 500,
          headers: {
            "content-type": "application/json;charset=UTF-8"
          }
        }
      );
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(check(env));
  }
};
