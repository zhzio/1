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
    sku: null,
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

  return `未知(${state})`;
}


function skuFromText(text) {
  if (!text) return null;

  const patterns = [
    /\/product\/(\d{8,})\.html/i,
    /item\.jd\.hk\/(\d{8,})\.html/i,
    /item\.jd\.com\/(\d{8,})\.html/i,
    /[?&]sku=(\d{8,})/i,
    /[?&]skuId=(\d{8,})/i,
    /[?&]wareId=(\d{8,})/i,
    /"skuId"\s*:\s*"?(\d{8,})"?/i,
    /"sku"\s*:\s*"?(\d{8,})"?/i,
    /"wareId"\s*:\s*"?(\d{8,})"?/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return match[1];
    }
  }

  return null;
}


async function resolveSku(product) {
  if (product.sku) {
    return product.sku;
  }

  const cache = caches.default;

  const cacheKey =
    new Request(
      `https://jd-kiseki-monitor.kairito0504.workers.dev/__sku/${product.id}`
    );

  const cached =
    await cache.match(cacheKey);

  if (cached) {
    const value =
      await cached.text();

    if (value) {
      return value;
    }
  }


  let current =
    product.buyUrl;

  for (let i = 0; i < 6; i++) {

    const urlSku =
      skuFromText(current);

    if (urlSku) {
      await cache.put(
        cacheKey,
        new Response(urlSku, {
          headers: {
            "Cache-Control":
              "max-age=86400"
          }
        })
      );

      return urlSku;
    }


    const response =
      await fetch(current, {
        redirect: "manual",

        headers: {
          "User-Agent": UA,
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });


    const location =
      response.headers.get(
        "location"
      );

    if (
      response.status >= 300 &&
      response.status < 400 &&
      location
    ) {
      current =
        new URL(
          location,
          current
        ).toString();

      continue;
    }


    const finalUrl =
      response.url || current;

    let sku =
      skuFromText(finalUrl);

    if (!sku) {
      const text =
        await response.text();

      sku =
        skuFromText(text);
    }

    if (sku) {
      await cache.put(
        cacheKey,
        new Response(sku, {
          headers: {
            "Cache-Control":
              "max-age=86400"
          }
        })
      );

      return sku;
    }

    break;
  }


  throw new Error(
    `${product.name}：无法从京东短链解析 SKU`
  );
}


async function getStock(product) {
  const sku =
    await resolveSku(product);

  const productUrl =
    `https://mitem.jd.hk/product/${sku}.html`;

  const response =
    await fetch(productUrl, {
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
      `${product.name} 京东商品页 HTTP ${response.status}`
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
      `${product.name}：没有找到 StockState`
    );
  }


  const state =
    Number(match[1]);

  return {
    sku,
    state,
    name: stockName(state),
    finalUrl: response.url
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
 * 每个版本独立记录状态。
 *
 * 只有：
 * 无货 -> 有货
 *
 * 才推送一次。
 */
async function shouldAlert(
  product,
  buyable
) {
  const cache =
    caches.default;

  const key =
    new Request(
      `https://jd-kiseki-monitor.kairito0504.workers.dev/__stock/${product.id}`
    );


  const old =
    await cache.match(key);

  let previous =
    null;

  if (old) {
    previous =
      (await old.text()) === "1";
  }


  await cache.put(
    key,
    new Response(
      buyable ? "1" : "0",
      {
        headers: {
          "Cache-Control":
            "max-age=604800"
        }
      }
    )
  );


  /*
   * 第一次运行：
   * 如果当前正好有货，也提醒一次。
   */
  if (previous === null) {
    return buyable;
  }


  return (
    buyable &&
    previous === false
  );
}


async function checkProduct(
  env,
  product
) {
  const stock =
    await getStock(product);


  const buyable =
    stock.state === 33 ||
    stock.state === 39 ||
    stock.state === 40 ||
    stock.state === 36;


  let notified =
    false;


  if (
    await shouldAlert(
      product,
      buyable
    )
  ) {
    await pushBark(
      env,

      product,

      `${product.name}补货！`,

      `${stock.name}｜赶紧去京东下单`
    );

    notified =
      true;
  }


  return {
    id:
      product.id,

    name:
      product.name,

    sku:
      stock.sku,

    stockState:
      stock.state,

    stockName:
      stock.name,

    buyable,

    notified,

    buyUrl:
      product.buyUrl
  };
}


async function checkAll(env) {
  const products =
    [];


  /*
   * 一个商品出错，不影响另一个继续监控。
   */
  for (const product of PRODUCTS) {

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
      Boolean(env.BARK_KEY),

    checkedAt:
      new Date()
        .toISOString(),

    products
  };
}


export default {

  async fetch(
    request,
    env
  ) {
    try {
      const url =
        new URL(request.url);


      /*
       * Bark 测试：
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
            item =>
              item.id === test
          );


        if (!product) {
          return new Response(
            JSON.stringify(
              {
                error:
                  "test 必须是 collector 或 standard"
              },
              null,
              2
            ),
            {
              status: 400,

              headers: {
                "content-type":
                  "application/json;charset=UTF-8"
              }
            }
          );
        }


        await pushBark(
          env,

          product,

          `${product.name}监控测试`,

          "Bark 通知和购买链接正常"
        );


        return new Response(
          JSON.stringify(
            {
              test: true,
              product:
                product.name,
              barkConfigured:
                true
            },
            null,
            2
          ),
          {
            headers: {
              "content-type":
                "application/json;charset=UTF-8"
            }
          }
        );
      }


      const result =
        await checkAll(env);


      return new Response(
        JSON.stringify(
          result,
          null,
          2
        ),
        {
          headers: {
            "content-type":
              "application/json;charset=UTF-8",

            "cache-control":
              "no-store"
          }
        }
      );


    } catch (error) {

      return new Response(
        JSON.stringify(
          {
            error:
              String(
                error?.message ||
                error
              )
          },
          null,
          2
        ),
        {
          status: 500,

          headers: {
            "content-type":
              "application/json;charset=UTF-8"
          }
        }
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
