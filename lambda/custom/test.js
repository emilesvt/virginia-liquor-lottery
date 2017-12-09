const cheerio = require("cheerio");
const rp = require("request-promise");

rp({
    method: "GET",
    uri: "https://www.abc.virginia.gov/products/limited-availability",
    headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36"
    },
    transform: (body) => {
        return cheerio.load(body);
    }
}).then($ => {
    const distributions = [];

    $(".content-body").find(".row").each((i, elem) => {
        const productAnchor = $(elem).find("div h3 a");
        const name = productAnchor.text();
        const productUrl = `https://www.abc.virginia.gov${productAnchor.attr("href")}`;
        const details = $(elem).find("div p").text().split("|");

        if (details[0].indexOf("LOTTERY IS CLOSED") === -1) {

            distributions.push({
                name: name,
                productUrl: productUrl,
                image: new Promise((resolve, reject) => {
                    rp({
                        method: "GET",
                        uri: productUrl,
                        headers: {
                            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36"
                        },
                        transform: (body) => {
                            return cheerio.load(body);
                        }
                    }).then($$ => {
                        const image = `https://www.abc.virginia.gov${$$(".img-responsive").attr("src")}`;
                        resolve(image.substring(0, image.indexOf("?")));
                    }).catch(e => {
                        reject(e);
                    });
                }),
                quantity: details[1].trim(),
                price: details[2].trim(),
                open: details[0].indexOf("ENTER LOTTERY HERE") >= 0,
                notification: $(elem).find("div span").text().trim()
            });
        }

    });

    console.log(JSON.stringify(distributions));
}).catch(e => {
    console.log(`Error: ${e}`);
});