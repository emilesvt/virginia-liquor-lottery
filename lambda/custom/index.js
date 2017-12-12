"use strict";
const Alexa = require("alexa-sdk");
const cheerio = require("cheerio");
const rp = require("request-promise");
const ImageUtils = require("alexa-sdk").utils.ImageUtils;
const TextUtils = require("alexa-sdk").utils.TextUtils;

const APP_ID = "amzn1.ask.skill.7720db98-f529-4d10-9a0c-f7617ba821ac";

exports.handler = function (event, context) {
    const alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

const handlers = {
    "LaunchRequest": function () {
        this.emit(":ask", "Welcome to Virginia Liquor Lottery! Try asking for open or upcoming lotteries.");
    },
    "OpenLottery": function () {
        console.log(`Received the following event for OpenLottery: ${JSON.stringify(this.event.request)}`);

        retrieveLotteries().then(lotteries => {
            const filtered = lotteries.filter(lottery => lottery.open);

            // check to ensure there was stocking data
            if (filtered.length === 0) {
                this.emit(":tell", `No open lotteries were found`);
                return;
            }

            this.response.speak(`There ${filtered.length > 1 ? "are" : "is"} ${filtered.length} open ${filtered.length > 1 ? "lotteries" : "lottery"}. ${aggregateLotteries(filtered)}.`);

            // if (this.event.context.System.device.supportedInterfaces.Display) {
            //     this.response.renderTemplate(createStockingMapTemplate(filtered));
            // }

            this.emit(":responseReady");
        }).catch(err => {
            console.error(err);
            this.emit("FetchError");
        });
    },
    "UpcomingLottery": function () {
        console.log(`Received the following event for UpcomingLottery: ${JSON.stringify(this.event.request)}`);

        retrieveLotteries().then(lotteries => {
            const filtered = lotteries.filter(lottery => !(lottery.open));

            // check to ensure there was stocking data
            if (filtered.length === 0) {
                this.emit(":tell", `No upcoming lotteries were found`);
                return;
            }

            this.response.speak(`There ${filtered.length > 1 ? "are" : "is"} ${filtered.length} upcoming ${filtered.length > 1 ? "lotteries" : "lottery"}. ${aggregateLotteries(filtered)}.`);

            // if (this.event.context.System.device.supportedInterfaces.Display) {
            //     this.response.renderTemplate(createStockingMapTemplate(filtered));
            // }

            this.emit(":responseReady");
        }).catch(err => {
            console.error(err);
            this.emit("FetchError");
        });
    },
    "EnterLottery": function () {
        console.log(`Received the following event for EnterLottery: ${JSON.stringify(this.event.request)}`);
        this.emit(":tell", `We don't support this feature <break time="500ms"/> <emphasis level="strong">yet</emphasis>`);
    },
    "FetchError": function () {
        this.emit(":tell", `There was a problem communicating with the Virginia Department of Alcoholic Beverage Control.`);
    },
    "SessionEndedRequest": function () {
        console.log("Session ended with reason: " + this.event.request.reason);
    },
    "AMAZON.StopIntent": function () {
        this.emit("AMAZON.CancelIntent");
    },
    "AMAZON.HelpIntent": function () {
        this.emit(":ask", "You can ask for open or upcoming lotteries.");
    },
    "AMAZON.CancelIntent": function () {
        this.emit(":tell", "Bye");
    },
    "Unhandled": function () {
        this.emit(":tell", "Sorry, I didn't get that");
    }
};

function retrieveLotteries() {
    return rp({
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
                    // image: new Promise((resolve, reject) => {
                    //     rp({
                    //         method: "GET",
                    //         uri: productUrl,
                    //         headers: {
                    //             "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36"
                    //         },
                    //         transform: (body) => {
                    //             return cheerio.load(body);
                    //         }
                    //     }).then($$ => {
                    //         const image = `https://www.abc.virginia.gov${$$(".img-responsive").attr("src")}`;
                    //         resolve(image.substring(0, image.indexOf("?")));
                    //     }).catch(e => {
                    //         reject(e);
                    //     });
                    // }),
                    quantity: details[1].trim(),
                    price: details[2].trim(),
                    open: details[0].indexOf("ENTER LOTTERY HERE") >= 0,
                    notification: $(elem).find("div span").text().trim()
                });
            }

        });

        console.log(`${distributions.length} entries found: ${JSON.stringify(distributions)}`);

        return distributions;
    });
}

function aggregateLotteries(lotteries) {
    return makeGoodListGrammar(lotteries.map(lottery => `${lottery.name}, which is ${lottery.quantity} for ${lottery.price}`));
}

function makeGoodListGrammar(descriptions) {
    if (descriptions.length === 1) {
        return descriptions[0];
    } else {
        return descriptions.map((description, index) => `${index === 0 ? "" : ", "}${index === descriptions.length - 1 ? "and " : ""}${description}`).join("");
    }
}

function createStockingMapTemplate(stockings) {
    const url = "https://maps.googleapis.com/maps/api/staticmap?&size=340x340&type=hybrid" + stockings.map((stocking, index) => `&markers=label:${index + 1}|${stocking.water},${stocking.county},VA`).join("");
    const builder = new Alexa.templateBuilders.BodyTemplate3Builder();
    const text = TextUtils.makeRichText(stockings.map((stocking, index) => `${index + 1}.&#160;&#160;${stocking.water.trim()}<br/>`).join(""));
    return builder.setBackButtonBehavior("HIDDEN").setTitle("Trout Stocking Map").setTextContent(text).setImage(ImageUtils.makeImage(url, undefined, undefined, undefined, "Trout Stocking Map with Markers for Locations"))
        .build();
}

function getSlotValue(slot) {
    if (slot.resolutions && slot.resolutions.resolutionsPerAuthority && slot.resolutions.resolutionsPerAuthority[0].status.code === "ER_SUCCESS_MATCH") {
        return slot.resolutions.resolutionsPerAuthority[0].values[0].value.name;
    }

    return slot.value;
}
