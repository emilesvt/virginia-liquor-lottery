"use strict";
const Alexa = require("alexa-sdk");
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
        uri: "https://abhi2xr3kb.execute-api.us-east-1.amazonaws.com/prod/lottery",
        json: true
    }).then(distributions => {
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

function getSlotValue(slot) {
    if (slot.resolutions && slot.resolutions.resolutionsPerAuthority && slot.resolutions.resolutionsPerAuthority[0].status.code === "ER_SUCCESS_MATCH") {
        return slot.resolutions.resolutionsPerAuthority[0].values[0].value.name;
    }

    return slot.value;
}
