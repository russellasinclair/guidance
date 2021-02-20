/*
Starfinder utilities for Roll20
Requires API, Starfinder (Simple) character sheets - official sheets not supported at this time.
!sf_populate - will parse a stat-block in the GM Notes of a character, and populate the NPC tab of the character sheet with the values
*/
var Guidance = Guidance || (function () {
    "use strict";

    let version = "-=> Guidance is online. v1.Dogfood <=-";
    let debugMode = true;

    /// Class that represents a NPC/Starship that is being worked on.
    class NPC {
        constructor(characterId, token, characterSheet) {
            this.characterId = characterId;
            this.npcToken = token;
            this.characterSheet = characterSheet;
        }

        showContents() {
            debugLog("Character ID = " + this.characterId);
            debugLog("npcToken = " + this.npcToken);
        }
    }

    class TemplateRow {
        constructor(sortOrder, sheetAttrib, attribute, value) {
            this.val = value;
            this.order = sortOrder;
            this.sheetAttribute = sheetAttrib;
            this.attribute = attribute;
        }
    }

    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////
    //<editor-fold desc="GENERIC HELPER ROUTINES">
    // Borrowed from https://app.roll20.net/users/104025/the-aaron
    let generateUUID = (function () {
            let a = 0, b = [];
            return function () {
                let c = (new Date()).getTime(), d = c === a;
                a = c;
                for (var e = new Array(8), f = 7; 0 <= f; f--) {
                    e[f] = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c % 64);
                    c = Math.floor(c / 64);
                }
                c = e.join("");
                if (d) {
                    for (var f = 11; 0 <= f && 63 === b[f]; f--) {
                        b[f] = 0;
                    }
                    b[f]++;
                } else {
                    for (var f = 0; 12 > f; f++) {
                        b[f] = Math.floor(64 * Math.random());
                    }
                }
                for (var f = 0; 12 > f; f++) {
                    c += "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);
                }

                return c;
            };
        }()),
        generateRowID = function () {
            return generateUUID().replace(/_/g, "Z");
        };

    let debugLog = function (text) {
        if (debugMode) {
            log(text);
        }
    };

    let speakAsGuidanceToGM = function (text) {
        text = "/w gm  &{template:pf_spell} {{name=Guidance}} {{spell_description=" + text + "}}";
        sendChat("Guidance", text);
    };

    // This is used until I get a better handle on undefined vs null vs whatever....
    let isFalsy = function (v) {
        var err = new Error();
        if (v === undefined) {
            debugLog("undefined");
            debugLog(err.stack);
            return true;
        }
        if (v === null) {
            debugLog("null");
            debugLog(err.stack);
            return true;
        }
        return false;
    };
    //</editor-fold>

    //<editor-fold desc="Generic Parsing Routines">
    let getStringValue = function (textToFind, textToParse, delimiter) {
        if (textToParse.indexOf(textToFind) < 0) {
            return "";
        }
        let start = textToParse.indexOf(textToFind) + textToFind.length;
        if (start < 0) {
            return "";
        }

        if (isFalsy(delimiter)) {
            delimiter = " ";
        }

        let bucket = textToParse.substring(start);
        if (delimiter !== ";") {
            // It appears that ; ALWAYS means end of field. This is a good safety
            if (bucket.indexOf(";") > 2) {
                bucket = bucket.substring(0, bucket.indexOf(";"));
            }
        }

        bucket = bucket.trim();
        let end = bucket.toLowerCase().indexOf(delimiter.toLowerCase());
        if (end > 1) {
            bucket = bucket.substring(0, end);
        }
        return bucket;
    };

    let getValue = function (textToFind, textToParse, delimiter) {
        let bucket = getStringValue(textToFind, textToParse, delimiter);
        if (isFalsy(bucket)) {
            return "";
        }
        let b2 = bucket.split(" ");
        bucket = b2[0];
        return bucket.replace(";", "").replace(",", " ").trim(); // replace("+", "")
    };

    let getSkillValue = function (skillName, attribute, textToParse) {
        if (parseFloat(getValue(skillName, textToParse).trim()) > 2) {
            debugLog(skillName + " : " + getValue(skillName, textToParse) + " - " + attribute + " : " + getValue(attribute, textToParse));
            return parseFloat(getValue(skillName, textToParse).trim()) - parseFloat(getValue(attribute, textToParse).trim());
        }
        return 0;
    };

    let cleanText = function (textToClean) {
        return textToClean.replace(/(<([^>]+)>)/gi, " "
        ).replace(/&nbsp;/gi, " "
        ).replace(/&amp;/gi, "&"
        ).replace(/&amp/gi, "&"
        ).replace(/\s+/g, " "
        ).replace(/Offense/i, " OFFENSE "
        ).replace(/Defense/i, " DEFENSE "
        ).replace(/Statistics/i, " STATISTICS "
        ).replace(/Ecology/i, "ECOLOGY "
        ).replace(/Special Abilities/i, " SPECIAL ABILITIES "
        ).replace(/Tactics/i, " TACTICS "
        ).replace(/ Str /i, " Str "
        ).replace(/ Dex /i, " Dex "
        ).replace(/ Con /i, " Con "
        ).replace(/ Int /i, " Int "
        ).replace(/ Wis /i, " Wis "
        ).replace(/ Cha /i, " Cha "
        );
    };

    let attributeToInteger = function (characterId, attrib) {
        let value = getAttribute(characterId, attrib);
        if (isFalsy(value)) {
            return 0;
        } else {
            return parseFloat(value.get("current"));
        }
    };

    // new parsing logic
    let getSheetValue = function (statBlockTemplate, statToFind, statBlockText, delimiter) {
        if (!statBlockText.includes(statToFind)) {
            return undefined;
        }
        debugLog(statBlockText);
        debugLog("Looking for " + statToFind);
        statBlockText = statBlockText.substring(statBlockText.indexOf(statToFind));
        debugLog(statBlockText);
        statBlockTemplate = statBlockTemplate.filter(element => element.attribute !== undefined);

        let nextToken = statBlockTemplate.findIndex(element => element.attribute === statToFind);

        try {
            do {
                nextToken++;
            } while (!statBlockText.includes(statBlockTemplate[nextToken].attribute));
        } catch (e) {
            // token wasn't found, exception was thrown.
            return statBlockText;
        }

        statBlockText = statBlockText.substring(0, statBlockText.indexOf(statBlockTemplate[nextToken].attribute));
        debugLog(statBlockText);
        if (statBlockText.includes(";")) {
            statBlockText = statBlockText.substring(0, statBlockText.indexOf(";"));
            debugLog(statBlockText);
        }

        if (delimiter !== undefined && statBlockText.includes(delimiter)) {
            statBlockText = statBlockText.substring(0, statBlockText.indexOf(delimiter));
        }
        debugLog(statBlockText);

        return statBlockText;
    };

    let parseStatBlock = function (statBlockTemplate, statBlockText) {
        debugLog(statBlockTemplate.length);
        let statBlockData = [];
        for (let i = 0; i < statBlockTemplate.length; i++) {
            if (!isFalsy(statBlockTemplate[i].attribute)) {
                let val = getSheetValue(statBlockTemplate, statBlockTemplate[i].attribute, statBlockText);
                statBlockData.push(new TemplateRow(i, statBlockTemplate[i].sheetAttribute, statBlockTemplate[i].attribute, val));
                debugLog(statBlockTemplate[i].attribute + " = " + val);
            }
        }
        return statBlockData;
    };
    //</editor-fold>

    //<editor-fold desc="Data Transformation Routines">
    let getShipFrame = function (basics) {
        //starship-frame
        basics = basics.toLowerCase();
        if (basics.includes("racer")) {
            return 1;
        } else if (basics.includes("interceptor")) {
            return 2;
        } else if (basics.includes("fighter")) {
            return 3;
        } else if (basics.includes("shuttle")) {
            return 4;
        } else if (basics.includes("light freighter")) {
            return 5;
        } else if (basics.includes("explorer")) {
            return 6;
        } else if (basics.includes("transport")) {
            return 7;
        } else if (basics.includes("destroyer")) {
            return 8;
        } else if (basics.includes("heavy freighter")) {
            return 9;
        } else if (basics.includes("bulk freighter")) {
            return 10;
        } else if (basics.includes("cruiser")) {
            return 11;
        } else if (basics.includes("carrier")) {
            return 13;
        } else if (basics.includes("battleship")) {
            return 14;
        }

        return 15;
    };

    let getShipBasics = function (text) {
        let start = 0;
        if (text.includes("Tiny")) {
            start = text.indexOf("Tiny");
        } else if (text.includes("Small")) {
            start = text.indexOf("Small");
        } else if (text.includes("Medium")) {
            start = text.indexOf("Medium");
        } else if (text.includes("Large")) {
            start = text.indexOf("Large");
        } else if (text.includes("Huge")) {
            start = text.indexOf("Huge");
        } else if (text.includes("Gargantuan")) {
            start = text.indexOf("Gargantuan");
        } else if (text.includes("Colossal")) {
            start = text.indexOf("Colossal");
        }
        return {name: text.substring(0, start), type: text.substring(start, text.indexOf("Speed"))};
    };

    let shipTemplateRowConvert = function (templateRow) {
        templateRow.val = templateRow.val.replace("—", "");
        if (templateRow.attribute.startsWith("AC") || templateRow.attribute.startsWith("TL")) {
            templateRow.val = parseFloat(templateRow.val) - 10;
        } else if (templateRow.attribute.startsWith("Maneuverability")) {
            debugLog("Setting Maneuver");
            if (templateRow.val.includes("poor")) {
                templateRow.val = parseFloat(-2);
            } else if (templateRow.val.includes("clumsy")) {
                templateRow.val = parseFloat(-1);
            } else if (templateRow.val.includes("average")) {
                templateRow.val = parseFloat(0);
            } else if (templateRow.val.includes("good")) {
                templateRow.val = parseFloat(1);
            } else {
                templateRow.val = parseFloat(2);
            }
            debugLog("Maneuvered");
        } else if (templateRow.sheetAttribute.includes("shield")) {
            templateRow.val = parseFloat(templateRow.val.replace(/\D/g, ""));
        }
        return templateRow;
    };

    let abbreviateArc = function (arc) {
        if (arc.includes("orward")) {
            return "fwd";
        }
        if (arc.includes("arboard")) {
            return "stbd";
        }
        return arc.substring(arc.indexOf("(") + 1).substring(0, arc.indexOf(")") - 1).toLowerCase();
    };
    //</editor-fold>


    /////////////////////////////////////////////////////////////////
    // Roll 20 object Interactions
    /////////////////////////////////////////////////////////////////
    let getSelectedNPCs = function (selected) {
        let npcs = [];
        for (const t of selected) {
            debugLog(t);
            let token = findObjs(t)[0];
            let cid = token.get("represents");
            npcs.push(new NPC(cid, token, findObjs({_id: cid, _type: "character"})[0]));
        }

        return npcs;
    };

    let getAttribute = function (characterId, attributeName) {
        return findObjs({
            _characterid: characterId,
            _type: "attribute",
            name: attributeName
        })[0];
    };

    // borrowed from https://app.roll20.net/users/901082/invincible-spleen in the forums
    let setAttribute = function (characterId, attributeName, newValue, operator) {
        let mod_newValue = {
                "+": function (num) {
                    return num;
                },
                "-": function (num) {
                    return -num;
                }
            },

            foundAttribute = getAttribute(characterId, attributeName);

        isFalsy(attributeName);
        isFalsy(newValue);

        try {
            if (!foundAttribute) {
                if (typeof operator !== "undefined" && !isNaN(newValue)) {
                    debugLog(newValue + " is a number.");
                    newValue = mod_newValue[operator](newValue);
                }

                // We don't need to create "Blank Values"
                if (!attributeName.includes("show")) {
                    if (isFalsy(newValue) || newValue === "" || newValue === 0) {
                        return;
                    }
                }

                debugLog("DefaultAttributes: Initializing " + attributeName + " on character ID " + characterId + " with a value of " + newValue + ".");
                createObj("attribute", {
                    name: attributeName,
                    current: newValue,
                    max: newValue,
                    _characterid: characterId
                });
            } else {
                if (typeof operator !== "undefined" && !isNaN(newValue) && !isNaN(foundAttribute.get("current"))) {
                    newValue = parseFloat(foundAttribute.get("current")) + parseFloat(mod_newValue[operator](newValue));
                }
                debugLog("DefaultAttributes: Setting " + attributeName + " on character ID " + characterId + " to a value of " + newValue + ".");
                foundAttribute.set("current", newValue);
                foundAttribute.set("max", newValue);
            }
        } catch (err) {
            debugLog("Error parsing " + attributeName);
        }
    };

    let setUpToken = function (characterId, npcToken) {
        try {
            let hitPoints = getAttribute(characterId, "HP-npc");
            npcToken.set("bar1_link", hitPoints.id);
            let armorClass = getAttribute(characterId, "EAC-npc");
            npcToken.set("bar2_value", "EAC " + armorClass.get("current"));
            npcToken.set("bar2_max", armorClass.get("current"));
            armorClass = getAttribute(characterId, "KAC-npc");
            npcToken.set("bar3_value", "KAC " + armorClass.get("current"));
            npcToken.set("bar3_max", armorClass.get("current"));
            npcToken.set("showname", true);
            speakAsGuidanceToGM("Token setup. For extra settings, check out the API TokenMod");
        } catch (e) {
            speakAsGuidanceToGM("Check to make sure the token is linked and the character sheet is populated");
        }
    };

    let queryCharacterSheet = function (gmNotes, chatMessage, characterId) {
        let cleanNotes = cleanText(gmNotes);
        let lookup = chatMessage.content.replace("!sf_get ", "");
        let value = getSheetValue(getNPCStatBlocks(), lookup, cleanNotes);
        let sheets = findObjs({_id: characterId, _type: "character"});
        speakAsGuidanceToGM(sheets[0].get("name") + "<br><br>" + value);
    };

    let formatTemplateAsMacro = function (spellAsMacro, template) {
        let filteredTemplate = template.filter(element => !isFalsy(element.attribute) && !isFalsy(element.val !== undefined));
        for (let i = 0; i < filteredTemplate.length; i++) {
            spellAsMacro += "{{" + filteredTemplate[i].sheetAttribute + "=" + filteredTemplate[i].val + "}}";
        }
        return spellAsMacro;
    };

    let formatSpellAsMacro = function (template) {
        let spellAsMacro = "?{Hide this roll?|No, |Yes,/w GM} &{template:pf_spell}";
        return formatTemplateAsMacro(spellAsMacro, template);
    };

    /////////////////////////////////////////////////////////////////
    // Population helpers for v 2.0
    /////////////////////////////////////////////////////////////////

    let populateStarshipData = function (gmNotes, c) {
        for (let prop of findObjs({_characterid: c.characterId, _type: "ability"})) {
            debugLog("Removing " + prop.get("name"));
            prop.remove();
        }
        let cleanNotes = cleanText(gmNotes).trim();
        debugLog("clean notes = " + cleanNotes);

        if (debugMode) {
            isFalsy(cleanNotes);
            c.npcToken.set("gmnotes", cleanNotes);
        }

        let ship = parseStatBlock(getShipStatBlocks(), cleanNotes);
        setAttribute(c.characterId, "tab", 3);

        let basics = getShipBasics(cleanNotes);
        debugLog("Basics = " + basics);
        let frame = getShipFrame(basics.type.toLowerCase());

        setAttribute(c.characterId, "starship-name", c.characterSheet.get("name"));
        setAttribute(c.characterId, "starship-make", basics.type);
        setAttribute(c.characterId, "starship-pc-crew-show", 0);
        debugLog("Frame = " + frame);
        setAttribute(c.characterId, "starship-frame", String(frame));
        setAttribute(c.characterId, "starship-weapon-fwd-weapon1-show", 0);
        setAttribute(c.characterId, "starship-weapon-port-weapon1-show", 0);
        setAttribute(c.characterId, "starship-weapon-aft-weapon1-show", 0);
        setAttribute(c.characterId, "starship-weapon-turret-weapon1-show", 0);
        setAttribute(c.characterId, "starship-weapon-stbd-weapon1-show", 0);

        // get piloting stat and make macro
        let piloting = cleanNotes.substring(cleanNotes.indexOf("iloting")).substring(0, cleanNotes.indexOf(")"));
        piloting = piloting.trim();
        let pilotBonus = piloting.substring(piloting.indexOf("+") + 1).substring(0, piloting.indexOf("("));
        let pilotingRanks = piloting.substring(piloting.indexOf("(") + 1, piloting.indexOf(")"));
        let pilotingMacro = "&{template:pf_check} {{name=" + c.characterSheet.get("name") +
            "'s Piloting}} {{skill_chk=[[[[d20+" + pilotBonus + "]] + ?{Any other modifiers?|0}]]}}{{notes=" + pilotingRanks + "}}";

        createObj("ability", {
            name: "Piloting Check",
            description: "",
            action: pilotingMacro,
            _characterid: c.characterId,
        });

        // get gunnery stat for macros
        let gunnery = cleanNotes.substring(cleanNotes.indexOf("unnery")).substring(0, cleanNotes.indexOf("("));

        let filtered = ship.filter(element => !isFalsy(element.val) && !isFalsy(element.sheetAttribute) && !element.sheetAttribute.includes("weapon"));
        filtered = filtered.filter(element => !element.sheetAttribute.includes("weapon"));
        filtered.forEach(function (i) {
            i.val = i.val.replace(i.attribute, "").trim();
            let attrib = shipTemplateRowConvert(i);
            setAttribute(c.characterId, attrib.sheetAttribute, attrib.val);
        });

        setAttribute(c.characterId, "starship-frame", String(frame));
        setAttribute(c.characterId, "starship-name", c.characterSheet.get("name"));
        let allAttacks = cleanNotes.substring(cleanNotes.indexOf("Attack"), cleanNotes.indexOf("Power Core"));
        let allArcs = allAttacks.split("Attack ");

        allArcs.forEach(function (arc) {
            debugLog("Arc = " + arc);
            let weapons = arc.substring(arc.indexOf(")") + 1).trim();
            debugLog(weapons);
            let weapon = weapons.split(", ");
            let direction = arc.substring(1, arc.indexOf(")"));
            debugLog(direction);
            let i = 1;
            weapon.forEach(function (w) {
                debugLog("w = " + w);
                debugLog("Gunnery = " + gunnery);
                let weaponName = w.substring(0, w.indexOf("("));
                debugLog("WeaponName = " + weaponName);
                if (weaponName.trim() === "") {
                    return;
                }
                let bonus = gunnery.substring(gunnery.indexOf("+") + 1, gunnery.indexOf("(")).trim();
                debugLog("Bonus = " + bonus);
                let damage = w.substring(w.indexOf("(") + 1, w.indexOf(";"));
                debugLog("Damage = " + damage);

                let range = w.substring(w.indexOf(";") + 1);
                range = range.substring(0, range.indexOf(")")).trim();

                let weaponMacro = "&{template:pf_attack} {{name=" + c.characterSheet.get("name") +
                    "'s " + weaponName + "}} {{attack=[[ [[d20+" + bonus + "]] + ?{Any other modifiers?|0}]] }}" +
                    " {{damage=[[" + damage + "]] }} {{notes=" + range + " }} }} ";

                createObj("ability", {
                    name: direction.trim() + " " + weaponName.trim() + " fire",
                    description: "",
                    action: weaponMacro,
                    _characterid: c.characterId,
                });

                let abb = abbreviateArc(arc);
                setAttribute(c.characterId, "starship-" + abb + "-weapon" + i, weaponName);
                setAttribute(c.characterId, "starship-" + abb + "-weapon" + i + "-special", "See Abilites for Macro");
                setAttribute(c.characterId, "starship-" + abb + "-weapon" + i + "-dmg", damage);
                setAttribute(c.characterId, "starship-" + abb + "-weapon" + i + "-rng", range);
                setAttribute(c.characterId, "starship-weapon-" + abb + "-weapon1-show", 1);
                i++;
            });
        });

        let hitPoints = getAttribute(c.characterId, "starship-hp");
        c.npcToken.set("bar1_link", hitPoints.id);
        let armorClass = getAttribute(c.characterId, "starship-ac-misc").get("current");
        armorClass = parseFloat(armorClass) + 10;
        c.npcToken.set("bar2_value", "AC " + armorClass);
        c.npcToken.set("bar2_max", armorClass);
        armorClass = getAttribute(c.characterId, "starship-tl-misc").get("current");
        armorClass = parseFloat(armorClass) + 10;
        c.npcToken.set("bar3_value", "TL " + armorClass);
        c.npcToken.set("bar3_max", armorClass);
        c.npcToken.set("showname", true);
        speakAsGuidanceToGM("Token setup. For extra settings, check out the API TokenMod");

        speakAsGuidanceToGM(c.characterSheet.get("name") + " a " + basics.type + " has been constructed");
    };

    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////

    //<editor-fold desc="On-Ready event Code">
    on("ready", function () {
        if (debugMode) {
            speakAsGuidanceToGM(version);
        }
        speakAsGuidanceToGM("Greetings, I am Guidance. I am here to assist you working with your Starfinders to make " +
            "your time in the Pact Worlds more enjoyable. To learn how to use my services, simply type " +
            "<b>sf_help</b> into the chat.");

        log(version);
    });
    //</editor-fold>

    //<editor-fold desc="On-Message event Code">
    on("chat:message", function (chatMessage) {
        if (chatMessage.type !== "api" || !playerIsGM(chatMessage.playerid)) {
            return;
        }

        if (String(chatMessage.content).startsWith("!sf_help")) {
            speakAsGuidanceToGM("I have several commands I support:<br><br>" +
                "<b><i>!sf_populate</i></b> will allow you to take a Starfinder statblock that is in the GM notes section " +
                "of a selected character and I will attempt to use it to fill out the NPC section of the Starfinder " +
                "(Simple) character sheet. I support statblocks from the Archives of Nethys and the Starjammer SRD. " +
                "<i>I don't do well with Society PDFs</i>. If you want to attempt using one, double check my work.<br><br>" +
                "<b><i>!sf_clean CONFIRM</i></b> will allow me to take a selected character sheet and completely " +
                "<i>AND PERMANENTLY</i> remove all data from it. <i>I recommend against using this unless you are about " +
                "to reimport a character</i>.<br><br><b><i>!sf_token</i></b> will populate the token with hitpoint, " +
                "EAC, and KAC information in the event that the sheet is setup, but the token isn't.<br><br><b><i>" +
                "!sf_init</i></b> will roll group initiative for all selected NPCs");
            return;
        }

        if (isFalsy(chatMessage.selected) || chatMessage.selected.length < 1) {
            speakAsGuidanceToGM("Please select a token representing a character for me to work with");
            return;
        }

        let npcs = getSelectedNPCs(chatMessage.selected);

        try {
            //<editor-fold desc="Roll Initiative for a group of NPCs">
            if (String(chatMessage.content).startsWith("!sf_init")) {
                speakAsGuidanceToGM("Rolling NPC initiative for all selected tokens");
                npcs.forEach(function (npc) {
                    let characterId = npc.characterId;
                    let init = attributeToInteger(characterId, "npc-init-misc");
                    let dex = attributeToInteger(characterId, "DEX-bonus");
                    let roll = randomInteger(20) + dex + init;
                    turnorder.push({
                        id: obj[0].id,
                        pr: String(roll) + String(".0" + dex),
                        custom: getAttribute(characterId, "name")
                    });
                });
                Campaign().set("turnorder", JSON.stringify(turnorder));
                debugLog(JSON.stringify(turnorder));
                return;
            }
            //</editor-fold>

            //<editor-fold desc="Wipe out all Character Data">
            if (String(chatMessage.content).startsWith("!sf_clean CONFIRM")) {
                let msg = String(chatMessage.content).replace("!sf_clean ", "");
                if (npcs.length > 1) {
                    speakAsGuidanceToGM("Please do not select more than 1 NPC at a time. This command is potentially dangerous.");
                    return;
                }
                let c = npcs[0];
                if (msg.startsWith("CONFIRM")) {
                    for (const attribute of findObjs({_characterid: c.characterId, _type: "attribute"})) {
                        debugLog("Removing " + attribute.get("name"));
                        attribute.remove();
                    }
                    for (const ability of findObjs({_characterid: c.characterId, _type: "ability"})) {
                        debugLog("Removing " + ability.get("name"));
                        //  ability.remove();
                    }
                    for (let i = 1; i < 4; i++) {
                        c.npcToken.set("bar" + i + "_value", "");
                        c.npcToken.set("bar" + i + "_max", "");
                    }
                    if (debugMode) {
                        c.npcToken.set("gmnotes", "");
                    }

                    speakAsGuidanceToGM("Removed all properties for " + c.characterSheet.get("name"));
                    return;
                }
                speakAsGuidanceToGM("Check usage for !sf_clean");
                return;
            }
            //</editor-fold>

            //<editor-fold desc="Set up Token">
            if (String(chatMessage.content).startsWith("!sf_token")) {
                let c = npcs[0];
                setUpToken(c.characterId, c.npcToken);
                return;
            }
            //</editor-fold>

            //<editor-fold desc="Populate the Character Sheet">
            if (String(chatMessage.content).startsWith("!sf_character")) {
                let c = npcs[0];
                c.characterSheet.get("gmnotes", function (gmNotes) {
                    let cleanNotes = cleanText(gmNotes);
                    if (!cleanNotes.includes("Will")) {
                        speakAsGuidanceToGM("This does not appear to be a character statblock");
                        return;
                    }
                    let section = parseBlockIntoSubSectionMap(cleanNotes);

                    // For Debugging purposes and general information
                    if (debugMode) {
                        c.npcToken.set("gmnotes", cleanNotes);
                    }

                    // Setup Character Sheet
                    setAttribute(c.characterId, "npc-race", c.characterSheet.get("name"));
                    setAttribute(c.characterId, "tab", 4);
                    setAttribute(c.characterId, "npc-tactics-show", 0);
                    setAttribute(c.characterId, "npc-feats-show", 0);
                    populateHeader(c.characterId, section.get("header"));
                    populateDefense(c.characterId, section.get("defense"));
                    populateOffense(c.characterId, section.get("offense"));
                    populateStatics(c.characterId, section.get("statistics"));
                    populateSkills(c.characterId, section.get("statistics"));
                    populateNPC(c.characterId, cleanNotes);
                    populateSpecialAbilities(c.characterId, section.get("special"));

                    // Set up Token
                    setUpToken(c.characterId, c.npcToken);
                    if (cleanNotes.toLowerCase().includes("trick attack")) {
                        createObj("ability", {
                            name: "Trick Attack (settings on main sheet)",
                            description: "",
                            action: "&{template:pf_check}{{name=Trick Attack}}{{check=**CR**[[@{trick-attack-skill} - 20]]or lower }} {{foo=If you succeed at the check, you deal @{trick-attack-level} additional damage?{Which condition to apply? | none, | flat-footed, and the target is flat-footed | off-target, and the target is off-target | bleed, and the target is bleeding ?{How much bleed? &amp;#124; 1 &amp;#125; | hampered, and the target is hampered (half speed and no guarded step) | interfering, and the target is unable to take reactions | staggered, and the target is staggered (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates) | stun, and the target is stunned (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates) | knockout, and the target is unconscious for 1 minute (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates)} }} {{notes=@{trick-attack-notes}}}",
                            _characterid: c.characterId,
                        });
                        speakAsGuidanceToGM("Trick attack added to selected character");
                    }
                    speakAsGuidanceToGM(c.characterSheet.get("name") + " NPC character sheet processed");
                });
                return;
            }
            //</editor-fold>

            //<editor-fold desc="Add Trick Attack to a Character Sheet">
            if (String(chatMessage.content).startsWith("!sf_addTrick")) {
                createObj("ability", {
                    name: "Trick Attack (settings on main sheet)",
                    description: "",
                    action: "&{template:pf_check}{{name=Trick Attack}}{{check=**CR**[[@{trick-attack-skill} - 20]]or lower }} {{foo=If you succeed at the check, you deal @{trick-attack-level} additional damage?{Which condition to apply? | none, | flat-footed, and the target is flat-footed | off-target, and the target is off-target | bleed, and the target is bleeding ?{How much bleed? &amp;#124; 1 &amp;#125; | hampered, and the target is hampered (half speed and no guarded step) | interfering, and the target is unable to take reactions | staggered, and the target is staggered (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates) | stun, and the target is stunned (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates) | knockout, and the target is unconscious for 1 minute (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates)} }} {{notes=@{trick-attack-notes}}}",
                    _characterid: character.characterId,
                });
                addSpecialAbility(character.characterId, "Trick Attack (Ex) You can trick or startle a foe and then attack when she drops her guard. As a full action, you can move up to your speed. Whether or not you moved, you can then make an attack with a melee weapon with the operative special property or with any small arm. Just before making your attack, attempt a Bluff, Intimidate, or Stealth check (or a check associated with your specialization; see page 94) with a DC equal to 20 + your target’s CR. If you succeed at the check, you deal 1d4 additional damage and the target is flat-footed. This damage increases to 1d8 at 3rd level, to 3d8 at 5th level, and by an additional 1d8 every 2 levels thereafter. You can’t use this ability with a weapon that has the unwieldy special property or that requires a full action to make a single attack.");

                speakAsGuidanceToGM("Trick attack added to selected character");
                return;
            }
            //</editor-fold>

            //<editor-fold desc="Populate Starship Character Sheet">
            if (String(chatMessage.content).startsWith("!sf_starship")) {
                let c = npcs[0];
                c.characterSheet.get("gmnotes", function (gmNotes) {
                    if (gmNotes.includes("TL")) {
                        populateStarshipData(gmNotes, c);
                    } else {
                        speakAsGuidanceToGM("This is not a starship statblock")
                    }
                });
                return;
            }
            //</editor-fold>

            // TODO add help text to clarify how to use this.
            //<editor-fold desc="Add Special Ability to Character sheet">
            if (String(chatMessage.content).startsWith("!sf_ability")) {
                let cleanNotes = chatMessage.content.replace("!sf_ability ", "");
                addSpecialAbility(character.characterId, cleanNotes);
            }
            //</editor-fold>

            // TODO add help text to clarify how to use this.
            //<editor-fold desc="Add a Spell to a character sheet as a macro">
            if (String(chatMessage.content).startsWith("!sf_addspell")) {
                let c = npcs[0];
                let cleanNotes = chatMessage.content.replace("!sf_addspell ", "");
                cleanNotes = cleanNotes.replace("SFS Legal", "").trim();
                let spell = parseStatBlock(getSpellStatBlocks(), cleanNotes);
                let spellText = formatSpellAsMacro(spell);
                debugLog(spellText);
                let name = spellText.match(/(?<={{name=)(.*?)(?=}})/);
                if (c.characterId !== undefined) {
                    createObj("ability", {
                        name: name[0] + " spell",
                        description: "",
                        action: spellText,
                        _characterid: c.characterId,
                    });
                }
                speakAsGuidanceToGM("Spell has been added to " + c.characterSheet.get("name"));
                return;
            }
            //</editor-fold>


            //<editor-fold desc="Code for Testing and Debugging">
            if (debugMode) {
                let character = npcs[0];
                if (String(chatMessage.content).startsWith("!sf_get")) {
                    character.characterSheet.get("gmnotes", function (gmNotes) {
                        queryCharacterSheet(gmNotes, chatMessage, character.characterId);
                    });
                    return;
                }

                // Code for Testing and Debugging
                if (String(chatMessage.content).startsWith("!sf_debug")) {
                    debugLog("start");
                    let attribs = findObjs({
                        _characterid: character.characterId,
                        _type: "attribute",
                    });
                    for (const att of attribs) {
                        log(att);
                    }

                    let ables = findObjs({
                        _characterid: character.characterId,
                        _type: "ability",
                    });
                    for (const ab of ables) {
                        debugLog(ab);
                    }
                    debugLog("Done");

                }
            }
            //</editor-fold>

        } catch (ex) {
            speakAsGuidanceToGM("I have encountered an error. If you can, please report this to the Script Creator.");
            log(ex);
        }
    });
    //</editor-fold>

    /////////////////////////////////////////////////////////////////
    // Population helpers for v 1.0
    /////////////////////////////////////////////////////////////////

    //<editor-fold desc="Old Population Helpers - try to move to new helper">
    let parseBlockIntoSubSectionMap = function (textToParse) {
        let sections = new Map();
        let parsedText = textToParse;

        sections.set("header", parsedText.substring(0, parsedText.indexOf("DEFENSE")));
        parsedText = parsedText.substring(parsedText.indexOf("DEFENSE"));

        sections.set("defense", parsedText.substring(0, parsedText.indexOf("OFFENSE")));
        parsedText = parsedText.substring(parsedText.indexOf("OFFENSE"));

        if (textToParse.includes("TACTICS")) {
            speakAsGuidanceToGM("Tactics section found. Tactics Processing not yet implemented");
            sections.set("offense", parsedText.substring(0, parsedText.indexOf("TACTICS")));
        } else {
            sections.set("offense", parsedText.substring(0, parsedText.indexOf("STATISTICS")));
        }
        parsedText = parsedText.substring(parsedText.indexOf("STATISTICS"));
        if (textToParse.includes("SPECIAL ABILITIES")) {
            sections.set("statistics", parsedText.substring(0, parsedText.indexOf("SPECIAL ABILITIES")));
            parsedText = parsedText.substring(parsedText.indexOf("SPECIAL ABILITIES"));
            sections.set("special", parsedText);
        } else {
            sections.set("statistics", parsedText);
        }

        return sections;
    };

    let doMagic = function (characterId, textToParse) {
        textToParse = textToParse.substring(textToParse.indexOf("Spell"));
        textToParse = textToParse.replace(/\s+/, " ");
        let attackBonus = "";
        if (textToParse.includes("Spells Known")) {
            setAttribute(characterId, "spellclass-1-level", getValue("CL", textToParse, ";").replace(/\D/g, ""));

            attackBonus = textToParse.replace(/\(.*;/, "");
            attackBonus = attackBonus.replace("Spells Known", "");
            attackBonus = attackBonus.substring(0, attackBonus.indexOf(")"));
            textToParse = textToParse.substring(textToParse.indexOf(")") + 1);

            let level = "";
            if (textToParse.includes("6th")) {
                level = textToParse.substring(textToParse.indexOf("6th"), textToParse.indexOf("5th")).trim();
                addSpell(characterId, level, attackBonus);
            }
            if (textToParse.includes("5th")) {
                level = textToParse.substring(textToParse.indexOf("5th"), textToParse.indexOf("4th")).trim();
                addSpell(characterId, level, attackBonus);
            }
            if (textToParse.includes("4th")) {
                level = textToParse.substring(textToParse.indexOf("4th"), textToParse.indexOf("3rd")).trim();
                addSpell(characterId, level, attackBonus);
            }
            if (textToParse.includes("3rd")) {
                level = textToParse.substring(textToParse.indexOf("3rd"), textToParse.indexOf("2nd")).trim();
                addSpell(characterId, level, attackBonus);
            }
            if (textToParse.includes("2nd")) {
                level = textToParse.substring(textToParse.indexOf("2nd"), textToParse.indexOf("1st")).trim();
                addSpell(characterId, level, attackBonus);
            }
            if (textToParse.includes("1st")) {
                level = textToParse.substring(textToParse.indexOf("1st"), textToParse.indexOf("0 (at will)")).trim();
                addSpell(characterId, level, attackBonus);
            }
            level = textToParse.substring(textToParse.indexOf("0 (at")).trim();
            if (textToParse.includes("Spell-Like Abilities")) {
                level = level.substring(0, level.indexOf("Spell-Like Abilities"));
            }
            addSpell(characterId, level, attackBonus);
        } else {
            setAttribute(characterId, "npc-spells-show", 0);
        }

        if (textToParse.includes("Spell-Like Abilities")) {
            textToParse = textToParse.substring(textToParse.indexOf("Spell-Like Abilities")).trim();
            setAttribute(characterId, "spellclass-0-level", getValue("CL", textToParse, ";").replace(/\D/g, ""));
            textToParse = textToParse.replace(/Spell-Like Abilities/, "").trim();

            attackBonus = textToParse.replace(/\(.*;/, "");
            attackBonus = attackBonus.substring(0, attackBonus.indexOf(")") + 1);

            let lines = textToParse.match(/\d\/\w+|At will|Constant/);
            for (let i = 0; i < lines.length; i++) {
                let ability = "";
                if (isFalsy(lines[i + 1])) {
                    ability = textToParse.substring(textToParse.indexOf(lines[i]));
                } else {
                    ability = textToParse.substring(textToParse.indexOf(lines[i]), textToParse.indexOf(lines[i + 1]));
                }
                addSpellLikeAbility(characterId, ability, attackBonus);
            }
        } else {
            setAttribute(characterId, "npc-spell-like-abilities-show", 0);
        }
    };

    let addSpell = function (characterId, textToParse, additional) {
        textToParse = textToParse.replace(/—/g, "");
        let uuid = generateRowID();
        let value = textToParse.substring(0, textToParse.indexOf("(")).replace(/\D/g, "").trim();
        setAttribute(characterId, "repeating_spells_" + uuid + "_npc-spell-level", value);
        value = textToParse.substring(textToParse.indexOf("("), textToParse.indexOf(")") + 1).trim();
        setAttribute(characterId, "repeating_spells_" + uuid + "_npc-spell-usage", value);
        value = "(" + additional.trim() + ") " + textToParse.substring(textToParse.indexOf(")") + 1).trim();
        setAttribute(characterId, "repeating_spells_" + uuid + "_npc-spell-list", value);
    };

    let addSpellLikeAbility = function (characterId, textToParse, attackBonus) {
        let uuid = generateRowID();
        setAttribute(characterId, "repeating_npc-spell-like-abilities_" + uuid + "_npc-abil-usage", textToParse.substring(0, textToParse.indexOf("—")).trim());
        setAttribute(characterId, "repeating_npc-spell-like-abilities_" + uuid + "_npc-abil-name", attackBonus + " " + textToParse.substring(textToParse.indexOf("—") + 2).trim());
    };

    let populateHeader = function (characterId, textToParse) {
        setAttribute(characterId, "npc-cr", getValue("CR", textToParse));
        setAttribute(characterId, "npc-XP", getValue("XP", textToParse).replace(/\s/, "").replace(/,/, ""));
        setAttribute(characterId, "npc-senses", getValue("Senses", textToParse, ";"));
        setAttribute(characterId, "npc-aura", getStringValue("Aura", textToParse, "DEFENSE"));
    };

    let populateDefense = function (characterId, textToParse) {
        setAttribute(characterId, "EAC-npc", getValue("EAC ", textToParse));
        setAttribute(characterId, "KAC-npc", getValue("KAC", textToParse));
        setAttribute(characterId, "Fort-npc", getValue("Fort", textToParse).replace("+", ""));
        setAttribute(characterId, "Ref-npc", getValue("Ref", textToParse).replace("+", ""));
        setAttribute(characterId, "Will-npc", getValue("Will", textToParse).replace("+", ""));
        setAttribute(characterId, "HP-npc", getValue("HP", textToParse));
        let rp = getValue("RP", textToParse);
        if (!isFalsy(rp)) {
            setAttribute(characterId, "RP-npc", rp);
        }
        setAttribute(characterId, "npc-SR", getValue("SR", textToParse));
        if (textToParse.includes("Weaknesses")) {
            setAttribute(characterId, "npc-resistances", getValue("Resistances", textToParse, "Weaknesses"));
            setAttribute(characterId, "npc-weaknesses", getValue("Weaknesses", textToParse, ";"));
        } else {
            setAttribute(characterId, "npc-resistances", getValue("Resistances", textToParse, ";"));
        }
        setAttribute(characterId, "npc-DR", getValue("DR", textToParse, ";"));

        if (textToParse.includes("SR")) {
            setAttribute(characterId, "npc-immunities", getValue("Immunities", textToParse, "SR"));
        } else {
            setAttribute(characterId, "npc-immunities", getValue("Immunities", textToParse, "OFFENSE"));
        }

        let defensiveAbilities = "";
        if (textToParse.includes("vs.")) {
            let extraSaveStart = textToParse.indexOf("Will") + 3;
            defensiveAbilities = textToParse.substr(extraSaveStart);
            extraSaveStart = defensiveAbilities.indexOf(";");
            defensiveAbilities = defensiveAbilities.substr(extraSaveStart + 1);
            if (defensiveAbilities.includes("Defensive")) {
                defensiveAbilities = defensiveAbilities.substring(0, defensiveAbilities.indexOf("Defensive"));
            }
        }
        if (textToParse.includes("Defensive")) {
            let start = textToParse.indexOf("Defensive Abilities") + "Defensive Abilities".length;
            if (textToParse.includes("Immunities")) {
                textToParse = textToParse.substring(0, textToParse.indexOf("Immunities"));
            }
            defensiveAbilities = textToParse.substring(start) + " " + defensiveAbilities;
        }
        setAttribute(characterId, "npc-defensive-abilities", defensiveAbilities);
    };

    let populateOffense = function (characterId, textToParse) {
        let specialAbilities = getValue("Offensive Abilities", textToParse, "STATISTICS");
        if (specialAbilities.includes("Spell")) {
            specialAbilities = specialAbilities.substring(0, specialAbilities.indexOf("Spell"));
        }
        if (isFalsy(specialAbilities)) {
            setAttribute(characterId, "npc-special-attacks-show", 0);
        } else {
            setAttribute(characterId, "npc-special-attacks", specialAbilities);
        }

        setAttribute(characterId, "speed-base-npc", getMovement("Speed", textToParse));
        setAttribute(characterId, "speed-fly-npc", getMovement("fly", textToParse));
        setAttribute(characterId, "speed-burrow-npc", getMovement("burrow", textToParse));
        setAttribute(characterId, "speed-climb-npc", getMovement("climb", textToParse));
        setAttribute(characterId, "speed-swim-npc", getMovement("swim", textToParse));
        setAttribute(characterId, "space", getMovement("Space", textToParse));
        setAttribute(characterId, "reach", getMovement("Reach", textToParse));

        if (textToParse.toLowerCase().includes("fly")) {
            if (textToParse.includes("(Ex")) {
                setAttribute(characterId, "speed-fly-source-npc", 1);
            } else if (textToParse.includes("(Su")) {
                setAttribute(characterId, "speed-fly-source-npc", 2);
            } else {
                setAttribute(characterId, "speed-fly-source-npc", 3);
            }

            if (textToParse.includes("lumsy)")) {
                setAttribute(characterId, "speed-fly-maneuverability-npc", -8);
            } else if (textToParse.includes("erfect)")) {
                setAttribute(characterId, "speed-fly-maneuverability-npc", 8);
            } else {
                setAttribute(characterId, "speed-fly-maneuverability-npc", 0);
            }
        }

        doWeapons(characterId, textToParse);
        doMagic(characterId, textToParse);
    };

    let getMovement = function (textToFind, textToParse) {
        if (textToParse.includes(textToFind)) {
            return getStringValue(textToFind, textToParse, "ft.").trim();
        }
        return "";
    };

    let populateStatics = function (characterId, textToParse) {
        let stats = ["Str", "Dex", "Con", "Int", "Wis", "Cha"];

        for (const att of stats) {
            let stat = parseFloat(getValue(att, textToParse).replace("+", ""));
            let attUpper = att.toUpperCase();
            setAttribute(characterId, attUpper + "-bonus", String(stat));
            setAttribute(characterId, attUpper + "-temp", String(stat * 2));
        }

        if (!textToParse.includes("Other Abilities")) {
            setAttribute(characterId, "languages-npc", getValue("Languages", textToParse, "Gear"));
        } else {
            setAttribute(characterId, "languages-npc", getValue("Languages", textToParse, "Other"));
        }

        let gear = getValue("Gear", textToParse, "Ecology");
        if (isFalsy(gear) || gear.length < 1) {
            setAttribute(characterId, "npc-gear-show", 0);
        } else {
            setAttribute(characterId, "npc-gear", getValue("Gear", textToParse, "Ecology"));
        }

        let sq = getValue("Other Abilities", textToParse, "Gear");
        if (sq.includes("ECOLOGY")) {
            sq = sq.substring(0, sq.indexOf("ECOLOGY"));
        }
        setAttribute(characterId, "SQ", sq);
    };

    let populateSpecialAbilities = function (characterId, textToParse) {
        debugLog("Parsing Special Abilities");
        if (!isFalsy(textToParse)) {
            if (textToParse.includes("SPECIAL ABILITIES")) {
                textToParse = textToParse.replace("SPECIAL ABILITIES", "").trim();
                addSpecialAbility(characterId, textToParse);
            }
        } else {
            setAttribute(characterId, "npc-special-abilities-show", 0);
        }
    };

    let addSpecialAbility = function (characterId, textToParse) {
        debugLog("Parsing Special Abilities");
        let uuid;

        setAttribute(characterId, "npc-special-abilities-show", 1);
        if (textToParse.includes("(")) {
            do {
                uuid = generateRowID();
                let abilityName = textToParse.substring(0, textToParse.indexOf(")") + 1);
                setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-name", abilityName.trim());
                textToParse = textToParse.substring(textToParse.indexOf(")") + 1);
                let nextAbility = textToParse.match(/\.([^\.]*?)\(..\)/);
                if (isFalsy(nextAbility)) {
                    setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-description", textToParse.trim());
                    return;
                }
                let endPoint = textToParse.indexOf(nextAbility[0]) + 1;
                setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-description", textToParse.substring(0, endPoint).trim());
                textToParse = textToParse.substring(endPoint);
            } while (textToParse.includes("("));
        } else {
            uuid = generateRowID();
            setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-name", "Special Abilities");
            textToParse = textToParse.replace(/\./, ".\n");
            setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-description", textToParse.trim());
        }

    };

    let populateSkills = function (characterId, textToParse) {
        setAttribute(characterId, "Acrobatics-npc-misc", getSkillValue("Acrobatics", "Dex", textToParse));
        setAttribute(characterId, "Athletics-npc-misc", getSkillValue("Athletics", "Str", textToParse));
        setAttribute(characterId, "Bluff-npc-misc", getSkillValue("Bluff", "Cha", textToParse));
        setAttribute(characterId, "Computers-npc-misc", getSkillValue("Computers", "Int", textToParse));
        setAttribute(characterId, "Culture-npc-misc", getSkillValue("Culture", "Int", textToParse));
        setAttribute(characterId, "Diplomacy-npc-misc", getSkillValue("Diplomacy", "Cha", textToParse));
        setAttribute(characterId, "Disguise-npc-misc", getSkillValue("Disguise", "Cha", textToParse));
        setAttribute(characterId, "Engineering-npc-misc", getSkillValue("Engineering", "Int", textToParse));
        setAttribute(characterId, "Intimidate-npc-misc", getSkillValue("Intimidate", "Cha", textToParse));
        setAttribute(characterId, "Life-Science-npc-misc", getSkillValue("Life-Science", "Int", textToParse));
        setAttribute(characterId, "Medicine-npc-misc", getSkillValue("Medicine", "Int", textToParse));
        setAttribute(characterId, "Mysticism-npc-misc", getSkillValue("Mysticism", "Wis", textToParse));
        setAttribute(characterId, "Physical-Science-npc-misc", getSkillValue("Physical-Science", "Int", textToParse));
        setAttribute(characterId, "Piloting-npc-misc", getSkillValue("Piloting", "Dex", textToParse));
        setAttribute(characterId, "Sense-Motive-npc-misc", getSkillValue("Sense-Motive", "Wis", textToParse));
        setAttribute(characterId, "Sleight-of-Hand-npc-misc", getSkillValue("Sleight-of-Hand", "Dex", textToParse));
        setAttribute(characterId, "Stealth-npc-misc", getSkillValue("Stealth", "Dex", textToParse));
        setAttribute(characterId, "Survival-npc-misc", getSkillValue("Survival", "Wis", textToParse));
        setAttribute(characterId, "Acrobatics-ranks", getSkillValue("Acrobatics", "Dex", textToParse));
        setAttribute(characterId, "Athletics-ranks", getSkillValue("Athletics", "Str", textToParse));
        setAttribute(characterId, "Bluff-ranks", getSkillValue("Bluff", "Cha", textToParse));
        setAttribute(characterId, "Computers-ranks", getSkillValue("Computers", "Int", textToParse));
        setAttribute(characterId, "Culture-ranks", getSkillValue("Culture", "Int", textToParse));
        setAttribute(characterId, "Diplomacy-ranks", getSkillValue("Diplomacy", "Cha", textToParse));
        setAttribute(characterId, "Disguise-ranks", getSkillValue("Disguise", "Cha", textToParse));
        setAttribute(characterId, "Engineering-ranks", getSkillValue("Engineering", "Int", textToParse));
        setAttribute(characterId, "Intimidate-ranks", getSkillValue("Intimidate", "Cha", textToParse));
        setAttribute(characterId, "Life-Science-ranks", getSkillValue("Life-Science", "Int", textToParse));
        setAttribute(characterId, "Medicine-ranks", getSkillValue("Medicine", "Int", textToParse));
        setAttribute(characterId, "Mysticism-ranks", getSkillValue("Mysticism", "Wis", textToParse));
        setAttribute(characterId, "Physical-Science-ranks", getSkillValue("Physical-Science", "Int", textToParse));
        setAttribute(characterId, "Piloting-ranks", getSkillValue("Piloting", "Dex", textToParse));
        setAttribute(characterId, "Sense-Motive-ranks", getSkillValue("Sense-Motive", "Wis", textToParse));
        setAttribute(characterId, "Sleight-of-Hand-ranks", getSkillValue("Sleight-of-Hand", "Dex", textToParse));
        setAttribute(characterId, "Stealth-ranks", getSkillValue("Stealth", "Dex", textToParse));
        setAttribute(characterId, "Survival-ranks", getSkillValue("Survival", "Wis", textToParse));
    };

    let populateNPC = function (characterId, textToParse) {
        setAttribute(characterId, "Perception-npc-misc", getSkillValue("Perception", "Wis", textToParse));
        setAttribute(characterId, "npc-init-misc", getSkillValue("Init", "Dex", textToParse));

        try {
            let section = getStringValue("XP", textToParse, "DEFENSE").trim();
            // let subsections = section.split(" ");

            if (section.includes("LG")) {
                setAttribute(characterId, "npc-alignment", "LG");
            } else if (section.includes("NG")) {
                setAttribute(characterId, "npc-alignment", "NG");
            } else if (section.includes("CG")) {
                setAttribute(characterId, "npc-alignment", "CG");
            } else if (section.includes("LN")) {
                setAttribute(characterId, "npc-alignment", "LN");
            } else if (section.includes("CN")) {
                setAttribute(characterId, "npc-alignment", "CN");
            } else if (section.includes("LE")) {
                setAttribute(characterId, "npc-alignment", "LE");
            } else if (section.includes("NE")) {
                setAttribute(characterId, "npc-alignment", "NE");
            } else if (section.includes("CE")) {
                setAttribute(characterId, "npc-alignment", "CE");
            } else {
                setAttribute(characterId, "npc-alignment", "N");
            }

            let subtypeStart = 0;
            let dropdown = 0;
            if (section.toLowerCase().includes("medium")) {
                dropdown = 0;
                subtypeStart = section.indexOf("Medium") + "Medium".length;
            } else if (section.toLowerCase().includes("large")) {
                dropdown = -1;
                subtypeStart = section.indexOf("Large") + "Large".length;
            } else if (section.toLowerCase().includes("small")) {
                dropdown = 1;
                subtypeStart = section.indexOf("Small") + "Small".length;
            } else if (section.toLowerCase().includes("gargantuan")) {
                dropdown = -4;
                subtypeStart = section.indexOf("Gargantuan") + "Gargantuan".length;
            } else if (section.toLowerCase().includes("huge")) {
                dropdown = -2;
                subtypeStart = section.indexOf("Huge") + "Huge".length;
            } else if (section.toLowerCase().includes("tiny")) {
                dropdown = 2;
                subtypeStart = section.indexOf("Tiny") + "Tiny".length;
            } else if (section.toLowerCase().includes("diminutive")) {
                dropdown = 4;
                subtypeStart = section.indexOf("Diminutive") + "Diminutive".length;
            } else if (section.toLowerCase().includes("fine")) {
                dropdown = 8;
                subtypeStart = section.indexOf("Fine") + "Fine".length;
            } else if (section.toLowerCase().includes("colossal")) {
                dropdown = -8;
                subtypeStart = section.indexOf("Colossal") + "Colossal".length;
            }

            setAttribute(characterId, "npc-size", dropdown);
            setAttribute(characterId, "npc-subtype", section.substring(subtypeStart, section.indexOf("Init")));
        } catch (err) {
            debugLog("Problems with alignment, size,subtype");
        }
    };

    let doWeapons = function (characterId, textToParse) {
        let delimiter = "~~~";
        textToParse = textToParse.replace(/Attacks/i, ""
        ).replace(/ or /g, delimiter
        ).replace(/Ranged/g, delimiter
        ).replace(/Melee/g, delimiter
        ).replace(/OFFENSE/, ""
        ).replace(/Multiattack/, delimiter + "Multiattack"
        );

        if (textToParse.indexOf("Space") > 0) {
            textToParse = textToParse.substring(0, textToParse.indexOf("Space"));
        }

        if (textToParse.indexOf("Spell") > 0) {
            textToParse = textToParse.substring(0, textToParse.indexOf("Spell"));
        }

        if (textToParse.includes("Speed")) {
            textToParse = textToParse.substring(textToParse.indexOf("ft"));
        }

        if (textToParse.includes("fly")) {
            textToParse = textToParse.substring(textToParse.indexOf("fly"));
            textToParse = textToParse.substring(textToParse.indexOf("ft.") + 3).trim();
            if (textToParse.startsWith("(")) {
                textToParse = textToParse.substring(textToParse.indexOf(")") + 1).trim();
            }
        }

        if (textToParse.indexOf("Offensive Abilities") > 0) {
            textToParse = textToParse.substring(0, textToParse.indexOf("Offensive Abilities"));
        }

        let attacks = textToParse.split(delimiter);
        for (let attack of attacks) {
            attack = attack.trim();
            debugLog("Examining Attack " + attack);
            if (attack.length > 1) {
                if (!(attack.startsWith("Space") || attack.startsWith("Reach") || attack.startsWith("ft"))) {
                    debugLog("Adding Attack " + attack);
                    try {
                        armNPC(characterId, attack);
                    } catch (err) {
                        speakAsGuidanceToGM("Could not populate data for weapon " + attack);
                    }
                }
            }

        }
    };

    let armNPC = function (characterId, attackToParse) {
        debugLog("Parsing " + attackToParse);
        let uuid = generateRowID();

        let details = attackToParse.split(" ");
        let i = 0;
        let weapon = "";
        while (isNaN(details[i]) && i < details.length) {
            weapon = weapon + details[i] + " ";
            i++;
        }

        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-notes", attackToParse);
        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-name", weapon);
        let attackBonus = details[i];
        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-attack", attackBonus);
        i++;

        let damage = details[i].replace(/\(/, "");
        let numDice = damage.split("d");
        let dnd = numDice[1].split("+");
        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-damage-dice-num", numDice[0]);
        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-damage-die", dnd[0]);

        if (!isFalsy(dnd[1])) {
            setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-damage", dnd[1]);
        }
    };
    //</editor-fold>

    /////////////////////////////////////////////////////////////////
    // Stat block formatters
    /////////////////////////////////////////////////////////////////
    let getShipStatBlocks = function () {
        let t = [];
        t.push(new TemplateRow(t.length, "starship-name", ""));
        t.push(new TemplateRow(t.length, "starship-tier", ""));
        t.push(new TemplateRow(t.length, "starship-size", ""));
        t.push(new TemplateRow(t.length, "starship-frame", ""));
        t.push(new TemplateRow(t.length, "starship-speed", "Speed"));
        t.push(new TemplateRow(t.length, "starship-maneuverability", "Maneuverability"));
        t.push(new TemplateRow(t.length, "starship-drift-rating", "Drift"));
        t.push(new TemplateRow(t.length, "starship-ac-misc", "AC"));
        t.push(new TemplateRow(t.length, "starship-tl-misc", "TL"));
        t.push(new TemplateRow(t.length, "starship-hp", "HP"));
        t.push(new TemplateRow(t.length, "starship-damage-threshold", "DT"));
        t.push(new TemplateRow(t.length, "starship-critical-threshold", "CT"));
        t.push(new TemplateRow(t.length, "starship-total-shield-points", "Shields"));
        t.push(new TemplateRow(t.length, "starship-fwd-shields", "(forward"));
        t.push(new TemplateRow(t.length, "starship-port-shields", "port"));
        t.push(new TemplateRow(t.length, "starship-stbd-shields", "starboard"));
        t.push(new TemplateRow(t.length, "starship-aft-shields", "aft"));
        t.push(new TemplateRow(t.length, "starship-fwd-weapon", "Attack (Forward)"));
        t.push(new TemplateRow(t.length, "starship-port-weapon", "Attack (Port)"));
        t.push(new TemplateRow(t.length, "starship-stbd-weapon", "Attack (Starboard)"));
        t.push(new TemplateRow(t.length, "starship-aft-weapon", "Attack (Aft)"));
        t.push(new TemplateRow(t.length, "starship-turret-weapon", "Attack (Turret)"));
        t.push(new TemplateRow(t.length, "starship-power-core", "Power Core"));
        t.push(new TemplateRow(t.length, "starship-drift-engine", "Drift Engine"));
        t.push(new TemplateRow(t.length, "starship-notes", "Systems"));
        t.push(new TemplateRow(t.length, "starship-bays", "Expansion Bays"));
        t.push(new TemplateRow(t.length, "starship-computer", "Modifiers"));
        t.push(new TemplateRow(t.length, "starship-crew-size", "Complement"));
        t.push(new TemplateRow(t.length, "", "CREW"));
        t.push(new TemplateRow(t.length, "starship-crew-capt", "Captain"));
        t.push(new TemplateRow(t.length, "starship-crew-eng", "Engineer"));
        t.push(new TemplateRow(t.length, "starship-crew-gun", "Gunner")); //(s) (#)
        t.push(new TemplateRow(t.length, "starship-crew-pilot", "Pilot"));
        t.push(new TemplateRow(t.length, "starship-crew-sci", "Science Officer"));
        t.push(new TemplateRow(t.length, "", "SPECIAL ABILITIES"));
        t.sort(function (a, b) {
            return a.order - b.order;
        });
        return t;
    };

    let getSpellStatBlocks = function () {
        let spellArray = [];
        spellArray.push(new TemplateRow(spellArray.length, "name", ""));
        spellArray.push(new TemplateRow(spellArray.length, "source", "Source"));
        spellArray.push(new TemplateRow(spellArray.length, "level", "Classes"));
        spellArray.push(new TemplateRow(spellArray.length, "school", "School"));
        spellArray.push(new TemplateRow(spellArray.length, "casting_time", "Casting Time"));
        spellArray.push(new TemplateRow(spellArray.length, "range", "Range"));
        spellArray.push(new TemplateRow(spellArray.length, "target", "Area"));
        spellArray.push(new TemplateRow(spellArray.length, "target", "Effect"));
        spellArray.push(new TemplateRow(spellArray.length, "target", "Target"));
        spellArray.push(new TemplateRow(spellArray.length, "duration", "Duration"));
        spellArray.push(new TemplateRow(spellArray.length, "saving_throw", "Saving Throw"));
        //spellArray.push(new TemplateRow(spellArray.length, "save_effect", "Save Effect"));
        spellArray.push(new TemplateRow(spellArray.length, "sr", "Spell Resistance"));
        spellArray.push(new TemplateRow(spellArray.length, "rng_attack", "Ranged Attack"));
        spellArray.push(new TemplateRow(spellArray.length, "mel_attack", "Melee Attack"));
        spellArray.push(new TemplateRow(spellArray.length, "damage", "Damage"));
        spellArray.push(new TemplateRow(spellArray.length, "spell_description", "Description"));
        spellArray.sort(function (a, b) {
            return a.order - b.order;
        });
        return spellArray;
    };

    let getNPCStatBlocks = function () {
        let t = [];
        t.push(new TemplateRow(t.length, "npc-race")); // name
        t.push(new TemplateRow(0, "npc-cr", "CR"));
        t.push(new TemplateRow(t.length, "npc-XP", "XP"));
        t.push(new TemplateRow(t.length, "npc-alignment"));
        t.push(new TemplateRow(t.length, "npc-size"));
        t.push(new TemplateRow(t.length, "npc-subtype"));
        t.push(new TemplateRow(t.length, "npc-init-misc", "Init"));
        t.push(new TemplateRow(t.length, "npc-senses", "Senses"));
        t.push(new TemplateRow(t.length, "Perception-npc-misc", "Perception"));
        t.push(new TemplateRow(t.length, "npc-aura", "Aura"));
        t.push(new TemplateRow(t.length, "", "DEFENSE"));
        t.push(new TemplateRow(t.length, "HP-npc", "HP"));
        t.push(new TemplateRow(t.length, "RP-npc", "RP"));
        t.push(new TemplateRow(t.length, "EAC-npc", "EAC"));
        t.push(new TemplateRow(t.length, "KAC-npc", "KAC"));
        t.push(new TemplateRow(t.length, "Fort-npc", "Fort"));
        t.push(new TemplateRow(t.length, "Ref-npc", "Ref"));
        t.push(new TemplateRow(t.length, "Will-npc", "Will"));
        t.push(new TemplateRow(t.length, "npc-defensive-abilities", "Defensive Abilities"));
        t.push(new TemplateRow(t.length, "npc-DR", "DR"));
        t.push(new TemplateRow(t.length, "npc-immunities", "Immunities"));
        t.push(new TemplateRow(t.length, "npc-resistances", "Resistances"));
        t.push(new TemplateRow(t.length, "npc-SR", "SR"));
        t.push(new TemplateRow(t.length, "npc-weaknesses", "Weaknesses"));
        t.push(new TemplateRow(t.length, "", "OFFENSE"));
        t.push(new TemplateRow(t.length, "speed-base-npc", "Speed"));
        t.push(new TemplateRow(t.length, "speed-burrow-npc", "burrow"));
        t.push(new TemplateRow(t.length, "speed-climb-npc", "climb"));
        t.push(new TemplateRow(t.length, "speed-swim-npc", "swim"));
        t.push(new TemplateRow(t.length, "speed-fly-npc", "fly"));
        t.push(new TemplateRow(t.length, "speed-fly-maneuverability-npc"));
        t.push(new TemplateRow(t.length, "SPECIAL", "Melee"));
        t.push(new TemplateRow(t.length, "SPECIAL", "Ranged"));
        t.push(new TemplateRow(t.length, "SPECIAL", "Multiattack"));
        t.push(new TemplateRow(t.length, "space", "Space"));
        t.push(new TemplateRow(t.length, "reach", "Reach"));
        t.push(new TemplateRow(t.length, "npc-special-attacks", "Offensive Abilities"));
        t.push(new TemplateRow(t.length, "SPECIAL", "Spell-Like Abilities"));  // (CL )
        t.push(new TemplateRow(t.length, "SPECIAL", "Spells Known")); // (CL )
        t.push(new TemplateRow(t.length, "SPECIAL", "Connection")); //   (if Mystic)
        t.push(new TemplateRow(t.length, "", "TACTICS"));
        t.push(new TemplateRow(t.length, "", "STATISTICS"));
        t.push(new TemplateRow(t.length, "STR-bonus", "Str"));
        t.push(new TemplateRow(t.length, "DEX-bonus", "Dex"));
        t.push(new TemplateRow(t.length, "CON-bonus", "Con"));
        t.push(new TemplateRow(t.length, "INT-bonus", "Int"));
        t.push(new TemplateRow(t.length, "WIS-bonus", "Wis"));
        t.push(new TemplateRow(t.length, "CHA-bonus", "Cha"));
        t.push(new TemplateRow(t.length, "", "Skills"));
        t.push(new TemplateRow(t.length, "Acrobatics-npc-misc", "Acrobatics"));
        t.push(new TemplateRow(t.length, "Athletics-npc-misc", "Athletics"));
        t.push(new TemplateRow(t.length, "Bluff-npc-misc", "Bluff"));
        t.push(new TemplateRow(t.length, "Computers-npc-misc", "Computers"));
        t.push(new TemplateRow(t.length, "Culture-npc-misc", "Culture"));
        t.push(new TemplateRow(t.length, "Diplomacy-npc-misc", "Diplomacy"));
        t.push(new TemplateRow(t.length, "Disguise-npc-misc", "Disguise"));
        t.push(new TemplateRow(t.length, "Engineering-npc-misc", "Engineering"));
        t.push(new TemplateRow(t.length, "Intimidate-npc-misc", "Intimidate"));
        t.push(new TemplateRow(t.length, "Life-Science-npc-misc", "Life Science"));
        t.push(new TemplateRow(t.length, "Medicine-npc-misc", "Medicine"));
        t.push(new TemplateRow(t.length, "Mysticism-npc-misc", "Mysticism"));
        t.push(new TemplateRow(t.length, "Physical-Science-npc-misc", "Physical Science"));
        t.push(new TemplateRow(t.length, "Piloting-npc-misc", "Piloting"));
        t.push(new TemplateRow(t.length, "Sense-Motive-npc-misc", "Sense Motive"));
        t.push(new TemplateRow(t.length, "Sleight-of-Hand-npc-misc", "Sleight of Hand"));
        t.push(new TemplateRow(t.length, "Stealth-npc-misc", "Stealth"));
        t.push(new TemplateRow(t.length, "Survival-npc-misc", "Survival"));
        t.push(new TemplateRow(t.length, "languages-npc", "Language"));
        t.push(new TemplateRow(t.length, "SQ", "Other Abilities"));
        t.push(new TemplateRow(t.length, "npc-gear", "Gear"));
        t.push(new TemplateRow(t.length, "", "ECOLOGY"));
        t.push(new TemplateRow(t.length, "", "Environment"));
        t.push(new TemplateRow(t.length, "", "Organization"));
        t.push(new TemplateRow(t.length, "SPECIAL", "SPECIAL ABILITIES"));
        t.sort(function (a, b) {
            return a.order - b.order;
        });
        return t;
    };

}
());