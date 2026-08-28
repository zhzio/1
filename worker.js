const AREA = "2_2_2834_0";

const PRODUCTS = [
  {
    id: "collector",
    name: "空轨2nd典藏版",
    sku: "100358795300",
    buyUrl: "https://3.jd.hk/102JD-m0"
  },
  {
    id: "standard",
    name: "空轨2nd普通版",
    sku: "100358740676",
    buyUrl: "https://3.jd.hk/-102LqS7"
  }
];

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";


function stockName(state) {
  if (state === 33) return "现货";
  if (state === 39) return "有货";
  if (state === 40) return "可配货";
  if (state === 36) return "预定";
  if (state === 34) return "无货";

  if (state === null || state === undefined) {
    return "未知";
  }

  return `未知(${state})`;
}


function isBuyableState(state) {
  return (
    state === 33 ||
    state === 39 ||
    state === 40 ||
    state === 36
  );
}


/*
 * 来源 1：
 * 京东国际移动商品页
 */
async function getMitemStock(product) {
  const url =
    `https://mitem.jd.hk/product/${product.sku}.html`;

  const response =
    await fetch(url, {
      redirect: "follow",

      headers: {
        "User-Agent": UA,

        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

        "Cookie":
          `wq_addr=0%7C${AREA}%7C%7C; ` +
          `jdAddrId=${AREA}; ` +
          `mitemAddrId=${AREA}; ` +
          `regionAddress=2%2C2%2C2834%2C0; ` +
          `commonAddress=0`
      }
    });

  if (!response.ok) {
    throw new Error(
      `mitem HTTP ${response.status}`
    );
  }

  const text =
    await response.text();

  const match =
    text.match(
      /"StockState"\s*:\s*(\d+)/
    );

  if (!match) {
    throw new Error(
      "mitem 没找到 StockState"
    );
  }

  const state =
    Number(match[1]);

  return {
    source: "mitem",
    state,
    name: stockName(state),
    buyable: isBuyableState(state),
    url: response.url
  };
}


/*
 * 支持：
 * JSON
 * JSONP
 */
function parseJsonOrJsonp(text) {
  const trimmed =
    String(text || "").trim();

  try {
    return JSON.parse(trimmed);
  } catch {}

  const start =
    trimmed.indexOf("(");

  const end =
    trimmed.lastIndexOf(")");

  if (
    start !== -1 &&
    end > start
  ) {
    return JSON.parse(
      trimmed.slice(
        start + 1,
        end
      )
    );
  }

  throw new Error(
    "无法解析 JSON/JSONP"
  );
}


/*
 * 来源 2：
 * 京东区域库存接口
 *
 * https://c0.3.cn/stocks
 */
async function getStockApi(product) {
  const url =
    "https://c0.3.cn/stocks" +
    `?type=getstocks` +
    `&skuIds=${encodeURIComponent(product.sku)}` +
    `&area=${encodeURIComponent(AREA)}` +
    `&_=${Date.now()}`;

  const response =
    await fetch(url, {
      headers: {
        "User-Agent": UA,

        "Referer":
          `https://item.jd.com/${product.sku}.html`,

        "Accept":
          "application/json,text/javascript,*/*;q=0.01",

        "Cache-Control":
          "no-cache"
      }
    });

  if (!response.ok) {
    throw new Error(
      `stock API HTTP ${response.status}`
    );
  }

  const text =
    await response.text();

  const data =
    parseJsonOrJsonp(text);

  const info =
    data?.[product.sku];

  if (!info) {
    throw new Error(
      "stock API 没有返回当前 SKU"
    );
  }

  const state =
    Number.isFinite(
      Number(info.StockState)
    )
      ? Number(info.StockState)
      : null;

  return {
    source: "stockApi",

    state,

    name:
      info.StockStateName ||
      stockName(state),

    skuState:
      info.skuState ?? null,

    isPurchase:
      info.IsPurchase ?? null,

    buyable:
      isBuyableState(state),

    raw: {
      StockState:
        info.StockState ?? null,

      StockStateName:
        info.StockStateName ?? null,

      skuState:
        info.skuState ?? null,

      IsPurchase:
        info.IsPurchase ?? null,

      ArrivalDate:
        info.ArrivalDate ?? null
    }
  };
}


/*
 * 只要任意一个库存源判断有货，
 * 就认为可购买。
 *
 * 一个源挂了，不影响另一个源。
 */
async function getAllStocks(product) {
  const [
    mitemResult,
    apiResult
  ] =
    await Promise.allSettled([
      getMitemStock(product),
      getStockApi(product)
    ]);


  const mitem =
    mitemResult.status ===
    "fulfilled"
      ? mitemResult.value
      : {
          source: "mitem",
          error:
            String(
              mitemResult.reason?.message ||
              mitemResult.reason
            )
        };


  const stockApi =
    apiResult.status ===
    "fulfilled"
      ? apiResult.value
      : {
          source: "stockApi",
          error:
            String(
              apiResult.reason?.message ||
              apiResult.reason
            )
        };


  const buyable =
    Boolean(mitem.buyable) ||
    Boolean(stockApi.buyable);


  const activeSources =
    [];

  if (mitem.buyable) {
    activeSources.push("mitem");
  }

  if (stockApi.buyable) {
    activeSources.push("stockApi");
  }


  return {
    mitem,
    stockApi,
    buyable,
    activeSources
  };
}


