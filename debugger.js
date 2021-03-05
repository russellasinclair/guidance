"use strict";

class somethingWithGet {
    get(var1) {
        return var1;
    }

    set(var1) {
        return var1;
    }
}

var findObjs = findObjs || function (text, text2, text3, text4, text5) {
    return new somethingWithGet();
};


var randomInteger = randomInteger || function (text, text2, text3, text4, text5) {
    return 15;
};

var createObj = createObj || function (text, text2, text3, text4, text5) {
    console.log(text);
    return new somethingWithGet();
};

var log = log || function (text) {
    console.log(text);
};

var on = on || function (text, text2, text3, text4, text5) {
    return "";
};

var playerIsGM = playerIsGM || function (text) {
    return true;
};

var Campaign = Campaign || (function () {
    function get(text, text2, text3, text4, text5) {
        return new Array();
    };
});

var sendChat = sendChat || function (text, text2, text3, text4, text5) {
    console.log(text);
};
