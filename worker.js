const SKU = "100358795300";
const AREA = "2_2_2834_0";

export default {
  async fetch() {
    const url =
      "https://api.m.jd.com/client.action" +
      "?functionId=wareBusiness" +
      "&client=android" +
      "&clientVersion=12.0.7";

    const body = new URLSearchParams({
      body: JSON.stringify({
        skuId: SKU,
        area: AREA
      })
    });

    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "User-Agent": "okhttp/3.12.16;jdmall;android;version/12.0.7;",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        body
      });

      const text = await r.text();

      return new Response(
        JSON.stringify(
          {
            status: r.status,
            ok: r.ok,
            sample: text.slice(0, 3000)
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
        { status: 500 }
      );
    }
  }
};
