const SKU = "100358795300";
const AREA = "2_2_2834_0";

export default {
  async fetch() {
    const url =
      `https://item-soa.jd.com/getWareBusiness` +
      `?skuId=${SKU}` +
      `&area=${AREA}` +
      `&num=1`;

    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
          "Referer": `https://item.jd.com/${SKU}.html`,
          "Accept": "application/json,text/plain,*/*"
        }
      });

      const text = await r.text();

      return new Response(
        JSON.stringify(
          {
            status: r.status,
            ok: r.ok,
            sample: text.slice(0, 2000)
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
    } catch (e) {
      return new Response(
        JSON.stringify({ error: String(e.message || e) }, null, 2),
        {
          status: 500,
          headers: {
            "content-type": "application/json;charset=UTF-8"
          }
        }
      );
    }
  }
};
