const SKU = "100358795300";
const AREA = "2_2_2834_0";

export default {
  async fetch() {
    const body = JSON.stringify({
      skuId: SKU,
      areaId: AREA
    });

    const params = new URLSearchParams({
      appid: "item-view",
      functionId: "getWareBusiness",
      client: "m",
      clientVersion: "12.0.0",
      skuId: SKU,
      body
    });

    const url = `https://api.m.jd.com/api?${params}`;

    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
          "Referer": "https://item.m.jd.com/",
          "Accept": "application/json,text/plain,*/*"
        }
      });

      const text = await r.text();

      return new Response(
        JSON.stringify({
          status: r.status,
          ok: r.ok,
          sample: text.slice(0, 3000)
        }, null, 2),
        {
          headers: {
            "content-type": "application/json;charset=UTF-8"
          }
        }
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ error: String(e.message || e) }, null, 2),
        { status: 500 }
      );
    }
  }
};
