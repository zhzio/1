const URL = "https://3.jd.hk/102JD-m0";

export default {
  async fetch() {
    try {
      const r = await fetch(URL, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });

      const text = await r.text();

      return new Response(
        JSON.stringify(
          {
            status: r.status,
            ok: r.ok,
            finalUrl: r.url,
            length: text.length,
            hasNoStock:
              text.includes("无货") ||
              text.includes("無貨") ||
              text.includes("暂时无货"),
            hasCart:
              text.includes("加入购物车") ||
              text.includes("加入購物車"),
            hasBuy:
              text.includes("立即购买") ||
              text.includes("立即購買"),
            sample: text.slice(0, 5000)
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