async function pushBark(
  env,
  product,
  title,
  body
) {
  if (!env.BARK_KEY) {
    throw new Error(
      "未设置运行时 BARK_KEY"
    );
  }

  const url =
    `https://api.day.app/${env.BARK_KEY}/` +
    `${encodeURIComponent(title)}/` +
    `${encodeURIComponent(body)}` +
    `?url=${encodeURIComponent(product.buyUrl)}` +
    `&group=jd-kiseki-monitor` +
    `&level=critical` +
    `&volume=10`;

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Bark HTTP ${response.status}`
    );
  }
}


/*
 * 这里不再依赖“无货 -> 有货”
 * 状态机。
 *
 * 原则：
 * 检测到有货就提醒。
 *
 * 成功提醒后进入短暂冷却，
 * 防止一分钟一次疯狂推送。
 *
 * 如果 Bark 失败：
 * 不写冷却状态，
 * 下一分钟继续尝试。
 */
function alertCacheKey(product) {
  return new Request(
    "https://jd-kiseki-monitor.kairito0504.workers.dev/" +
    `__alert/${product.id}`
  );
}


async function isAlertCoolingDown(product) {
  const old =
    await caches.default.match(
      alertCacheKey(product)
    );

  return Boolean(old);
}


async function markAlerted(product) {
  await caches.default.put(
    alertCacheKey(product),

    new Response("1", {
      headers: {
        /*
         * 5 分钟防重复通知
         */
        "Cache-Control":
          "max-age=300"
      }
    })
  );
}


async function clearAlertCooldown(product) {
  await caches.default.delete(
    alertCacheKey(product)
  );
}


async function checkProduct(
  env,
  product
) {
  const stock =
    await getAllStocks(product);

  let notified =
    false;

  let barkError =
    null;


  if (stock.buyable) {

    const coolingDown =
      await isAlertCoolingDown(
        product
      );


    if (!coolingDown) {

      const descriptions =
        [];

      if (stock.mitem.buyable) {
        descriptions.push(
          `mitem:${stock.mitem.name}`
        );
      }

      if (stock.stockApi.buyable) {
        descriptions.push(
          `stockApi:${stock.stockApi.name}`
        );
      }


      try {

        /*
         * 先成功 Bark，
         * 再写冷却。
         *
         * Bark 如果失败，
         * 下一分钟仍会继续提醒。
         */
        await pushBark(
          env,

          product,

          `🔥 ${product.name}有货！`,

          `${descriptions.join(" ｜ ")}` +
          `\n立即打开京东下单`
        );


        await markAlerted(
          product
        );


        notified =
          true;

      } catch (error) {

        barkError =
          String(
            error?.message ||
            error
          );

      }
    }

  } else {

    /*
     * 重新无货之后，
     * 清掉冷却。
     *
     * 下一次短暂补货
     * 可以立即报警。
     */
    await clearAlertCooldown(
      product
    );
  }


  return {
    id:
      product.id,

    name:
      product.name,

    sku:
      product.sku,

    buyable:
      stock.buyable,

    notified,

    activeSources:
      stock.activeSources,

    sources: {
      mitem:
        stock.mitem,

      stockApi:
        stock.stockApi
    },

    barkError,

    buyUrl:
      product.buyUrl
  };
}


async function checkAll(env) {
  const products =
    [];

  for (
    const product
    of PRODUCTS
  ) {

    try {

      products.push(
        await checkProduct(
          env,
          product
        )
      );

    } catch (error) {

      products.push({
        id:
          product.id,

        name:
          product.name,

        sku:
          product.sku,

        buyUrl:
          product.buyUrl,

        error:
          String(
            error?.message ||
            error
          )
      });

    }
  }


  return {
    ok: true,

    area:
      AREA,

    barkConfigured:
      Boolean(
        env.BARK_KEY
      ),

    checkedAt:
      new Date()
        .toISOString(),

    products
  };
}


function json(
  value,
  status = 200
) {
  return new Response(
    JSON.stringify(
      value,
      null,
      2
    ),
    {
      status,

      headers: {
        "content-type":
          "application/json;charset=UTF-8",

        "cache-control":
          "no-store"
      }
    }
  );
}


export default {

  async fetch(
    request,
    env
  ) {
    try {

      const url =
        new URL(
          request.url
        );


      /*
       * Bark 手工测试
       *
       * ?test=collector
       * ?test=standard
       */
      const test =
        url.searchParams.get(
          "test"
        );


      if (test) {

        const product =
          PRODUCTS.find(
            x =>
              x.id === test
          );


        if (!product) {

          return json(
            {
              error:
                "test 必须为 collector 或 standard"
            },
            400
          );

        }


        await pushBark(
          env,

          product,

          `${product.name}监控测试`,

          "Bark 通知正常"
        );


        return json({
          ok: true,
          test,
          product:
            product.name
        });
      }


      return json(
        await checkAll(
          env
        )
      );


    } catch (error) {

      return json(
        {
          ok: false,

          error:
            String(
              error?.message ||
              error
            )
        },
        500
      );
    }
  },


  async scheduled(
    event,
    env,
    ctx
  ) {

    ctx.waitUntil(
      checkAll(env)
        .catch(
          error =>
            console.error(
              error
            )
        )
    );
  }
};
